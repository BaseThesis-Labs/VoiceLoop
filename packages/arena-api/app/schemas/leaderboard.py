from pydantic import BaseModel


class MetricConfig(BaseModel):
    key: str           # "avg_prosody", "avg_wer", etc.
    label: str         # "Prosody", "WER", etc.
    format: str        # "decimal_2", "percent", "ms", "score_5"
    higher_is_better: bool = True


class LeaderboardEntry(BaseModel):
    model_id: str
    model_name: str
    provider: str
    model_type: str
    elo_rating: float
    win_rate: float
    total_battles: int
    rank: int
    metrics: dict[str, float | None] = {}


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    metrics_config: list[MetricConfig]


class LeaderboardHistoryEntry(BaseModel):
    model_id: str
    model_name: str
    elo_rating: float
    snapshot_date: str
