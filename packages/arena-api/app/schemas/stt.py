"""Pydantic schemas for the STT battle flow."""
from pydantic import BaseModel


class AudioClipItem(BaseModel):
    id: str
    text: str
    category: str
    difficulty: str
    audio_url: str
    duration_seconds: float | None = None


class STTBattleSetupResponse(BaseModel):
    """Step 1 response: battle created, models selected, no transcripts yet."""
    id: str
    battle_type: str = "stt"
    model_count: int
    curated_clips: list[AudioClipItem] | None = None


class STTTranscriptItem(BaseModel):
    """One model's transcription result."""
    model_id: str
    transcript: str
    word_count: int
    e2e_latency_ms: float
    ttfb_ms: float


class STTBattleResponse(BaseModel):
    """Step 2 response: after input audio transcribed by all models."""
    id: str
    battle_type: str = "stt"
    input_audio_url: str
    ground_truth: str | None = None
    transcripts: list[STTTranscriptItem]


class STTDiffItem(BaseModel):
    word: str | None = None
    ref_word: str | None = None
    type: str  # "correct" | "insertion" | "deletion" | "substitution"


class STTModelMetrics(BaseModel):
    transcript: str
    wer: float | None = None
    cer: float | None = None
    diff: list[STTDiffItem] | None = None
    e2e_latency_ms: float
    ttfb_ms: float
    word_count: int


class STTMetricsResponse(BaseModel):
    """Post-vote metrics with diff highlighting."""
    status: str  # "computing" | "complete"
    model_names: dict[str, str] | None = None
    providers: dict[str, str] | None = None
    ground_truth: str | None = None
    metrics: dict[str, STTModelMetrics] | None = None
