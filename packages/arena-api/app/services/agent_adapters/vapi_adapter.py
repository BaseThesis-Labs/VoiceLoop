"""Vapi agent adapter -- manages voice agent sessions via the Vapi REST + WebSocket APIs."""

import asyncio
import json
import logging
import time
import uuid

import httpx
import websockets

from app.config import settings
from app.services.agent_adapters.base import AgentAdapter, AgentSessionHandle

logger = logging.getLogger("arena.agent_adapters.vapi")

VAPI_API_BASE = "https://api.vapi.ai"


class VapiAdapter(AgentAdapter):
    """Adapter for the Vapi conversational-AI platform."""

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def create_session(
        self,
        system_prompt: str,
        tools: list[dict] | None,
        config: dict,
    ) -> AgentSessionHandle:
        """Start a new Vapi call with an inline assistant configuration.

        ``config`` may contain:
            - llm_model (str): e.g. "gpt-4o"
            - llm_provider (str): e.g. "openai"
            - tts_voice (str): voice identifier for the TTS provider
            - tts_provider (str): e.g. "cartesia", "elevenlabs"
            - stt_provider (str): e.g. "deepgram"
            - stt_model (str): STT model name
        """
        api_key = settings.vapi_api_key
        if not api_key:
            raise RuntimeError("Vapi API key not configured")

        # Build the inline assistant definition
        assistant_config: dict = {
            "firstMessage": "Hello, how can I help you today?",
            "model": {
                "provider": config.get("llm_provider", "openai"),
                "model": config.get("llm_model", "gpt-4o"),
                "messages": [
                    {"role": "system", "content": system_prompt},
                ],
            },
            "voice": {
                "provider": config.get("tts_provider", "cartesia"),
                "voiceId": config.get("tts_voice", "default"),
            },
            "transcriber": {
                "provider": config.get("stt_provider", "deepgram"),
                "model": config.get("stt_model", "nova-2"),
            },
        }

        if tools:
            assistant_config["model"]["tools"] = tools

        payload = {
            "assistant": assistant_config,
            "transport": {
                "provider": "websocket",
                "audioFormat": {
                    "encoding": "pcm_s16le",
                    "sampleRate": 16000,
                    "channels": 1,
                },
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{VAPI_API_BASE}/call",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        session_id = data.get("id", str(uuid.uuid4()))
        ws_url = data.get("websocketCallUrl", "")

        if not ws_url:
            raise RuntimeError("Vapi response did not include a websocketCallUrl")

        session = AgentSessionHandle(
            session_id=session_id,
            provider="vapi",
            started_at=time.time(),
        )
        # Attach provider-specific state via simple attributes
        session._ws_url = ws_url  # type: ignore[attr-defined]
        session._ws = None  # type: ignore[attr-defined]

        logger.info("Vapi session created: id=%s ws_url=%s", session_id, ws_url)
        return session

    async def get_ws_url(self, session: AgentSessionHandle) -> str:
        """Return the WebSocket URL for client-side connection."""
        return session._ws_url  # type: ignore[attr-defined]

    async def send_audio(self, session: AgentSessionHandle, audio_chunk: bytes) -> None:
        """Send a raw PCM audio chunk over the session WebSocket."""
        ws = getattr(session, "_ws", None)
        if ws is None or ws.closed:
            logger.warning("send_audio called but WS is not open (session %s)", session.session_id)
            return
        try:
            await ws.send(audio_chunk)
            session.user_audio_chunks.append(audio_chunk)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WS closed while sending audio (session %s)", session.session_id)
            session.is_active = False

    async def receive_audio(self, session: AgentSessionHandle) -> bytes | None:
        """Try to receive data from the WS with a short timeout.

        Returns raw audio bytes for binary frames, or ``None`` on timeout /
        control messages.
        """
        ws = getattr(session, "_ws", None)
        if ws is None or ws.closed:
            return None

        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=0.05)
        except asyncio.TimeoutError:
            return None
        except websockets.exceptions.ConnectionClosed:
            session.is_active = False
            return None

        if isinstance(msg, bytes):
            session.agent_audio_chunks.append(msg)
            return msg

        # Text frame -- treat as JSON control message
        self._handle_control_message(session, msg)
        return None

    async def end_session(self, session: AgentSessionHandle) -> dict:
        """Terminate the Vapi call and return a summary."""
        ws = getattr(session, "_ws", None)
        if ws is not None and not ws.closed:
            try:
                await ws.send(json.dumps({"type": "end-call"}))
                await ws.close()
            except Exception:
                logger.exception("Error closing Vapi WS (session %s)", session.session_id)

        session.is_active = False
        duration = time.time() - session.started_at if session.started_at else 0.0

        summary = {
            "session_id": session.session_id,
            "provider": "vapi",
            "total_turns": len(session.turns),
            "duration_seconds": round(duration, 2),
            "turn_latencies": session.turn_latencies,
        }
        logger.info("Vapi session ended: %s", summary)
        return summary

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def provider_name(self) -> str:
        return "vapi"

    @property
    def architecture_type(self) -> str:
        return "pipeline"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _handle_control_message(self, session: AgentSessionHandle, raw: str) -> None:
        """Parse a JSON control frame from Vapi and update session state."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.debug("Non-JSON text frame from Vapi: %s", raw[:200])
            return

        msg_type = msg.get("type", "")

        if msg_type == "transcript":
            turn = {
                "role": msg.get("role", "unknown"),
                "text": msg.get("transcript", ""),
                "timestamp": time.time(),
            }
            session.turns.append(turn)
            logger.debug("Vapi transcript turn: %s", turn)

        elif msg_type == "speech-update":
            # Vapi sends speech-update when user starts / stops speaking.
            # Useful for latency tracking.
            status = msg.get("status", "")
            if status == "started":
                session._speech_start = time.time()  # type: ignore[attr-defined]
            elif status == "stopped":
                start = getattr(session, "_speech_start", None)
                if start is not None:
                    latency = time.time() - start
                    session.turn_latencies.append(round(latency, 3))

        elif msg_type == "hang":
            logger.info("Vapi hang event received (session %s)", session.session_id)
            session.is_active = False

        else:
            logger.debug("Vapi control message type=%s (session %s)", msg_type, session.session_id)
