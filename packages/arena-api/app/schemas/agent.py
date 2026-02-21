from pydantic import BaseModel


class ScenarioItem(BaseModel):
    id: str
    name: str
    category: str
    difficulty: str
    description: str
    max_turns: int | None = 10
    max_duration_seconds: int | None = 120


class AgentConfigItem(BaseModel):
    id: str
    name: str
    architecture_type: str
    provider: str
    components: dict


class AgentBattleSetupResponse(BaseModel):
    id: str
    battle_type: str = "agent"
    scenario: ScenarioItem
    config_a: AgentConfigItem
    config_b: AgentConfigItem
    agent_battle_id: str


class ConversationTurn(BaseModel):
    role: str
    text: str | None = None
    start_ms: float | None = None
    end_ms: float | None = None
    latency_ms: float | None = None


class AgentConversationResponse(BaseModel):
    id: str
    agent_label: str
    total_turns: int
    duration_seconds: float
    transcript: list[ConversationTurn]


class AgentConversationSummary(BaseModel):
    agent_label: str
    total_turns: int
    duration_seconds: float


class AgentVoteRequest(BaseModel):
    winner: str
    sub_votes: dict[str, str] | None = None


class AgentModelMetrics(BaseModel):
    agent_label: str
    config_name: str
    provider: str
    components: dict
    total_turns: int | None = None
    duration_seconds: float | None = None
    avg_latency_ms: float | None = None
    p50_latency_ms: float | None = None
    p95_latency_ms: float | None = None
    task_success: bool | None = None
    joint_goal_accuracy: float | None = None
    containment: bool | None = None


class AgentMetricsResponse(BaseModel):
    status: str
    scenario_name: str | None = None
    metrics_a: AgentModelMetrics | None = None
    metrics_b: AgentModelMetrics | None = None
    automated_eval: dict | None = None
