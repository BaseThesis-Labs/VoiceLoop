from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    model_id: str
    model_name: str
    provider: str
    elo_rating: float
    win_rate: float
    total_battles: int
    avg_wer: float | None
    avg_semascore: float | None
    avg_prosody: float | None
    avg_quality: float | None
    rank: int


class LeaderboardHistoryEntry(BaseModel):
    model_id: str
    model_name: str
    elo_rating: float
    snapshot_date: str
