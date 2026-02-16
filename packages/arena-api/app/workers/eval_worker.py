import dataclasses
from voice_evals import VoiceEvaluationPipeline


def run_evaluation(
    audio_path: str,
    transcript_path: str | None,
    hf_token: str,
    enable_diarization: bool,
    num_speakers: int | None,
) -> dict:
    """Runs VoiceEvaluationPipeline in a worker process. Returns serializable dict."""
    pipeline = VoiceEvaluationPipeline(
        audio_path=audio_path,
        transcript_path=transcript_path,
        hf_token=hf_token or None,
        enable_diarization=enable_diarization,
        num_speakers=num_speakers,
    )
    metrics = pipeline.evaluate()
    return dataclasses.asdict(metrics)
