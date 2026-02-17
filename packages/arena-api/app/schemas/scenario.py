from datetime import datetime
from pydantic import BaseModel


class ScenarioCreate(BaseModel):
    name: str
    category: str
    description: str = ""
    difficulty: str = "medium"
    ground_truth_transcript: str | None = None


class ScenarioResponse(BaseModel):
    id: str
    name: str
    category: str
    description: str
    difficulty: str
    ground_truth_transcript: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
