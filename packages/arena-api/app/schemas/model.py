from datetime import datetime
from pydantic import BaseModel


class ModelCreate(BaseModel):
    name: str
    provider: str
    version: str = ""
    config_json: dict | None = None


class ModelUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    version: str | None = None
    config_json: dict | None = None


class ModelResponse(BaseModel):
    id: str
    name: str
    provider: str
    version: str
    model_type: str = "tts"
    config_json: dict | None
    elo_rating: float
    total_battles: int
    win_rate: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
