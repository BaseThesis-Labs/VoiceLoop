def run_evaluation(
    audio_path: str,
    ground_truth: str | None,
    hf_token: str,
    enable_diarization: bool,
    num_speakers: int | None,
) -> dict:
    """Runs VoiceEvalPipeline in a worker process. Returns serializable dict."""
    from voice_evals import VoiceEvalPipeline, EvalConfig

    config = EvalConfig(device="auto")
    pipeline = VoiceEvalPipeline(config=config)
    result = pipeline.evaluate(
        audio_path=audio_path,
        ground_truth=ground_truth,
        enable_diarization=enable_diarization,
        hf_token=hf_token or None,
        num_speakers=num_speakers,
    )
    return result.to_dict()
