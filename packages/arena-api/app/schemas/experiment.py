"""Pydantic schemas for the Experiments API."""
from datetime import datetime
from pydantic import BaseModel, Field


class ModelSpec(BaseModel):
    provider: str
    voice_id: str | None = None


class ExperimentCreate(BaseModel):
    name: str
    scenario: str
    eval_mode: str = "automated"
    models: list[ModelSpec] = Field(..., min_length=2, max_length=4)
    prompts: list[str] = Field(..., min_length=1, max_length=20)
    webhook_url: str | None = None


class ExperimentResponse(BaseModel):
    id: str
    developer_id: str
    name: str
    scenario: str
    eval_mode: str
    status: str
    models_json: list
    prompts_json: list
    webhook_url: str | None
    total_trials: int
    completed_trials: int
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExperimentListResponse(BaseModel):
    id: str
    name: str
    scenario: str
    eval_mode: str
    status: str
    total_trials: int
    completed_trials: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TrialResponse(BaseModel):
    id: str
    experiment_id: str
    prompt_index: int
    prompt_text: str
    provider: str
    voice_id: str
    model_id: str
    status: str
    audio_url: str | None = None
    duration_seconds: float | None
    ttfb_ms: float | None
    generation_time_ms: float | None
    silence_ratio: float | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModelResultSummary(BaseModel):
    provider: str
    voice_id: str
    model_id: str
    trials_completed: int
    trials_failed: int
    avg_duration_seconds: float | None
    avg_ttfb_ms: float | None
    avg_generation_time_ms: float | None
    avg_silence_ratio: float | None
    composite_score: float


class HeadToHead(BaseModel):
    model_a: str
    model_b: str
    a_wins: int
    b_wins: int
    ties: int


class ExperimentResultsResponse(BaseModel):
    experiment_id: str
    status: str
    rankings: list[ModelResultSummary]
    head_to_head: list[HeadToHead]
    winner: str | None
    confidence: str
