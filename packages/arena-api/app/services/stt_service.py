"""STT service supporting multiple providers (OpenAI Whisper, Deepgram, AssemblyAI, Google Cloud)."""
import asyncio
import base64
import logging
import os
import time

import httpx

from app.config import settings

logger = logging.getLogger("arena.stt_service")


class STTProviderError(Exception):
    """Raised when an STT provider fails."""
    pass


async def transcribe_with_provider(
    audio_path: str,
    provider: str,
    model_id: str,
    config: dict,
) -> dict:
    """Transcribe audio using the specified STT provider.

    Returns:
        dict with: transcript, word_count, ttfb_ms, e2e_latency_ms
    """
    try:
        if provider == "openai":
            return await _transcribe_openai(audio_path, model_id, config)
        elif provider == "deepgram":
            return await _transcribe_deepgram(audio_path, model_id, config)
        elif provider == "assemblyai":
            return await _transcribe_assemblyai(audio_path, model_id, config)
        elif provider == "google":
            return await _transcribe_google(audio_path, model_id, config)
        else:
            raise STTProviderError(f"Unknown STT provider: {provider}")
    except STTProviderError:
        raise
    except Exception as e:
        raise STTProviderError(f"{provider} transcription failed: {e}") from e


async def _transcribe_openai(audio_path: str, model_id: str, config: dict) -> dict:
    """OpenAI Whisper API — POST multipart to /v1/audio/transcriptions."""
    start = time.perf_counter()

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f, "audio/webm")}
            data = {"model": model_id or "whisper-1"}
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files=files,
                data=data,
            )
    ttfb_ms = (time.perf_counter() - start) * 1000

    if resp.status_code != 200:
        raise STTProviderError(f"OpenAI Whisper error {resp.status_code}: {resp.text}")

    transcript = resp.json().get("text", "")
    e2e_ms = (time.perf_counter() - start) * 1000

    return {
        "transcript": transcript,
        "word_count": len(transcript.split()),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_ms, 1),
    }


async def _transcribe_deepgram(audio_path: str, model_id: str, config: dict) -> dict:
    """Deepgram Nova-2 — POST binary audio to /v1/listen."""
    start = time.perf_counter()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    ext = os.path.splitext(audio_path)[1].lower()
    content_types = {".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg"}
    content_type = content_types.get(ext, "audio/webm")

    params = {"model": model_id or "nova-2", "smart_format": "true"}

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": content_type,
            },
            params=params,
            content=audio_data,
        )
    ttfb_ms = (time.perf_counter() - start) * 1000

    if resp.status_code != 200:
        raise STTProviderError(f"Deepgram error {resp.status_code}: {resp.text}")

    result = resp.json()
    transcript = ""
    try:
        transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError):
        pass

    e2e_ms = (time.perf_counter() - start) * 1000

    return {
        "transcript": transcript,
        "word_count": len(transcript.split()),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_ms, 1),
    }


async def _transcribe_assemblyai(audio_path: str, model_id: str, config: dict) -> dict:
    """AssemblyAI — upload audio, create transcript, poll until complete."""
    start = time.perf_counter()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    headers = {"Authorization": settings.assemblyai_api_key}

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        # Step 1: Upload audio
        upload_resp = await client.post(
            "https://api.assemblyai.com/v2/upload",
            headers={**headers, "Content-Type": "application/octet-stream"},
            content=audio_data,
        )
        if upload_resp.status_code != 200:
            raise STTProviderError(f"AssemblyAI upload error {upload_resp.status_code}: {upload_resp.text}")
        upload_url = upload_resp.json()["upload_url"]

        ttfb_ms = (time.perf_counter() - start) * 1000

        # Step 2: Create transcript request
        transcript_resp = await client.post(
            "https://api.assemblyai.com/v2/transcript",
            headers=headers,
            json={"audio_url": upload_url},
        )
        if transcript_resp.status_code != 200:
            raise STTProviderError(f"AssemblyAI transcript error {transcript_resp.status_code}")
        transcript_id = transcript_resp.json()["id"]

        # Step 3: Poll until complete
        poll_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
        for _ in range(60):
            poll_resp = await client.get(poll_url, headers=headers)
            data = poll_resp.json()
            status = data.get("status")
            if status == "completed":
                transcript = data.get("text", "")
                e2e_ms = (time.perf_counter() - start) * 1000
                return {
                    "transcript": transcript,
                    "word_count": len(transcript.split()),
                    "ttfb_ms": round(ttfb_ms, 1),
                    "e2e_latency_ms": round(e2e_ms, 1),
                }
            elif status == "error":
                raise STTProviderError(f"AssemblyAI error: {data.get('error', 'unknown')}")
            await asyncio.sleep(0.5)

    raise STTProviderError("AssemblyAI transcription timed out")


async def _transcribe_google(audio_path: str, model_id: str, config: dict) -> dict:
    """Google Cloud STT v1 — REST API with API key."""
    start = time.perf_counter()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    ext = os.path.splitext(audio_path)[1].lower()
    encoding_map = {".webm": "WEBM_OPUS", ".wav": "LINEAR16", ".mp3": "MP3"}
    encoding = encoding_map.get(ext, "WEBM_OPUS")

    body = {
        "config": {
            "encoding": encoding,
            "languageCode": "en-US",
            "model": model_id or "latest_long",
            "enableAutomaticPunctuation": True,
        },
        "audio": {"content": base64.b64encode(audio_data).decode()},
    }

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        resp = await client.post(
            f"https://speech.googleapis.com/v1/speech:recognize?key={settings.google_cloud_api_key}",
            json=body,
        )
    ttfb_ms = (time.perf_counter() - start) * 1000

    if resp.status_code != 200:
        raise STTProviderError(f"Google STT error {resp.status_code}: {resp.text}")

    result = resp.json()
    transcript = ""
    try:
        for r in result.get("results", []):
            transcript += r["alternatives"][0]["transcript"] + " "
        transcript = transcript.strip()
    except (KeyError, IndexError):
        pass

    e2e_ms = (time.perf_counter() - start) * 1000

    return {
        "transcript": transcript,
        "word_count": len(transcript.split()),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_ms, 1),
    }
