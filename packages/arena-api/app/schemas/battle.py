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
    created_at: str

    model_config = {"from_attributes": True}
