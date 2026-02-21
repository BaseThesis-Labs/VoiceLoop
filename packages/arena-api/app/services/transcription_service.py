"""Whisper transcription service for S2S input audio."""
import logging

import httpx

from app.config import settings

logger = logging.getLogger("arena.transcription_service")


async def transcribe_audio(audio_path: str) -> str | None:
    """Transcribe audio file using OpenAI Whisper API.

    Args:
        audio_path: Path to the audio file to transcribe.

    Returns:
        Transcribed text or None on failure.
    """
    api_key = settings.openai_api_key
    if not api_key:
        logger.warning("OpenAI API key not configured, skipping transcription")
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            with open(audio_path, "rb") as f:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": (audio_path.split("/")[-1], f, "audio/wav")},
                    data={"model": "whisper-1"},
                )
            response.raise_for_status()
            return response.json().get("text")
    except Exception as e:
        logger.error("Whisper transcription failed: %s", e)
        return None
