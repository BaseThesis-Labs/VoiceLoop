"""Retell agent adapter -- manages voice agent sessions via the Retell REST + WebSocket APIs."""

import asyncio
import json
import logging
import time
import uuid

import httpx
import websockets

from app.config import settings
from app.services.agent_adapters.base import AgentAdapter, AgentSessionHandle

logger = logging.getLogger("arena.agent_adapters.retell")

RETELL_API_BASE = "https://api.retellai.com"


class RetellAdapter(AgentAdapter):
    """Adapter for the Retell conversational-AI platform."""

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def create_session(
        self,
        system_prompt: str,
        tools: list[dict] | None,
        config: dict,
    ) -> AgentSessionHandle:
        """Start a new Retell web call.

        ``config`` must contain:
            - agent_id (str): the pre-configured Retell agent ID

        Optional ``config`` keys:
            - metadata (dict): arbitrary metadata forwarded to Retell
        """
        api_key = settings.retell_api_key
        if not api_key:
            raise RuntimeError("Retell API key not configured")

        agent_id = config.get("agent_id")
        if not agent_id:
            raise ValueError("Retell adapter requires 'agent_id' in config")

        payload: dict = {
            "agent_id": agent_id,
        }

        # Apply optional overrides
        agent_override: dict = {}
        if system_prompt:
            agent_override["prompt"] = system_prompt
        if tools:
            agent_override["tools"] = tools
        if agent_override:
            payload["agent_override"] = agent_override

        metadata = config.get("metadata")
        if metadata:
            payload["metadata"] = metadata

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RETELL_API_BASE}/v2/create-web-call",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        call_id = data.get("call_id", str(uuid.uuid4()))
        access_token = data.get("access_token", "")

        ws_url = f"wss://api.retellai.com/audio-websocket/{call_id}?enable_update=true"

        session = AgentSessionHandle(
            session_id=call_id,
            provider="retell",
            started_at=time.time(),
        )
        session._ws_url = ws_url  # type: ignore[attr-defined]
        session._ws = None  # type: ignore[attr-defined]
        session._access_token = access_token  # type: ignore[attr-defined]

        logger.info("Retell session created: call_id=%s ws_url=%s", call_id, ws_url)
        return session

    async def get_ws_url(self, session: AgentSessionHandle) -> str:
        """Return the WebSocket URL for client-side connection."""
        return session._ws_url  # type: ignore[attr-defined]

    async def send_audio(self, session: AgentSessionHandle, audio_chunk: bytes) -> None:
        """Send raw PCM audio bytes over the session WebSocket."""
        ws = getattr(session, "_ws", None)
        if ws is None or ws.close_code is not None:
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

        Returns:
            - Raw audio bytes for binary frames.
            - ``b"__CLEAR__"`` marker when Retell sends a "clear" text frame
              (indicating the agent interrupted / restarted its response).
            - ``None`` on timeout or update-only control messages.
        """
        ws = getattr(session, "_ws", None)
        if ws is None or ws.close_code is not None:
            return None

        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=0.05)
        except asyncio.TimeoutError:
            return None
        except websockets.exceptions.ConnectionClosed:
            session.is_active = False
            return None

        # Binary frame -> audio
        if isinstance(msg, bytes):
            session.agent_audio_chunks.append(msg)
            return msg

        # Text frame
        text = msg.strip()

        # Retell sends the literal string "clear" to signal audio reset
        if text == "clear":
            logger.debug("Retell clear signal (session %s)", session.session_id)
            return b"__CLEAR__"

        # Otherwise expect JSON event
        self._handle_event(session, text)
        return None

    async def end_session(self, session: AgentSessionHandle) -> dict:
        """Close the Retell WebSocket and return a session summary."""
        ws = getattr(session, "_ws", None)
        if ws is not None and not ws.close_code is not None:
            try:
                await ws.close()
            except Exception:
                logger.exception("Error closing Retell WS (session %s)", session.session_id)

        session.is_active = False
        duration = time.time() - session.started_at if session.started_at else 0.0

        summary = {
            "session_id": session.session_id,
            "provider": "retell",
            "total_turns": len(session.turns),
            "duration_seconds": round(duration, 2),
            "turn_latencies": session.turn_latencies,
        }
        logger.info("Retell session ended: %s", summary)
        return summary

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def provider_name(self) -> str:
        return "retell"

    @property
    def architecture_type(self) -> str:
        return "pipeline"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _handle_event(self, session: AgentSessionHandle, raw: str) -> None:
        """Parse a JSON event from Retell and update session state."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.debug("Non-JSON text frame from Retell: %s", raw[:200])
            return

        event_type = msg.get("event_type", "")

        if event_type == "update":
            # The update event carries the full transcript array so far.
            transcript_list = msg.get("transcript", [])
            if isinstance(transcript_list, list):
                session.turns = [
                    {
                        "role": entry.get("role", "unknown"),
                        "text": entry.get("content", ""),
                        "timestamp": time.time(),
                    }
                    for entry in transcript_list
                ]
            logger.debug(
                "Retell transcript update: %d turns (session %s)",
                len(session.turns),
                session.session_id,
            )

            # Extract turn latencies from Retell metadata if available
            turnaround = msg.get("turnaround_time_ms")
            if turnaround is not None:
                session.turn_latencies.append(round(turnaround / 1000.0, 3))

        elif event_type == "call_ended":
            logger.info("Retell call_ended event (session %s)", session.session_id)
            session.is_active = False

        else:
            logger.debug(
                "Retell event_type=%s (session %s)", event_type, session.session_id
            )
