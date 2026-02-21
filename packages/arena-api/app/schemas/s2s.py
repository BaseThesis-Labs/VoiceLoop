"""Pydantic schemas for the two-step S2S battle flow."""
from pydantic import BaseModel


class CuratedPromptItem(BaseModel):
    id: str
    text: str
    category: str
    audio_url: str
    duration_seconds: float | None = None


class S2SBattleSetupResponse(BaseModel):
    """Step 1 response: battle created, models selected, no audio yet."""
    id: str
    battle_type: str = "s2s"
    model_count: int
    curated_prompts: list[CuratedPromptItem] | None = None


class S2SBattleResponse(BaseModel):
    """Step 2 response: after input audio processed by all models."""
    id: str
    battle_type: str = "s2s"
    input_audio_url: str
    input_transcript: str | None = None
    audio_a_url: str
    audio_b_url: str
    audio_c_url: str | None = None
    model_a_id: str
    model_b_id: str
    model_c_id: str | None = None
    e2e_latency_a: float
    e2e_latency_b: float
    e2e_latency_c: float | None = None
    ttfb_a: float
    ttfb_b: float
    ttfb_c: float | None = None
    duration_a: float
    duration_b: float
    duration_c: float | None = None


class S2SModelMetrics(BaseModel):
    transcript: str | None = None
    utmos: float | None = None
    prosody_score: float | None = None
    relevance_score: float | None = None


class S2SMetricsResponse(BaseModel):
    """Post-vote progressive metrics polling response."""
    status: str  # "computing" | "partial" | "complete"
    model_names: dict[str, str] | None = None
    providers: dict[str, str] | None = None
    metrics: dict[str, S2SModelMetrics] | None = None
