# Agent Battle Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Agent battle mode — users have sequential voice conversations with two AI agents (Vapi, Retell) on a given task scenario, then vote on which handled it better.

**Architecture:** Two-step flow. Step 1: `POST /battles/generate` picks a scenario + 2 agent configs. Step 2: User connects to `WS /battles/{id}/agent-stream?agent=a` for a real-time bidirectional audio conversation, then repeats for agent B. Audio is proxied through the Arena API (browser ↔ server ↔ provider). After both conversations, user votes (overall + sub-dimensions). Post-vote automated eval runs LLM-as-judge on transcripts.

**Tech Stack:** FastAPI (WebSocket), SQLAlchemy 2.0 (async), Alembic, PostgreSQL, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Web Audio API (AudioWorklet), WebSocket (browser + `websockets` Python lib), Vapi WebSocket API, Retell WebSocket API

**Design doc:** `docs/plans/2026-02-21-agent-battle-mode-design.md`

---

## Context

Phase 1 (multi-mode infrastructure), S2S, and STT are complete on `feat/multi-mode-battles`. The `battle_type` CHECK constraint already allows `"agent"`. The ModeSelector has Agent disabled with "soon" label. The battles router rejects agent with a 501. This plan implements the actual Agent battle functionality.

**Key difference from TTS/STT/S2S:** Those modes use REST request-response (capture audio, submit, get results). Agent battles use WebSocket for real-time bidirectional audio streaming — the user and agent talk in real-time over a persistent connection.

**Audio capture difference:** STT/S2S use MediaRecorder (captures full recording, sends as file). Agent battles need raw PCM streaming via Web Audio API's AudioWorklet — each audio frame is sent immediately over WebSocket for real-time conversation.

---

## Task 1: Add Agent Config to Settings

**Files:**
- Modify: `packages/arena-api/app/config.py`

Add Vapi and Retell API keys + timeout to the `Settings` class, after the existing STT settings (after line 17):

```python
vapi_api_key: str = ""
retell_api_key: str = ""
agent_conversation_timeout: int = 120
```

**Commit:** `feat: add Vapi and Retell API keys to settings`

---

## Task 2: Database Models + Migration

**Files:**
- Create: `packages/arena-api/app/models/agent_configuration.py`
- Create: `packages/arena-api/app/models/agent_conversation.py`
- Create: `packages/arena-api/app/models/agent_battle.py`
- Create: `packages/arena-api/alembic/versions/h8i9j0k1l2m3_add_agent_battle_tables.py`
- Modify: `packages/arena-api/app/models/__init__.py`

### `agent_configuration.py`

```python
from sqlalchemy import String, Float, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class AgentConfiguration(Base, TimestampMixin):
    __tablename__ = "agent_configurations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    architecture_type: Mapped[str] = mapped_column(String, nullable=False, default="cascade")
    provider: Mapped[str] = mapped_column(String, nullable=False)
    components_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    elo_rating: Mapped[float] = mapped_column(Float, default=1500.0)
    total_battles: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
```

### `agent_conversation.py`

```python
from sqlalchemy import String, Float, Integer, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class AgentConversation(Base, TimestampMixin):
    __tablename__ = "agent_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    battle_id: Mapped[str] = mapped_column(String, ForeignKey("battles.id"), nullable=False)
    agent_config_id: Mapped[str] = mapped_column(String, ForeignKey("agent_configurations.id"), nullable=False)
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id"), nullable=False)
    agent_label: Mapped[str] = mapped_column(String, nullable=False)
    turns_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    total_turns: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    agent_audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    transcript_full: Mapped[str | None] = mapped_column(Text, nullable=True)
    avg_response_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    p50_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    p95_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttfb_avg_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    task_success: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    joint_goal_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    containment: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    turns_to_completion: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

### `agent_battle.py`

```python
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class AgentBattle(Base, TimestampMixin):
    __tablename__ = "agent_battles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    battle_id: Mapped[str] = mapped_column(String, ForeignKey("battles.id"), nullable=False)
    formulation: Mapped[str] = mapped_column(String, nullable=False, default="outcome")
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id"), nullable=False)
    config_a_id: Mapped[str] = mapped_column(String, ForeignKey("agent_configurations.id"), nullable=False)
    config_b_id: Mapped[str] = mapped_column(String, ForeignKey("agent_configurations.id"), nullable=False)
    conversation_a_id: Mapped[str | None] = mapped_column(String, ForeignKey("agent_conversations.id"), nullable=True)
    conversation_b_id: Mapped[str | None] = mapped_column(String, ForeignKey("agent_conversations.id"), nullable=True)
    sub_votes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    automated_eval_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
```

### Migration `h8i9j0k1l2m3`

Revises: `g7h8i9j0k1l2` (the audio_clips migration)

Operations:
1. Create `agent_configurations` table
2. Create `agent_conversations` table (FKs to battles, agent_configurations, scenarios)
3. Create `agent_battles` table (FKs to battles, scenarios, agent_configurations, agent_conversations)
4. Add columns to `scenarios` table for agent battles:
   - `system_prompt` (Text, nullable)
   - `required_slots` (JSONB, nullable)
   - `success_criteria` (Text, nullable)
   - `tools_available` (JSONB, nullable)
   - `max_turns` (Integer, nullable, server_default='10')
   - `max_duration_seconds` (Integer, nullable, server_default='120')
5. Make `battles.model_a_id` and `battles.model_b_id` nullable (ALTER COLUMN SET DROP NOT NULL)
6. Update the trigger function to skip NULL model IDs:

```sql
CREATE OR REPLACE FUNCTION check_battle_model_type_match()
RETURNS TRIGGER AS $$
DECLARE
    model_ids TEXT[];
    mid TEXT;
    mtype TEXT;
BEGIN
    -- Skip type check for agent battles (they don't use model_a_id/model_b_id)
    IF NEW.battle_type = 'agent' THEN
        RETURN NEW;
    END IF;

    model_ids := ARRAY[NEW.model_a_id, NEW.model_b_id];
    IF NEW.model_c_id IS NOT NULL THEN
        model_ids := array_append(model_ids, NEW.model_c_id);
    END IF;
    IF NEW.model_d_id IS NOT NULL THEN
        model_ids := array_append(model_ids, NEW.model_d_id);
    END IF;

    FOREACH mid IN ARRAY model_ids LOOP
        IF mid IS NULL THEN
            CONTINUE;
        END IF;
        SELECT model_type INTO mtype FROM models WHERE id = mid;
        IF mtype IS NULL THEN
            RAISE EXCEPTION 'Model % not found', mid;
        END IF;
        IF mtype != NEW.battle_type THEN
            RAISE EXCEPTION 'Model % has type % but battle type is %', mid, mtype, NEW.battle_type;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Also update the `Scenario` model in `packages/arena-api/app/models/scenario.py` to add the new fields:
```python
system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
required_slots: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
tools_available: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
max_turns: Mapped[int | None] = mapped_column(Integer, nullable=True, default=10)
max_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True, default=120)
```

Add imports for `Integer` and `JSONB` to scenario.py.

Update `__init__.py` to add:
```python
from app.models.agent_configuration import AgentConfiguration
from app.models.agent_conversation import AgentConversation
from app.models.agent_battle import AgentBattle
```
And add `"AgentConfiguration", "AgentConversation", "AgentBattle"` to `__all__`.

**Commit:** `feat: agent battle database models and migration`

---

## Task 3: Agent Pydantic Schemas

**Files:**
- Create: `packages/arena-api/app/schemas/agent.py`

```python
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
    """Step 1: battle created, scenario + configs selected."""
    id: str
    battle_type: str = "agent"
    scenario: ScenarioItem
    config_a: AgentConfigItem
    config_b: AgentConfigItem
    agent_battle_id: str


class ConversationTurn(BaseModel):
    role: str  # "user" | "agent"
    text: str | None = None
    start_ms: float | None = None
    end_ms: float | None = None
    latency_ms: float | None = None


class AgentConversationResponse(BaseModel):
    """Returned when a conversation ends."""
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
    winner: str  # "a" | "b" | "tie"
    sub_votes: dict[str, str] | None = None  # {naturalness: "a", speed: "b", ...}


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
    """Post-vote progressive metrics."""
    status: str  # "computing" | "partial" | "complete"
    scenario_name: str | None = None
    metrics_a: AgentModelMetrics | None = None
    metrics_b: AgentModelMetrics | None = None
    automated_eval: dict | None = None  # LLM-as-judge results
```

**Commit:** `feat: agent battle Pydantic schemas`

---

## Task 4: Agent Adapter Base + Vapi Adapter

**Files:**
- Create: `packages/arena-api/app/services/agent_adapters/__init__.py`
- Create: `packages/arena-api/app/services/agent_adapters/base.py`
- Create: `packages/arena-api/app/services/agent_adapters/vapi_adapter.py`

### `__init__.py`

```python
from app.services.agent_adapters.base import AgentAdapter, AgentSessionHandle
from app.services.agent_adapters.vapi_adapter import VapiAdapter
```

### `base.py`

```python
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
        """Create a new agent session. Returns a handle with provider connection info."""
        ...

    @abstractmethod
    async def send_audio(self, session: AgentSessionHandle, audio_chunk: bytes) -> None:
        """Send user audio chunk to the agent provider."""
        ...

    @abstractmethod
    async def receive_audio(self, session: AgentSessionHandle) -> bytes | None:
        """Receive next agent audio chunk. Returns None when no data available."""
        ...

    @abstractmethod
    async def end_session(self, session: AgentSessionHandle) -> dict:
        """End session, return summary: {transcript, total_turns, duration_seconds, latencies}."""
        ...

    @abstractmethod
    async def get_ws_url(self, session: AgentSessionHandle) -> str:
        """Get the provider WebSocket URL for this session."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @property
    @abstractmethod
    def architecture_type(self) -> str:
        ...
```

### `vapi_adapter.py`

```python
import json
import time
import logging
import httpx
import websockets
from app.config import settings
from app.services.agent_adapters.base import AgentAdapter, AgentSessionHandle

logger = logging.getLogger("arena.agent.vapi")

VAPI_API_BASE = "https://api.vapi.ai"


class VapiAdapter(AgentAdapter):
    """Adapter for Vapi managed cascade agents."""

    @property
    def provider_name(self) -> str:
        return "vapi"

    @property
    def architecture_type(self) -> str:
        return "cascade"

    async def create_session(
        self,
        system_prompt: str,
        tools: list[dict] | None,
        config: dict,
    ) -> AgentSessionHandle:
        """Create a Vapi call with WebSocket transport."""
        # Build inline assistant config
        assistant_config = {
            "model": {
                "provider": config.get("llm_provider", "openai"),
                "model": config.get("llm_model", "gpt-4o-mini"),
                "systemPrompt": system_prompt,
            },
            "voice": {
                "provider": config.get("tts_provider", "11labs"),
                "voiceId": config.get("tts_voice_id", ""),
            },
            "transcriber": {
                "provider": config.get("stt_provider", "deepgram"),
                "model": config.get("stt_model", "nova-2"),
            },
            "firstMessage": config.get("first_message", "Hello! How can I help you today?"),
        }

        # Create WebSocket call
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{VAPI_API_BASE}/call",
                headers={
                    "Authorization": f"Bearer {settings.vapi_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "assistant": assistant_config,
                    "transport": {
                        "provider": "vapi.websocket",
                        "audioFormat": {
                            "format": "pcm_s16le",
                            "container": "raw",
                            "sampleRate": 16000,
                        },
                    },
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()

        session = AgentSessionHandle(
            session_id=data.get("id", ""),
            provider="vapi",
            started_at=time.time(),
        )
        # Store the WS URL on the session for later connection
        session._ws_url = data.get("websocketCallUrl", "")
        session._ws = None
        return session

    async def get_ws_url(self, session: AgentSessionHandle) -> str:
        return session._ws_url

    async def send_audio(self, session: AgentSessionHandle, audio_chunk: bytes) -> None:
        """Send PCM16 audio bytes to Vapi WebSocket."""
        if session._ws and session._ws.open:
            await session._ws.send(audio_chunk)

    async def receive_audio(self, session: AgentSessionHandle) -> bytes | None:
        """Receive audio or control message from Vapi."""
        if not session._ws or not session._ws.open:
            return None
        try:
            msg = await asyncio.wait_for(session._ws.recv(), timeout=0.05)
            if isinstance(msg, bytes):
                return msg
            else:
                # JSON control message — parse for transcript updates
                data = json.loads(msg)
                self._handle_control_message(session, data)
                return None
        except (asyncio.TimeoutError, websockets.ConnectionClosed):
            return None

    async def end_session(self, session: AgentSessionHandle) -> dict:
        """End Vapi call and return conversation summary."""
        session.is_active = False
        if session._ws and session._ws.open:
            try:
                await session._ws.send(json.dumps({"type": "end-call"}))
                await session._ws.close()
            except Exception:
                pass
        duration = time.time() - session.started_at
        return {
            "total_turns": len(session.turns),
            "duration_seconds": round(duration, 2),
            "turn_latencies": session.turn_latencies,
        }

    def _handle_control_message(self, session: AgentSessionHandle, data: dict):
        msg_type = data.get("type", "")
        if msg_type == "transcript":
            role = data.get("role", "")
            text = data.get("transcript", "")
            if role and text:
                session.turns.append({
                    "role": role,
                    "text": text,
                    "timestamp_ms": round((time.time() - session.started_at) * 1000),
                })


import asyncio  # needed for wait_for
```

**Commit:** `feat: agent adapter base class and Vapi adapter`

---

## Task 5: Retell Adapter

**Files:**
- Create: `packages/arena-api/app/services/agent_adapters/retell_adapter.py`
- Modify: `packages/arena-api/app/services/agent_adapters/__init__.py`

### `retell_adapter.py`

```python
import json
import time
import logging
import asyncio
import httpx
import websockets
from app.config import settings
from app.services.agent_adapters.base import AgentAdapter, AgentSessionHandle

logger = logging.getLogger("arena.agent.retell")

RETELL_API_BASE = "https://api.retellai.com"


class RetellAdapter(AgentAdapter):
    """Adapter for Retell managed cascade agents."""

    @property
    def provider_name(self) -> str:
        return "retell"

    @property
    def architecture_type(self) -> str:
        return "cascade"

    async def create_session(
        self,
        system_prompt: str,
        tools: list[dict] | None,
        config: dict,
    ) -> AgentSessionHandle:
        """Create a Retell web call."""
        agent_id = config.get("agent_id", "")
        if not agent_id:
            raise ValueError("Retell adapter requires agent_id in config")

        # Create web call with optional agent override for system prompt
        body = {
            "agent_id": agent_id,
        }
        # Override system prompt if the agent supports it
        if system_prompt:
            body["agent_override"] = {
                "agent_prompt": system_prompt,
            }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{RETELL_API_BASE}/v2/create-web-call",
                headers={
                    "Authorization": f"Bearer {settings.retell_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()

        call_id = data.get("call_id", "")
        session = AgentSessionHandle(
            session_id=call_id,
            provider="retell",
            started_at=time.time(),
        )
        session._ws_url = f"wss://api.retellai.com/audio-websocket/{call_id}?enable_update=true"
        session._ws = None
        return session

    async def get_ws_url(self, session: AgentSessionHandle) -> str:
        return session._ws_url

    async def send_audio(self, session: AgentSessionHandle, audio_chunk: bytes) -> None:
        """Send audio bytes to Retell WebSocket."""
        if session._ws and session._ws.open:
            await session._ws.send(audio_chunk)

    async def receive_audio(self, session: AgentSessionHandle) -> bytes | None:
        """Receive audio or event from Retell."""
        if not session._ws or not session._ws.open:
            return None
        try:
            msg = await asyncio.wait_for(session._ws.recv(), timeout=0.05)
            if isinstance(msg, bytes):
                return msg
            elif isinstance(msg, str):
                if msg == "clear":
                    # Interrupt signal — return special marker
                    return b"__CLEAR__"
                else:
                    data = json.loads(msg)
                    self._handle_event(session, data)
                return None
        except (asyncio.TimeoutError, websockets.ConnectionClosed):
            return None

    async def end_session(self, session: AgentSessionHandle) -> dict:
        """End Retell call."""
        session.is_active = False
        if session._ws and session._ws.open:
            try:
                await session._ws.close()
            except Exception:
                pass
        duration = time.time() - session.started_at
        return {
            "total_turns": len(session.turns),
            "duration_seconds": round(duration, 2),
            "turn_latencies": session.turn_latencies,
        }

    def _handle_event(self, session: AgentSessionHandle, data: dict):
        event_type = data.get("event_type", "")
        if event_type == "update":
            transcript = data.get("transcript", [])
            # Replace turns with latest full transcript
            session.turns = [
                {
                    "role": t.get("role", ""),
                    "text": t.get("content", ""),
                    "words": t.get("words", []),
                }
                for t in transcript
            ]
```

Update `__init__.py`:
```python
from app.services.agent_adapters.base import AgentAdapter, AgentSessionHandle
from app.services.agent_adapters.vapi_adapter import VapiAdapter
from app.services.agent_adapters.retell_adapter import RetellAdapter
```

**Commit:** `feat: Retell agent adapter`

---

## Task 6: Agent WebSocket Router

**Files:**
- Create: `packages/arena-api/app/routers/agent_ws.py`
- Modify: `packages/arena-api/app/main.py` (add router + import)

This is the core new infrastructure. A FastAPI WebSocket endpoint that proxies audio between the browser and the agent provider.

### `agent_ws.py`

```python
import asyncio
import json
import logging
import os
import struct
import time
import uuid

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_factory
from app.models.battle import Battle
from app.models.agent_battle import AgentBattle
from app.models.agent_configuration import AgentConfiguration
from app.models.agent_conversation import AgentConversation
from app.models.scenario import Scenario
from app.services.agent_adapters.vapi_adapter import VapiAdapter
from app.services.agent_adapters.retell_adapter import RetellAdapter

logger = logging.getLogger("arena.agent.ws")

router = APIRouter(prefix="/api/v1/battles", tags=["agent-ws"])

ADAPTERS = {
    "vapi": VapiAdapter,
    "retell": RetellAdapter,
}

SAMPLE_RATE = 16000
CHANNELS = 1
BITS_PER_SAMPLE = 16


def _build_wav_header(data_size: int, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Build a WAV header for PCM s16le audio."""
    byte_rate = sample_rate * CHANNELS * BITS_PER_SAMPLE // 8
    block_align = CHANNELS * BITS_PER_SAMPLE // 8
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,
        1,  # PCM
        CHANNELS,
        sample_rate,
        byte_rate,
        block_align,
        BITS_PER_SAMPLE,
        b'data',
        data_size,
    )
    return header


@router.websocket("/{battle_id}/agent-stream")
async def agent_stream(websocket: WebSocket, battle_id: str):
    """Bidirectional audio proxy between browser and agent provider."""
    await websocket.accept()

    # Parse agent label from query params
    agent_label = websocket.query_params.get("agent", "")
    if agent_label not in ("a", "b"):
        await websocket.send_json({"type": "error", "message": "agent must be 'a' or 'b'"})
        await websocket.close()
        return

    # Load battle context from DB
    async with async_session_factory() as db:
        battle = (await db.execute(select(Battle).where(Battle.id == battle_id))).scalar_one_or_none()
        if not battle or battle.battle_type != "agent":
            await websocket.send_json({"type": "error", "message": "Battle not found or not agent type"})
            await websocket.close()
            return

        agent_battle = (await db.execute(
            select(AgentBattle).where(AgentBattle.battle_id == battle_id)
        )).scalar_one_or_none()
        if not agent_battle:
            await websocket.send_json({"type": "error", "message": "Agent battle not found"})
            await websocket.close()
            return

        # Check if conversation already exists for this label
        conv_id_field = f"conversation_{agent_label}_id"
        if getattr(agent_battle, conv_id_field) is not None:
            await websocket.send_json({"type": "error", "message": f"Conversation {agent_label} already completed"})
            await websocket.close()
            return

        config_id = agent_battle.config_a_id if agent_label == "a" else agent_battle.config_b_id
        config = (await db.execute(
            select(AgentConfiguration).where(AgentConfiguration.id == config_id)
        )).scalar_one_or_none()
        if not config:
            await websocket.send_json({"type": "error", "message": "Agent config not found"})
            await websocket.close()
            return

        scenario = (await db.execute(
            select(Scenario).where(Scenario.id == agent_battle.scenario_id)
        )).scalar_one_or_none()

    # Create adapter
    AdapterClass = ADAPTERS.get(config.provider)
    if not AdapterClass:
        await websocket.send_json({"type": "error", "message": f"Unknown provider: {config.provider}"})
        await websocket.close()
        return

    adapter = AdapterClass()
    system_prompt = scenario.system_prompt or scenario.description if scenario else ""
    tools = scenario.tools_available if scenario else None

    try:
        session = await adapter.create_session(system_prompt, tools, config.config_json or {})
    except Exception as e:
        logger.error("Failed to create agent session: %s", e)
        await websocket.send_json({"type": "error", "message": f"Failed to connect to {config.provider}"})
        await websocket.close()
        return

    # Connect to provider WebSocket
    provider_ws_url = await adapter.get_ws_url(session)
    try:
        provider_ws = await websockets.connect(provider_ws_url)
        session._ws = provider_ws
    except Exception as e:
        logger.error("Failed to connect provider WS: %s", e)
        await websocket.send_json({"type": "error", "message": "Failed to connect to agent"})
        await websocket.close()
        return

    await websocket.send_json({"type": "session_started", "session_id": session.session_id})

    # Recording buffers
    user_audio_chunks: list[bytes] = []
    agent_audio_chunks: list[bytes] = []
    start_time = time.time()

    async def forward_browser_to_provider():
        """Read audio from browser WebSocket, forward to provider."""
        try:
            while session.is_active:
                msg = await websocket.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                data = msg.get("bytes")
                if data:
                    user_audio_chunks.append(data)
                    await adapter.send_audio(session, data)
                text = msg.get("text")
                if text:
                    parsed = json.loads(text)
                    if parsed.get("type") == "end_conversation":
                        break
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error("Browser→Provider error: %s", e)
        finally:
            session.is_active = False

    async def forward_provider_to_browser():
        """Read audio from provider, forward to browser."""
        try:
            while session.is_active:
                chunk = await adapter.receive_audio(session)
                if chunk is None:
                    await asyncio.sleep(0.01)
                    continue
                if chunk == b"__CLEAR__":
                    await websocket.send_json({"type": "clear"})
                    continue
                agent_audio_chunks.append(chunk)
                await websocket.send_bytes(chunk)
        except Exception as e:
            if session.is_active:
                logger.error("Provider→Browser error: %s", e)
        finally:
            session.is_active = False

    async def timeout_watchdog():
        """Auto-end conversation after max duration."""
        max_duration = scenario.max_duration_seconds if scenario and scenario.max_duration_seconds else settings.agent_conversation_timeout
        try:
            await asyncio.sleep(max_duration)
            if session.is_active:
                session.is_active = False
                await websocket.send_json({"type": "timeout", "message": "Conversation time limit reached"})
        except asyncio.CancelledError:
            pass

    # Run bidirectional proxy + watchdog concurrently
    watchdog_task = asyncio.create_task(timeout_watchdog())
    try:
        await asyncio.gather(
            forward_browser_to_provider(),
            forward_provider_to_browser(),
        )
    finally:
        watchdog_task.cancel()
        summary = await adapter.end_session(session)

    # Save audio recordings
    duration_seconds = round(time.time() - start_time, 2)
    conv_id = str(uuid.uuid4())
    audio_dir = os.path.join(settings.audio_storage_path, "agent_conversations", conv_id)
    os.makedirs(audio_dir, exist_ok=True)

    user_audio_path = None
    agent_audio_path = None

    if user_audio_chunks:
        user_pcm = b"".join(user_audio_chunks)
        user_audio_path = os.path.join(audio_dir, "user.wav")
        with open(user_audio_path, "wb") as f:
            f.write(_build_wav_header(len(user_pcm)))
            f.write(user_pcm)

    if agent_audio_chunks:
        agent_pcm = b"".join(agent_audio_chunks)
        agent_audio_path = os.path.join(audio_dir, "agent.wav")
        with open(agent_audio_path, "wb") as f:
            f.write(_build_wav_header(len(agent_pcm)))
            f.write(agent_pcm)

    # Compute latency stats from session turns
    latencies = summary.get("turn_latencies", [])
    avg_latency = sum(latencies) / len(latencies) if latencies else None
    sorted_lat = sorted(latencies) if latencies else []
    p50 = sorted_lat[len(sorted_lat) // 2] if sorted_lat else None
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if len(sorted_lat) >= 2 else p50

    # Save conversation to DB
    async with async_session_factory() as db:
        conversation = AgentConversation(
            id=conv_id,
            battle_id=battle_id,
            agent_config_id=config_id,
            scenario_id=agent_battle.scenario_id,
            agent_label=agent_label,
            turns_json=session.turns,
            total_turns=summary.get("total_turns", 0),
            duration_seconds=duration_seconds,
            user_audio_path=user_audio_path,
            agent_audio_path=agent_audio_path,
            avg_response_latency_ms=avg_latency,
            p50_latency_ms=p50,
            p95_latency_ms=p95,
        )
        db.add(conversation)

        # Update agent_battle with conversation ID
        agent_battle = (await db.execute(
            select(AgentBattle).where(AgentBattle.battle_id == battle_id)
        )).scalar_one()
        if agent_label == "a":
            agent_battle.conversation_a_id = conv_id
        else:
            agent_battle.conversation_b_id = conv_id

        await db.commit()

    # Send final summary to browser
    await websocket.send_json({
        "type": "conversation_ended",
        "conversation_id": conv_id,
        "total_turns": summary.get("total_turns", 0),
        "duration_seconds": duration_seconds,
        "transcript": session.turns,
    })

    try:
        await websocket.close()
    except Exception:
        pass
```

### Update `main.py`

Add after existing router imports (line 28):
```python
from app.routers import models, scenarios, evaluations, battles, leaderboard, analytics, prompts, tts, subscribers, developers, experiments, agent_ws
```

Add after `app.include_router(experiments.router)` (line 40):
```python
app.include_router(agent_ws.router)
```

**Commit:** `feat: agent WebSocket proxy endpoint with bidirectional audio`

---

## Task 7: Agent Battle Generation Endpoint

**Files:**
- Modify: `packages/arena-api/app/routers/battles.py`

### Changes:

1. Add imports at top (after existing schema imports):
```python
from app.schemas.agent import AgentBattleSetupResponse, ScenarioItem, AgentConfigItem, AgentVoteRequest, AgentMetricsResponse, AgentModelMetrics
from app.models.agent_configuration import AgentConfiguration
from app.models.agent_conversation import AgentConversation
from app.models.agent_battle import AgentBattle
```

2. Change line 41-42 from rejecting `agent` to routing it:
```python
    if battle_type not in ("tts", "s2s", "stt", "agent"):
        raise HTTPException(status_code=501, detail=f"{battle_type} battles are not yet implemented")
```

3. Add agent routing after the STT routing (after line 50):
```python
    # --- Agent: Step 1 — select scenario + configs, return setup ---
    if battle_type == "agent":
        return await _generate_agent_battle(db)
```

4. Add the generation function (at end of file):
```python
async def _generate_agent_battle(db: AsyncSession):
    """Generate an agent battle: pick a random scenario + 2 agent configs from different providers."""
    # Pick a random scenario that has a system_prompt (agent-enabled)
    result = await db.execute(
        select(Scenario)
        .where(Scenario.system_prompt.isnot(None))
        .order_by(func.random())
        .limit(1)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="No agent scenarios available. Run seed script.")

    # Get all agent configs, group by provider
    result = await db.execute(select(AgentConfiguration))
    all_configs = result.scalars().all()
    if len(all_configs) < 2:
        raise HTTPException(status_code=404, detail="Need at least 2 agent configurations. Run seed script.")

    by_provider: dict[str, list] = {}
    for c in all_configs:
        by_provider.setdefault(c.provider, []).append(c)

    # Pick one config per provider, then select 2
    selected = []
    for provider_configs in by_provider.values():
        selected.append(random.choice(provider_configs))
    random.shuffle(selected)
    selected = selected[:2]

    if len(selected) < 2:
        # If only one provider, pick two different configs from it
        all_shuffled = list(all_configs)
        random.shuffle(all_shuffled)
        selected = all_shuffled[:2]

    # Create Battle record (model_a_id/model_b_id are NULL for agent battles)
    battle_id = str(uuid.uuid4())
    battle = Battle(
        id=battle_id,
        scenario_id=scenario.id,
        battle_type="agent",
    )
    db.add(battle)

    # Create AgentBattle record
    agent_battle = AgentBattle(
        battle_id=battle_id,
        formulation="outcome",
        scenario_id=scenario.id,
        config_a_id=selected[0].id,
        config_b_id=selected[1].id,
    )
    db.add(agent_battle)
    await db.commit()

    return AgentBattleSetupResponse(
        id=battle_id,
        scenario=ScenarioItem(
            id=scenario.id,
            name=scenario.name,
            category=scenario.category,
            difficulty=scenario.difficulty,
            description=scenario.description,
            max_turns=scenario.max_turns,
            max_duration_seconds=scenario.max_duration_seconds,
        ),
        config_a=AgentConfigItem(
            id=selected[0].id,
            name=selected[0].name,
            architecture_type=selected[0].architecture_type,
            provider=selected[0].provider,
            components=selected[0].components_json,
        ),
        config_b=AgentConfigItem(
            id=selected[1].id,
            name=selected[1].name,
            architecture_type=selected[1].architecture_type,
            provider=selected[1].provider,
            components=selected[1].components_json,
        ),
        agent_battle_id=agent_battle.id,
    )
```

Also add `import uuid` to the top imports if not already present.

**Note:** The `model_a_id` and `model_b_id` on the Battle record are left as NULL — this is why Task 2 makes them nullable and updates the trigger.

**Commit:** `feat: agent battle generation endpoint`

---

## Task 8: Agent Metrics + Evaluation Endpoint

**Files:**
- Create: `packages/arena-api/app/services/agent_eval_service.py`
- Modify: `packages/arena-api/app/routers/battles.py` (add metrics endpoint)

### `agent_eval_service.py`

LLM-as-judge service for evaluating agent conversations:

```python
import json
import logging
import httpx
from app.config import settings

logger = logging.getLogger("arena.agent.eval")


async def evaluate_agent_conversation(
    transcript: list[dict],
    scenario_description: str,
    success_criteria: str | None,
    required_slots: dict | None,
) -> dict:
    """Run LLM-as-judge on an agent conversation transcript.

    Returns: {
        task_success: bool,
        coherence_score: float (0-1),
        instruction_following: float (0-1),
        hallucination_count: int,
        joint_goal_accuracy: float (0-1) or None,
        explanation: str,
    }
    """
    if not settings.openai_api_key:
        logger.warning("No OpenAI API key set, skipping agent evaluation")
        return {}

    # Build transcript text
    transcript_text = "\n".join(
        f"{t.get('role', 'unknown').upper()}: {t.get('text', '')}"
        for t in transcript
        if t.get("text")
    )

    # Build evaluation prompt
    eval_prompt = f"""You are evaluating a voice agent conversation. The agent was given a task scenario and had a conversation with a user.

SCENARIO: {scenario_description}

{"SUCCESS CRITERIA: " + success_criteria if success_criteria else ""}

{"REQUIRED SLOTS: " + json.dumps(required_slots) if required_slots else ""}

CONVERSATION TRANSCRIPT:
{transcript_text}

Evaluate the agent's performance and respond with a JSON object:
{{
    "task_success": true/false,
    "coherence_score": 0.0-1.0,
    "instruction_following": 0.0-1.0,
    "hallucination_count": 0,
    "joint_goal_accuracy": 0.0-1.0 or null,
    "explanation": "Brief explanation of the evaluation"
}}

Only respond with the JSON object, no other text."""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": eval_prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        logger.error("Agent evaluation failed: %s", e)
        return {}
```

### Add metrics endpoint to `battles.py`

Add after the STT metrics endpoint:

```python
@router.get("/{battle_id}/agent-metrics", response_model=AgentMetricsResponse)
async def get_agent_metrics(battle_id: str, db: AsyncSession = Depends(get_db)):
    """Get progressive post-vote metrics for an agent battle."""
    battle = (await db.execute(select(Battle).where(Battle.id == battle_id))).scalar_one_or_none()
    if not battle or battle.battle_type != "agent":
        raise HTTPException(status_code=404, detail="Agent battle not found")
    if not battle.winner:
        raise HTTPException(status_code=400, detail="Vote not yet submitted")

    agent_battle = (await db.execute(
        select(AgentBattle).where(AgentBattle.battle_id == battle_id)
    )).scalar_one_or_none()
    if not agent_battle:
        raise HTTPException(status_code=404, detail="Agent battle record not found")

    scenario = (await db.execute(
        select(Scenario).where(Scenario.id == agent_battle.scenario_id)
    )).scalar_one_or_none()

    # Load conversations
    conv_a = None
    conv_b = None
    if agent_battle.conversation_a_id:
        conv_a = (await db.execute(
            select(AgentConversation).where(AgentConversation.id == agent_battle.conversation_a_id)
        )).scalar_one_or_none()
    if agent_battle.conversation_b_id:
        conv_b = (await db.execute(
            select(AgentConversation).where(AgentConversation.id == agent_battle.conversation_b_id)
        )).scalar_one_or_none()

    # Load configs
    config_a = (await db.execute(
        select(AgentConfiguration).where(AgentConfiguration.id == agent_battle.config_a_id)
    )).scalar_one_or_none()
    config_b = (await db.execute(
        select(AgentConfiguration).where(AgentConfiguration.id == agent_battle.config_b_id)
    )).scalar_one_or_none()

    # Check if automated eval is done
    automated_eval = agent_battle.automated_eval_json
    status = "complete" if automated_eval else ("partial" if conv_a and conv_b else "computing")

    # If no eval yet and both conversations exist, kick off eval
    if not automated_eval and conv_a and conv_b and scenario:
        from app.services.agent_eval_service import evaluate_agent_conversation
        import asyncio

        async def run_eval():
            eval_a = await evaluate_agent_conversation(
                conv_a.turns_json or [],
                scenario.description,
                scenario.success_criteria,
                scenario.required_slots,
            )
            eval_b = await evaluate_agent_conversation(
                conv_b.turns_json or [],
                scenario.description,
                scenario.success_criteria,
                scenario.required_slots,
            )
            result = {"a": eval_a, "b": eval_b}
            async with async_session_factory() as eval_db:
                ab = (await eval_db.execute(
                    select(AgentBattle).where(AgentBattle.battle_id == battle_id)
                )).scalar_one()
                ab.automated_eval_json = result
                # Update conversation task_success
                if eval_a.get("task_success") is not None and conv_a:
                    ca = (await eval_db.execute(
                        select(AgentConversation).where(AgentConversation.id == conv_a.id)
                    )).scalar_one()
                    ca.task_success = eval_a.get("task_success")
                    ca.joint_goal_accuracy = eval_a.get("joint_goal_accuracy")
                if eval_b.get("task_success") is not None and conv_b:
                    cb = (await eval_db.execute(
                        select(AgentConversation).where(AgentConversation.id == conv_b.id)
                    )).scalar_one()
                    cb.task_success = eval_b.get("task_success")
                    cb.joint_goal_accuracy = eval_b.get("joint_goal_accuracy")
                await eval_db.commit()

        asyncio.create_task(run_eval())
        status = "computing"

    from app.database import async_session_factory

    def _build_metrics(conv, config, label) -> AgentModelMetrics | None:
        if not conv or not config:
            return None
        return AgentModelMetrics(
            agent_label=label,
            config_name=config.name,
            provider=config.provider,
            components=config.components_json,
            total_turns=conv.total_turns,
            duration_seconds=conv.duration_seconds,
            avg_latency_ms=conv.avg_response_latency_ms,
            p50_latency_ms=conv.p50_latency_ms,
            p95_latency_ms=conv.p95_latency_ms,
            task_success=conv.task_success,
            joint_goal_accuracy=conv.joint_goal_accuracy,
            containment=conv.containment,
        )

    return AgentMetricsResponse(
        status=status,
        scenario_name=scenario.name if scenario else None,
        metrics_a=_build_metrics(conv_a, config_a, "a"),
        metrics_b=_build_metrics(conv_b, config_b, "b"),
        automated_eval=automated_eval,
    )
```

**Commit:** `feat: agent LLM-as-judge evaluation and metrics endpoint`

---

## Task 9: Seed Agent Data

**Files:**
- Modify: `packages/arena-api/scripts/seed.py`

Add agent configurations and agent-specific scenarios after the existing STT clips section.

### Agent Configurations (6 total):

```python
AGENT_CONFIGS = [
    {
        "id": "agent-vapi-default",
        "name": "Vapi + GPT-4o-mini + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "vapi",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o-mini", "tts": "elevenlabs"},
        "config_json": {
            "llm_provider": "openai",
            "llm_model": "gpt-4o-mini",
            "tts_provider": "11labs",
            "tts_voice_id": "",
            "stt_provider": "deepgram",
            "stt_model": "nova-2",
            "first_message": "Hello! How can I help you today?",
        },
    },
    {
        "id": "agent-vapi-quality",
        "name": "Vapi + GPT-4o + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "vapi",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o", "tts": "elevenlabs"},
        "config_json": {
            "llm_provider": "openai",
            "llm_model": "gpt-4o",
            "tts_provider": "11labs",
            "tts_voice_id": "",
            "stt_provider": "deepgram",
            "stt_model": "nova-2",
            "first_message": "Hello! How can I help you today?",
        },
    },
    {
        "id": "agent-vapi-claude",
        "name": "Vapi + Claude Sonnet 4.5 + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "vapi",
        "components_json": {"stt": "deepgram_nova3", "llm": "claude-sonnet-4-5", "tts": "elevenlabs"},
        "config_json": {
            "llm_provider": "anthropic",
            "llm_model": "claude-sonnet-4-5-20250929",
            "tts_provider": "11labs",
            "tts_voice_id": "",
            "stt_provider": "deepgram",
            "stt_model": "nova-2",
            "first_message": "Hello! How can I help you today?",
        },
    },
    {
        "id": "agent-retell-default",
        "name": "Retell + GPT-4o-mini + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "retell",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o-mini", "tts": "elevenlabs"},
        "config_json": {"agent_id": ""},
    },
    {
        "id": "agent-retell-quality",
        "name": "Retell + GPT-4o + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "retell",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o", "tts": "elevenlabs"},
        "config_json": {"agent_id": ""},
    },
    {
        "id": "agent-retell-claude",
        "name": "Retell + Claude Sonnet 4.5 + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "retell",
        "components_json": {"stt": "deepgram_nova3", "llm": "claude-sonnet-4-5", "tts": "elevenlabs"},
        "config_json": {"agent_id": ""},
    },
]
```

### Agent Scenarios (10 total):

Update existing scenarios to add `system_prompt`, `required_slots`, `success_criteria`, `tools_available`, `max_turns`, `max_duration_seconds`. Add 4 new scenarios.

```python
AGENT_SCENARIOS = [
    {
        "name": "Haircut appointment booking",
        "category": "booking",
        "difficulty": "easy",
        "description": "Book a haircut appointment for tomorrow at 2pm at your usual salon.",
        "system_prompt": "You are a receptionist at StyleCut Salon. Help customers book haircut appointments. Available times tomorrow: 10am, 11am, 2pm, 3:30pm, 5pm. Ask for their name, preferred stylist (optional), and confirm the time. Stylists available: Maria, James, Priya.",
        "required_slots": {"service": "haircut", "date": "tomorrow", "time": "2pm"},
        "success_criteria": "Agent confirms a haircut appointment for tomorrow at 2pm with customer name.",
        "tools_available": [{"name": "check_availability", "description": "Check available time slots"}, {"name": "book_appointment", "description": "Book an appointment"}],
        "max_turns": 8,
        "max_duration_seconds": 60,
    },
    {
        "name": "Restaurant with dietary needs",
        "category": "booking",
        "difficulty": "medium",
        "description": "Book a table for 4 at an Italian restaurant downtown this Friday at 7pm. You have a severe nut allergy.",
        "system_prompt": "You are a restaurant booking assistant for BookTable. Help customers find and book restaurants. Downtown Italian restaurants: Bella Vita (nut-free kitchen available), Trattoria Roma (cannot guarantee nut-free), Il Giardino (fully nut-free menu). Ask for party size, date, time, and any dietary needs. Confirm all details before booking.",
        "required_slots": {"party_size": "4", "cuisine": "Italian", "location": "downtown", "date": "Friday", "time": "7pm", "dietary": "nut allergy"},
        "success_criteria": "Agent books at a restaurant that accommodates nut allergies, for 4 people, on Friday around 7pm, and confirms the booking.",
        "tools_available": [{"name": "search_restaurants", "description": "Search for restaurants"}, {"name": "check_availability", "description": "Check table availability"}, {"name": "make_reservation", "description": "Make a reservation"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Hotel reservation with preferences",
        "category": "booking",
        "difficulty": "medium",
        "description": "Book a hotel room downtown for 2 nights starting this Saturday. You want a king bed and late checkout.",
        "system_prompt": "You are a hotel booking assistant for StayEasy. Downtown hotels: Grand Plaza ($189/night, king available, late checkout $30 extra), City Inn ($129/night, king available, no late checkout), Luxury Suites ($299/night, king standard, complimentary late checkout). Help the customer find the right hotel and book.",
        "required_slots": {"check_in": "Saturday", "nights": "2", "bed_type": "king", "late_checkout": "yes"},
        "success_criteria": "Agent books a hotel with king bed for 2 nights starting Saturday, addresses late checkout preference.",
        "tools_available": [{"name": "search_hotels", "description": "Search for hotels"}, {"name": "book_room", "description": "Book a hotel room"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Flight rebooking",
        "category": "booking",
        "difficulty": "hard",
        "description": "Your flight tomorrow at 8am was cancelled. You need to rebook for the same destination (Chicago). You prefer a direct flight and window seat, departing before noon.",
        "system_prompt": "You are an airline rebooking agent for SkyWay Airlines. The customer's flight SW201 (8am to Chicago) was cancelled due to weather. Available flights tomorrow to Chicago: SW305 (10:30am, direct, window available, $0 change fee), SW412 (11:45am, 1 stop in Denver, window available, $0 change fee), SW518 (2pm, direct, aisle only, $0 change fee). Help rebook and confirm all details including seat preference.",
        "required_slots": {"destination": "Chicago", "departure": "before noon", "seat": "window", "flight_type": "direct"},
        "success_criteria": "Agent rebooks on a suitable flight before noon with window seat, ideally direct.",
        "tools_available": [{"name": "search_flights", "description": "Search available flights"}, {"name": "rebook_flight", "description": "Rebook the customer's flight"}],
        "max_turns": 12,
        "max_duration_seconds": 120,
    },
    {
        "name": "Order status check",
        "category": "support",
        "difficulty": "easy",
        "description": "Check the status of your recent order #78432. You ordered it 3 days ago.",
        "system_prompt": "You are a customer support agent for ShopFast. Order #78432: placed 3 days ago, 2 items (wireless headphones, phone case), shipped yesterday via FedEx, tracking #FX9876543, estimated delivery in 2 days. Provide order status clearly and offer the tracking number.",
        "required_slots": {"order_number": "78432"},
        "success_criteria": "Agent provides order status, shipping info, and tracking number.",
        "tools_available": [{"name": "lookup_order", "description": "Look up order by number"}],
        "max_turns": 6,
        "max_duration_seconds": 45,
    },
    {
        "name": "Return with missing receipt",
        "category": "support",
        "difficulty": "medium",
        "description": "You want to return a jacket you bought 2 weeks ago but lost the receipt. You paid with a credit card.",
        "system_prompt": "You are a returns specialist for FashionMart. Policy: returns within 30 days with receipt for full refund. Without receipt: can look up by credit card (last 4 digits + approximate date), then issue store credit. Ask for item description, approximate purchase date, and last 4 digits of card. If found, process the return for store credit.",
        "required_slots": {"item": "jacket", "purchase_date": "2 weeks ago", "card_last4": "any"},
        "success_criteria": "Agent looks up the purchase by card, finds it, and processes return for store credit.",
        "tools_available": [{"name": "lookup_purchase", "description": "Look up purchase by card"}, {"name": "process_return", "description": "Process a return"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Billing dispute - double charge",
        "category": "support",
        "difficulty": "hard",
        "description": "You were charged twice for your monthly subscription ($49.99 each). You're frustrated and want a refund for the duplicate charge.",
        "system_prompt": "You are a billing support agent for CloudServe. The customer's account shows two charges of $49.99 on the same day — this was a known billing system glitch affecting some customers. Policy: acknowledge the error, apologize sincerely, process immediate refund for the duplicate charge, and offer a $10 credit for the inconvenience. Be empathetic but professional. Do not be defensive.",
        "required_slots": {"issue": "double charge", "amount": "49.99"},
        "success_criteria": "Agent acknowledges the duplicate charge, apologizes, processes refund, and offers the $10 courtesy credit.",
        "tools_available": [{"name": "check_billing", "description": "Check billing history"}, {"name": "process_refund", "description": "Process a refund"}, {"name": "apply_credit", "description": "Apply account credit"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Store hours and directions",
        "category": "info_retrieval",
        "difficulty": "easy",
        "description": "Ask about the store's Sunday hours and how to get there from downtown.",
        "system_prompt": "You are a store information assistant for MegaMart on Oak Street. Hours: Mon-Sat 8am-9pm, Sunday 10am-6pm. Location: 456 Oak Street, 2 miles north of downtown. From downtown: take Main Street north, turn right on Oak, store is on the left. Parking: free lot with 200 spaces. Nearest bus stop: Route 7, Oak & Elm stop.",
        "required_slots": {"info_type": "hours"},
        "success_criteria": "Agent provides Sunday hours and directions from downtown.",
        "tools_available": [],
        "max_turns": 6,
        "max_duration_seconds": 45,
    },
    {
        "name": "Product comparison",
        "category": "info_retrieval",
        "difficulty": "medium",
        "description": "Compare the Basic and Premium subscription plans. You want to know the main differences, especially regarding storage and support.",
        "system_prompt": "You are a sales assistant for DataVault. Plans: Basic ($9.99/mo, 100GB storage, email support, 5 user seats, standard encryption) vs Premium ($24.99/mo, 1TB storage, priority phone+email support, unlimited seats, advanced encryption, API access, custom integrations). Annual billing saves 20%. Help the customer understand which plan fits their needs.",
        "required_slots": {},
        "success_criteria": "Agent clearly explains storage and support differences between Basic and Premium plans.",
        "tools_available": [],
        "max_turns": 8,
        "max_duration_seconds": 60,
    },
    {
        "name": "Router troubleshooting guide",
        "category": "info_retrieval",
        "difficulty": "hard",
        "description": "Your internet is not working. You need help troubleshooting your router step by step.",
        "system_prompt": "You are a technical support agent for NetConnect ISP. Troubleshooting steps: 1) Check if router lights are on (power, internet, WiFi). 2) If power light is off, check power cable connection. 3) If internet light is off/red, unplug router for 30 seconds then plug back in. 4) Wait 2 minutes for lights to stabilize. 5) If still no internet light, check coaxial/ethernet cable from wall. 6) Try connecting directly via ethernet cable to rule out WiFi issues. 7) If still not working, there may be an outage — check status page or schedule technician visit. Walk through each step, wait for the customer to report results before moving to the next step.",
        "required_slots": {},
        "success_criteria": "Agent walks through troubleshooting steps sequentially, waiting for customer feedback at each step.",
        "tools_available": [{"name": "check_outage", "description": "Check for service outages in the area"}],
        "max_turns": 15,
        "max_duration_seconds": 120,
    },
]
```

### Seed function additions:

Add imports for `AgentConfiguration` and update `Scenario`.

In the `seed()` function, after the STT clips section:

```python
    # --- Agent Configurations ---
    from app.models.agent_configuration import AgentConfiguration
    for ac in AGENT_CONFIGS:
        existing = await session.get(AgentConfiguration, ac["id"])
        if not existing:
            session.add(AgentConfiguration(**ac))

    # --- Agent Scenarios (update existing + add new) ---
    for sc in AGENT_SCENARIOS:
        # Check if scenario with this name exists
        result = await session.execute(
            select(Scenario).where(Scenario.name == sc["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.system_prompt = sc.get("system_prompt")
            existing.required_slots = sc.get("required_slots")
            existing.success_criteria = sc.get("success_criteria")
            existing.tools_available = sc.get("tools_available")
            existing.max_turns = sc.get("max_turns", 10)
            existing.max_duration_seconds = sc.get("max_duration_seconds", 120)
        else:
            session.add(Scenario(**{k: v for k, v in sc.items()}))

    await session.commit()
    print(f"Seeded {len(AGENT_CONFIGS)} agent configs and {len(AGENT_SCENARIOS)} agent scenarios")
```

**Commit:** `feat: seed agent configurations and scenarios`

---

## Task 10: Frontend API Client

**Files:**
- Modify: `packages/arena/src/api/client.ts`

Add agent interfaces and API methods after the STT section.

### Interfaces:

```typescript
// ---- Agent types ----
export interface AgentScenario {
  id: string
  name: string
  category: string
  difficulty: string
  description: string
  max_turns: number | null
  max_duration_seconds: number | null
}

export interface AgentConfig {
  id: string
  name: string
  architecture_type: string
  provider: string
  components: Record<string, string>
}

export interface AgentBattleSetup {
  id: string
  battle_type: string
  scenario: AgentScenario
  config_a: AgentConfig
  config_b: AgentConfig
  agent_battle_id: string
}

export interface AgentConversationTurn {
  role: string
  text: string | null
  start_ms?: number
  end_ms?: number
  latency_ms?: number
}

export interface AgentConversationEnd {
  type: 'conversation_ended'
  conversation_id: string
  total_turns: number
  duration_seconds: number
  transcript: AgentConversationTurn[]
}

export interface AgentModelMetrics {
  agent_label: string
  config_name: string
  provider: string
  components: Record<string, string>
  total_turns: number | null
  duration_seconds: number | null
  avg_latency_ms: number | null
  p50_latency_ms: number | null
  p95_latency_ms: number | null
  task_success: boolean | null
  joint_goal_accuracy: number | null
  containment: boolean | null
}

export interface AgentMetrics {
  status: string
  scenario_name: string | null
  metrics_a: AgentModelMetrics | null
  metrics_b: AgentModelMetrics | null
  automated_eval: Record<string, unknown> | null
}
```

### API methods:

Add to the `api` object:

```typescript
agent: {
  setup: () =>
    request<AgentBattleSetup>('/battles/generate', {
      method: 'POST',
      body: JSON.stringify({ battle_type: 'agent' }),
    }),
  getMetrics: (battleId: string) =>
    request<AgentMetrics>(`/battles/${battleId}/agent-metrics`),
  getStreamUrl: (battleId: string, agent: 'a' | 'b') => {
    const wsBase = API_BASE.replace(/^http/, 'ws')
    return `${wsBase}/battles/${battleId}/agent-stream?agent=${agent}`
  },
},
```

**Commit:** `feat: API client agent types and methods`

---

## Task 11: ScenarioCard Component

**Files:**
- Create: `packages/arena/src/components/ScenarioCard.tsx`

```typescript
import { motion } from 'framer-motion'
import { ClipboardList, Zap, Clock } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  booking: '#6366f1',
  support: '#f59e0b',
  info_retrieval: '#10b981',
}

const CATEGORY_LABELS: Record<string, string> = {
  booking: 'Booking',
  support: 'Customer Support',
  info_retrieval: 'Information',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
}

interface ScenarioCardProps {
  name: string
  category: string
  difficulty: string
  description: string
  maxTurns: number | null
  maxDuration: number | null
}

export default function ScenarioCard({
  name,
  category,
  difficulty,
  description,
  maxTurns,
  maxDuration,
}: ScenarioCardProps) {
  const catColor = CATEGORY_COLORS[category] || '#888899'
  const catLabel = CATEGORY_LABELS[category] || category
  const diffColor = DIFFICULTY_COLORS[difficulty] || '#888899'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border-default bg-bg-secondary p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: catColor, backgroundColor: `${catColor}18` }}
          >
            {catLabel}
          </span>
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: diffColor, backgroundColor: `${diffColor}18` }}
          >
            {difficulty}
          </span>
        </div>
      </div>

      <p className="text-sm text-text-body leading-relaxed mb-4">{description}</p>

      <div className="flex items-center gap-4 text-text-faint">
        {maxTurns && (
          <div className="flex items-center gap-1">
            <Zap size={12} />
            <span className="text-xs font-[family-name:var(--font-mono)]">
              Max {maxTurns} turns
            </span>
          </div>
        )}
        {maxDuration && (
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span className="text-xs font-[family-name:var(--font-mono)]">
              {maxDuration}s limit
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
```

**Commit:** `feat: ScenarioCard component`

---

## Task 12: AgentConversation Component

**Files:**
- Create: `packages/arena/src/components/AgentConversation.tsx`

This is the core real-time conversation component. It manages the WebSocket connection, streams raw PCM audio from the microphone via AudioWorklet, receives and plays agent audio, and shows a live transcript.

```typescript
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'
import WaveformVisualizer from './WaveformVisualizer'
import type { AgentConversationTurn, AgentConversationEnd } from '../api/client'

interface AgentConversationProps {
  wsUrl: string
  label: string
  color: string
  maxDuration: number
  onConversationEnd: (data: AgentConversationEnd) => void
  onError: (error: string) => void
}

type ConvState = 'connecting' | 'active' | 'ending' | 'ended'

export default function AgentConversation({
  wsUrl,
  label,
  color,
  maxDuration,
  onConversationEnd,
  onError,
}: AgentConversationProps) {
  const [state, setState] = useState<ConvState>('connecting')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [transcript, setTranscript] = useState<AgentConversationTurn[]>([])
  const [isMuted, setIsMuted] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playbackQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (workletRef.current) {
      workletRef.current.disconnect()
      workletRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const endConversation = useCallback(() => {
    if (state === 'ending' || state === 'ended') return
    setState('ending')
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_conversation' }))
    }
  }, [state])

  // Play agent audio from queue
  const playNextChunk = useCallback(() => {
    if (!audioContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false
      return
    }
    isPlayingRef.current = true
    const samples = playbackQueueRef.current.shift()!
    const buffer = audioContextRef.current.createBuffer(1, samples.length, 16000)
    buffer.copyToChannel(samples, 0)
    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(audioContextRef.current.destination)
    source.onended = () => playNextChunk()
    source.start()
  }, [])

  // Initialize WebSocket + audio
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Get mic access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
        })
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream

        // Create AudioContext
        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx

        // Connect mic to AudioWorklet for raw PCM capture
        const source = ctx.createMediaStreamSource(stream)

        // Use ScriptProcessorNode as fallback (AudioWorklet requires HTTPS)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (e) => {
          if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
          const inputData = e.inputBuffer.getChannelData(0)
          // Convert float32 to int16
          const int16 = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          wsRef.current.send(int16.buffer)
        }
        source.connect(processor)
        processor.connect(ctx.destination) // Required for ScriptProcessor to work

        // Open WebSocket
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.binaryType = 'arraybuffer'

        ws.onopen = () => {
          if (!mounted) return
          setState('active')
          // Start elapsed timer
          timerRef.current = setInterval(() => {
            setElapsedMs((prev) => {
              const next = prev + 100
              if (next >= maxDuration * 1000) {
                endConversation()
              }
              return next
            })
          }, 100)
        }

        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Agent audio — PCM16 bytes
            const int16 = new Int16Array(event.data)
            const float32 = new Float32Array(int16.length)
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 0x8000
            }
            playbackQueueRef.current.push(float32)
            if (!isPlayingRef.current) playNextChunk()
          } else {
            // JSON control message
            try {
              const msg = JSON.parse(event.data)
              if (msg.type === 'session_started') {
                // Session confirmed
              } else if (msg.type === 'clear') {
                // Interrupt — clear playback queue
                playbackQueueRef.current = []
              } else if (msg.type === 'conversation_ended') {
                setState('ended')
                cleanup()
                onConversationEnd(msg as AgentConversationEnd)
              } else if (msg.type === 'timeout') {
                setState('ended')
                cleanup()
                onConversationEnd({
                  type: 'conversation_ended',
                  conversation_id: '',
                  total_turns: transcript.length,
                  duration_seconds: elapsedMs / 1000,
                  transcript,
                })
              } else if (msg.type === 'error') {
                onError(msg.message || 'Connection error')
                cleanup()
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        ws.onerror = () => {
          if (mounted) onError('WebSocket connection failed')
        }

        ws.onclose = () => {
          if (mounted && state !== 'ended') {
            setState('ended')
            cleanup()
          }
        }
      } catch (e) {
        if (mounted) {
          onError(e instanceof Error ? e.message : 'Failed to access microphone')
        }
      }
    }

    init()

    return () => {
      mounted = false
      cleanup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000)
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins}:${rem.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden"
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: `2px solid ${color}30` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-text-primary">{label}</span>
          {state === 'connecting' && (
            <Loader2 size={14} className="animate-spin text-text-faint" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-[family-name:var(--font-mono)] text-text-faint">
            {formatTime(elapsedMs)}
          </span>
          {state === 'active' && (
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-accent uppercase tracking-wider animate-pulse">
              Live
            </span>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div className="px-5 py-4 flex justify-center">
        <WaveformVisualizer
          playing={state === 'active'}
          color={color}
          height={50}
          bars={32}
        />
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="px-5 max-h-[200px] overflow-y-auto space-y-2"
      >
        {transcript.map((turn, i) => (
          <div key={i} className="flex gap-2">
            <span
              className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider shrink-0 mt-0.5"
              style={{ color: turn.role === 'agent' ? color : '#888899' }}
            >
              {turn.role === 'agent' ? 'Agent' : 'You'}
            </span>
            <p className="text-xs text-text-body leading-relaxed">{turn.text}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
            isMuted
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-bg-primary text-text-body border border-border-default hover:border-border-strong'
          }`}
          disabled={state !== 'active'}
        >
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          onClick={endConversation}
          disabled={state !== 'active'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-40"
        >
          <PhoneOff size={14} />
          End Conversation
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-primary">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${Math.min((elapsedMs / (maxDuration * 1000)) * 100, 100)}%`,
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      </div>
    </motion.div>
  )
}
```

**Commit:** `feat: AgentConversation real-time WebSocket component`

---

## Task 13: ConversationSummary + AgentSubDimensionVoter

**Files:**
- Create: `packages/arena/src/components/ConversationSummary.tsx`
- Create: `packages/arena/src/components/AgentSubDimensionVoter.tsx`

### `ConversationSummary.tsx`

```typescript
import { motion } from 'framer-motion'
import { MessageSquare, Clock, CheckCircle } from 'lucide-react'

interface ConversationSummaryProps {
  label: string
  color: string
  totalTurns: number
  durationSeconds: number
}

export default function ConversationSummary({
  label,
  color,
  totalTurns,
  durationSeconds,
}: ConversationSummaryProps) {
  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = Math.round(s % 60)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-border-default bg-bg-secondary p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <CheckCircle size={14} className="text-accent" />
      </div>
      <div className="flex items-center gap-4 text-text-faint">
        <div className="flex items-center gap-1">
          <MessageSquare size={12} />
          <span className="text-xs font-[family-name:var(--font-mono)]">
            {totalTurns} turns
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span className="text-xs font-[family-name:var(--font-mono)]">
            {formatDuration(durationSeconds)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
```

### `AgentSubDimensionVoter.tsx`

```typescript
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface AgentSubDimensionVoterProps {
  onSubVotesChange: (subVotes: Record<string, string>) => void
}

const DIMENSIONS = [
  { key: 'naturalness', label: 'Which sounded more human?' },
  { key: 'speed', label: 'Which felt more responsive?' },
  { key: 'understanding', label: 'Which understood you better?' },
  { key: 'helpfulness', label: 'Which was more helpful?' },
]

const COLORS: Record<string, string> = {
  a: '#6366f1',
  b: '#f59e0b',
  tie: '#888899',
}

export default function AgentSubDimensionVoter({ onSubVotesChange }: AgentSubDimensionVoterProps) {
  const [expanded, setExpanded] = useState(false)
  const [votes, setVotes] = useState<Record<string, string>>({})

  function handleVote(dimension: string, choice: string) {
    const updated = { ...votes, [dimension]: choice }
    setVotes(updated)
    onSubVotesChange(updated)
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-text-faint hover:text-text-body transition-colors"
      >
        <span className="text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
          Help us rank better (optional)
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-4 space-y-3"
        >
          {DIMENSIONS.map((dim) => (
            <div key={dim.key}>
              <p className="text-xs text-text-body mb-2">{dim.label}</p>
              <div className="flex gap-2">
                {['a', 'b', 'tie'].map((choice) => {
                  const isActive = votes[dim.key] === choice
                  const c = COLORS[choice]
                  return (
                    <button
                      key={choice}
                      onClick={() => handleVote(dim.key, choice)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: isActive ? `${c}18` : 'transparent',
                        borderColor: isActive ? c : '#282A3A',
                        color: isActive ? c : '#888899',
                      }}
                    >
                      {choice === 'tie' ? 'Tie' : `Agent ${choice.toUpperCase()}`}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
```

**Commit:** `feat: ConversationSummary and AgentSubDimensionVoter components`

---

## Task 14: AgentBattlePage

**Files:**
- Create: `packages/arena/src/pages/AgentBattlePage.tsx`
- Modify: `packages/arena/src/pages/BattlePage.tsx` (add routing)

### `AgentBattlePage.tsx`

The main page component with the full agent battle state machine:

```
idle → briefing → conversing_a → transition → conversing_b → voting → revealed
```

```typescript
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Share2,
  ArrowRight,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import ScenarioCard from '../components/ScenarioCard'
import AgentConversation from '../components/AgentConversation'
import ConversationSummary from '../components/ConversationSummary'
import AgentSubDimensionVoter from '../components/AgentSubDimensionVoter'
import VoteButton from '../components/VoteButton'
import { ModeSelector, type BattleMode } from '../components/ModeSelector'
import {
  api,
  type AgentBattleSetup,
  type AgentConversationEnd,
  type AgentMetrics,
} from '../api/client'

type AgentState = 'idle' | 'briefing' | 'conversing_a' | 'transition' | 'conversing_b' | 'voting' | 'revealed'
type VoteChoice = 'a' | 'b' | 'tie' | null

const COLORS = { a: '#6366f1', b: '#f59e0b' }

export default function AgentBattlePage({
  onModeChange,
  battleCount: externalBattleCount,
}: {
  onModeChange: (mode: BattleMode) => void
  battleCount: number
}) {
  const [state, setState] = useState<AgentState>('idle')
  const [setup, setSetup] = useState<AgentBattleSetup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [battleCount, setBattleCount] = useState(externalBattleCount)

  // Conversation summaries
  const [convA, setConvA] = useState<AgentConversationEnd | null>(null)
  const [convB, setConvB] = useState<AgentConversationEnd | null>(null)

  // Voting
  const [voted, setVoted] = useState<VoteChoice>(null)
  const [voting, setVoting] = useState(false)
  const [subVotes, setSubVotes] = useState<Record<string, string>>({})

  // Metrics
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null)
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize battle
  const initBattle = useCallback(async () => {
    setState('idle')
    setSetup(null)
    setError(null)
    setConvA(null)
    setConvB(null)
    setVoted(null)
    setVoting(false)
    setSubVotes({})
    setMetrics(null)

    try {
      const data = await api.agent.setup()
      setSetup(data)
      setState('briefing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize battle')
    }
  }, [])

  useEffect(() => {
    initBattle()
    return () => {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current)
    }
  }, [initBattle])

  // Handle conversation A end
  function handleConvAEnd(data: AgentConversationEnd) {
    setConvA(data)
    setState('transition')
  }

  // Handle conversation B end
  function handleConvBEnd(data: AgentConversationEnd) {
    setConvB(data)
    setState('voting')
  }

  // Handle vote
  async function handleVote(choice: VoteChoice) {
    if (!setup || !choice || voting) return
    setVoting(true)
    try {
      await api.battles.vote(setup.id, choice, Object.keys(subVotes).length > 0 ? subVotes : undefined)
      setVoted(choice)
      setState('revealed')
      // Start metrics polling
      pollMetrics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vote failed')
    } finally {
      setVoting(false)
    }
  }

  function pollMetrics() {
    if (!setup) return
    const poll = async () => {
      try {
        const data = await api.agent.getMetrics(setup.id)
        setMetrics(data)
        if (data.status === 'complete' && metricsIntervalRef.current) {
          clearInterval(metricsIntervalRef.current)
          metricsIntervalRef.current = null
        }
      } catch {
        // Silently retry
      }
    }
    poll()
    metricsIntervalRef.current = setInterval(poll, 2000)
  }

  function handleNextBattle() {
    setBattleCount((c) => c + 1)
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
      metricsIntervalRef.current = null
    }
    initBattle()
  }

  function handleConvError(msg: string) {
    setError(msg)
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-4xl mx-auto px-6 pt-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <ModeSelector active="agent" onChange={onModeChange} />
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2 text-text-faint">
                <Zap size={14} />
                <span className="font-[family-name:var(--font-mono)] text-xs">
                  Battle #{battleCount + 1}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="text-text-faint hover:text-text-body transition-colors"
            title="Share battle"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3"
          >
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Loading */}
        {state === 'idle' && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}

        {/* Briefing — show scenario + start button */}
        {state === 'briefing' && setup && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <div className="text-center">
              <p className="text-sm text-text-faint mb-4">
                You'll have two separate conversations with two different agents on this task. After both, vote on which handled it better.
              </p>
              <button
                onClick={() => setState('conversing_a')}
                className="px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                Talk to Agent A
              </button>
            </div>
          </motion.div>
        )}

        {/* Conversing A */}
        {state === 'conversing_a' && setup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <AgentConversation
              wsUrl={api.agent.getStreamUrl(setup.id, 'a')}
              label="Agent A"
              color={COLORS.a}
              maxDuration={setup.scenario.max_duration_seconds || 120}
              onConversationEnd={handleConvAEnd}
              onError={handleConvError}
            />
          </motion.div>
        )}

        {/* Transition — A done, ready for B */}
        {state === 'transition' && setup && convA && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <ConversationSummary
              label="Agent A"
              color={COLORS.a}
              totalTurns={convA.total_turns}
              durationSeconds={convA.duration_seconds}
            />
            <div className="text-center">
              <p className="text-sm text-text-faint mb-4">
                Now try the same task with Agent B.
              </p>
              <button
                onClick={() => setState('conversing_b')}
                className="px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                Talk to Agent B
              </button>
            </div>
          </motion.div>
        )}

        {/* Conversing B */}
        {state === 'conversing_b' && setup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <div className="grid grid-cols-2 gap-4">
              <ConversationSummary
                label="Agent A"
                color={COLORS.a}
                totalTurns={convA?.total_turns || 0}
                durationSeconds={convA?.duration_seconds || 0}
              />
              <div className="rounded-xl border-2 border-dashed border-accent/30 flex items-center justify-center">
                <span className="text-xs text-accent font-[family-name:var(--font-mono)] uppercase tracking-wider">
                  In progress
                </span>
              </div>
            </div>
            <AgentConversation
              wsUrl={api.agent.getStreamUrl(setup.id, 'b')}
              label="Agent B"
              color={COLORS.b}
              maxDuration={setup.scenario.max_duration_seconds || 120}
              onConversationEnd={handleConvBEnd}
              onError={handleConvError}
            />
          </motion.div>
        )}

        {/* Voting */}
        {state === 'voting' && setup && convA && convB && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">
              Which agent handled the task better?
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <ConversationSummary
                label="Agent A"
                color={COLORS.a}
                totalTurns={convA.total_turns}
                durationSeconds={convA.duration_seconds}
              />
              <ConversationSummary
                label="Agent B"
                color={COLORS.b}
                totalTurns={convB.total_turns}
                durationSeconds={convB.duration_seconds}
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <VoteButton label="Agent A" active={voted === 'a'} color={COLORS.a} disabled={voting} onClick={() => handleVote('a')} />
              <VoteButton label="Agent B" active={voted === 'b'} color={COLORS.b} disabled={voting} onClick={() => handleVote('b')} />
              <VoteButton label="Tie" active={voted === 'tie'} color="#888899" disabled={voting} onClick={() => handleVote('tie')} />
            </div>

            <AgentSubDimensionVoter onSubVotesChange={setSubVotes} />
          </motion.div>
        )}

        {/* Revealed */}
        {state === 'revealed' && setup && metrics && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Battle Results</h2>

            {/* Agent details */}
            <div className="grid grid-cols-2 gap-4">
              {[metrics.metrics_a, metrics.metrics_b].map((m) => {
                if (!m) return null
                const color = m.agent_label === 'a' ? COLORS.a : COLORS.b
                const isWinner = voted === m.agent_label
                return (
                  <motion.div
                    key={m.agent_label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border bg-bg-secondary p-4"
                    style={{ borderColor: isWinner ? color : '#282A3A' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold text-text-primary">
                        Agent {m.agent_label.toUpperCase()}
                        {isWinner && ' (Winner)'}
                      </span>
                    </div>
                    <p className="text-xs text-accent font-[family-name:var(--font-mono)] mb-2">
                      {m.config_name}
                    </p>
                    <p className="text-xs text-text-faint mb-3">
                      {m.provider} &middot; {m.components.stt} + {m.components.llm} + {m.components.tts}
                    </p>
                    <div className="space-y-1 text-xs font-[family-name:var(--font-mono)] text-text-body">
                      {m.total_turns != null && <p>Turns: {m.total_turns}</p>}
                      {m.duration_seconds != null && <p>Duration: {m.duration_seconds.toFixed(1)}s</p>}
                      {m.avg_latency_ms != null && <p>Avg latency: {m.avg_latency_ms.toFixed(0)}ms</p>}
                      {m.task_success != null && (
                        <p>
                          Task success:{' '}
                          <span className={m.task_success ? 'text-green-400' : 'text-red-400'}>
                            {m.task_success ? 'Yes' : 'No'}
                          </span>
                        </p>
                      )}
                      {m.joint_goal_accuracy != null && (
                        <p>Goal accuracy: {(m.joint_goal_accuracy * 100).toFixed(0)}%</p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Evaluation status */}
            {metrics.status !== 'complete' && (
              <div className="flex items-center gap-2 justify-center text-text-faint">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs font-[family-name:var(--font-mono)]">
                  Running automated evaluation...
                </span>
              </div>
            )}

            {/* Next battle */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleNextBattle}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                Next Battle
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Revealed but metrics not yet loaded — show basic reveal */}
        {state === 'revealed' && setup && !metrics && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}
      </div>
    </div>
  )
}
```

### Update `BattlePage.tsx`

Add import at top:
```typescript
import AgentBattlePage from './AgentBattlePage'
```

Add routing after the STT routing (after the `if (battleMode === 'stt')` block):
```typescript
if (battleMode === 'agent') {
  return <AgentBattlePage onModeChange={handleModeChange} battleCount={battleCount} />
}
```

**Commit:** `feat: AgentBattlePage with full battle flow`

---

## Task 15: Enable Agent in ModeSelector

**Files:**
- Modify: `packages/arena/src/components/ModeSelector.tsx`

Change Agent mode from `enabled: false` to `enabled: true` (line 42).

**Commit:** `feat: enable Agent mode in ModeSelector`

---

## Task 16: End-to-End Verification

**Backend:**
- `POST /api/v1/battles/generate` with `{"battle_type": "agent"}` returns `AgentBattleSetupResponse` with scenario + 2 agent configs
- `WS /api/v1/battles/{id}/agent-stream?agent=a` connects and proxies audio
- `GET /api/v1/battles/{id}/agent-metrics` returns progressive metrics
- TTS/S2S/STT battles still work unchanged
- Seed script runs without errors

**Frontend:**
- `npx tsc --noEmit` passes (from `packages/arena/`)
- `npm run build` succeeds
- Navigate to `/battle`, switch to Agent mode
- Scenario card appears with task description
- "Talk to Agent A" initiates WebSocket conversation
- Conversation shows waveform, live transcript, end button
- Transition shows summary, "Talk to Agent B" button
- After both, voting with sub-dimensions works
- Reveal shows provider names, architecture, metrics

**Error handling:**
- Mic permission denied → shows error
- Provider WebSocket fails → shows connection error
- Conversation timeout → auto-ends with summary
- Agent configs missing → shows "run seed script" error

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Settings: Vapi/Retell API keys | 1 modified |
| 2 | DB models + migration | 4 created, 2 modified |
| 3 | Agent Pydantic schemas | 1 created |
| 4 | Agent adapter base + Vapi adapter | 3 created |
| 5 | Retell adapter | 1 created, 1 modified |
| 6 | WebSocket proxy endpoint | 1 created, 1 modified |
| 7 | Agent battle generation | 1 modified |
| 8 | Metrics + evaluation | 1 created, 1 modified |
| 9 | Seed agent data | 1 modified |
| 10 | Frontend API client | 1 modified |
| 11 | ScenarioCard component | 1 created |
| 12 | AgentConversation component | 1 created |
| 13 | ConversationSummary + SubDimensionVoter | 2 created |
| 14 | AgentBattlePage + routing | 1 created, 1 modified |
| 15 | Enable Agent in ModeSelector | 1 modified |
| 16 | E2E verification | — |

**New dependency:** None beyond what's already in the project (`websockets`, `httpx`).

**Total: ~15 new files, ~8 modified files, 16 commits.**
