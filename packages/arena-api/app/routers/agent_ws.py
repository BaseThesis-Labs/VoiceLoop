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
from app.database import async_session as async_session_factory
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

    # Embed tool descriptions into system prompt instead of passing as provider tools
    # (these are simulated tools that can't actually be called)
    if tools:
        tool_lines = "\n".join(f"- {t['name']}: {t.get('description', '')}" for t in tools)
        system_prompt += f"\n\nYou have access to the following tools (simulate their use as needed):\n{tool_lines}"

    try:
        session = await adapter.create_session(system_prompt, None, config.config_json or {})
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
            logger.error("Browser->Provider error: %s", e)
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
                logger.error("Provider->Browser error: %s", e)
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
        agent_battle_updated = (await db.execute(
            select(AgentBattle).where(AgentBattle.battle_id == battle_id)
        )).scalar_one()
        if agent_label == "a":
            agent_battle_updated.conversation_a_id = conv_id
        else:
            agent_battle_updated.conversation_b_id = conv_id

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
