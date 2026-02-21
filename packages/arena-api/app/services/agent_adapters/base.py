import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class AgentSessionHandle:
    """Handle for an active agent conversation session."""
    session_id: str
    provider: str
    started_at: float = 0.0
    turns: list[dict] = field(default_factory=list)
    user_audio_chunks: list[bytes] = field(default_factory=list)
    agent_audio_chunks: list[bytes] = field(default_factory=list)
    turn_latencies: list[float] = field(default_factory=list)
    is_active: bool = True


class AgentAdapter(ABC):
    """Base class for agent provider integrations."""

    @abstractmethod
    async def create_session(
        self,
        system_prompt: str,
        tools: list[dict] | None,
        config: dict,
    ) -> AgentSessionHandle:
        ...

    @abstractmethod
    async def send_audio(self, session: AgentSessionHandle, audio_chunk: bytes) -> None:
        ...

    @abstractmethod
    async def receive_audio(self, session: AgentSessionHandle) -> bytes | None:
        ...

    @abstractmethod
    async def end_session(self, session: AgentSessionHandle) -> dict:
        ...

    @abstractmethod
    async def get_ws_url(self, session: AgentSessionHandle) -> str:
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @property
    @abstractmethod
    def architecture_type(self) -> str:
        ...
