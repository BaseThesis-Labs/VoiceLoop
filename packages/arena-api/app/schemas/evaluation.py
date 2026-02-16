from pydantic import BaseModel


class EvaluationCreate(BaseModel):
    model_id: str
    scenario_id: str | None = None
    transcript_ref: str | None = None


class EvaluationResponse(BaseModel):
    id: str
    model_id: str
    scenario_id: str | None
    status: str
    audio_path: str
    metrics_json: dict | None
    diarization_json: dict | None
    duration_seconds: float | None
    error_message: str | None
    created_at: str

    model_config = {"from_attributes": True}


class EvaluationProgress(BaseModel):
    eval_id: str
    step: int
    total_steps: int
    stage: str
    message: str
