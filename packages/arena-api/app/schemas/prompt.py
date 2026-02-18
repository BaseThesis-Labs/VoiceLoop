from datetime import datetime
from pydantic import BaseModel


class PromptResponse(BaseModel):
    id: str
    text: str
    category: str
    scenario_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
