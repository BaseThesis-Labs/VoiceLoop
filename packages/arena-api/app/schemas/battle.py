from datetime import datetime
from pydantic import BaseModel


class BattleCreate(BaseModel):
    scenario_id: str
    model_a_id: str
    model_b_id: str


class BattleVote(BaseModel):
    winner: str  # "a", "b", or "tie"


class BattleResponse(BaseModel):
    id: str
    scenario_id: str
    model_a_id: str
    model_b_id: str
    eval_a_id: str | None
    eval_b_id: str | None
    winner: str | None
    vote_source: str | None
    elo_delta: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BattleGenerateResponse(BaseModel):
    id: str
    prompt_text: str
    prompt_category: str
    audio_a_url: str
    audio_b_url: str
    model_a_id: str
    model_b_id: str
    model_a_name: str
    model_b_name: str
    provider_a: str
    provider_b: str
    eval_a_id: str
    eval_b_id: str
    duration_a: float
    duration_b: float
    ttfb_a: float
    ttfb_b: float
