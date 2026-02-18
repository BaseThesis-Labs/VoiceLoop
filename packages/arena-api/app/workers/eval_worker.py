def run_evaluation(
    audio_path: str,
    ground_truth: str | None,
    hf_token: str,
    enable_diarization: bool,
    num_speakers: int | None,
    groups: list[str] | None = None,
) -> dict:
    """Runs VoiceEvalPipeline in a worker process. Returns serializable dict."""
    try:
        from voice_evals import VoiceEvalPipeline, EvalConfig

        config = EvalConfig(device="auto")
        pipeline = VoiceEvalPipeline(config=config)

        # Default groups for TTS-only battles: asr + tts (skip agent/latency)
        eval_groups = groups if groups is not None else ["asr", "tts"]

        result = pipeline.evaluate(
            audio_path=audio_path,
            ground_truth=ground_truth,
            groups=eval_groups,
            enable_diarization=enable_diarization,
            hf_token=hf_token or None,
            num_speakers=num_speakers,
        )
        return result.to_dict()
    except ImportError as e:
        return {
            "overall_metrics": {},
            "error": f"voice_evals dependencies not installed: {e}",
            "status": "failed",
        }
    except Exception as e:
        return {
            "overall_metrics": {},
            "error": str(e),
            "status": "failed",
        }
