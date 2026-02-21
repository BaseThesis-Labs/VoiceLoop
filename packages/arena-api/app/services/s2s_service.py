"""S2S (Speech-to-Speech) service supporting OpenAI Realtime and Hume EVI providers."""
import asyncio
import base64
import json
import logging
import os
import struct
import subprocess
import time
import uuid

from app.config import settings

logger = logging.getLogger("arena.s2s_service")


class S2SProviderError(Exception):
    """Raised when an S2S provider fails (timeout, WS error, etc.)."""
    pass


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
async def generate_s2s(
    input_audio_path: str,
    provider: str,
    model_id: str,
    config: dict,
) -> dict:
    """Generate S2S audio response from a provider.

    Args:
        input_audio_path: Path to the input audio file (WAV or WebM).
        provider: S2S provider name ("openai" or "hume").
        model_id: Provider-specific model identifier.
        config: Provider-specific config dict (voice_id, etc.).

    Returns:
        dict with: audio_path, filename, duration_seconds, ttfb_ms, e2e_latency_ms
    """
    if provider == "openai":
        return await _generate_openai_realtime(input_audio_path, model_id, config)
    elif provider == "hume":
        return await _generate_hume_evi(input_audio_path, model_id, config)
    else:
        raise ValueError(f"Unknown S2S provider: {provider}")


# ---------------------------------------------------------------------------
# Audio conversion helper
# ---------------------------------------------------------------------------
def _convert_to_pcm(input_path: str, sample_rate: int = 24000) -> bytes:
    """Convert any audio file to raw PCM s16le mono at the given sample rate.

    Uses ffmpeg subprocess for format conversion (WebM -> PCM, etc.).
    Falls back to reading raw WAV data if ffmpeg is not available.
    """
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-i", input_path,
                "-f", "s16le", "-acodec", "pcm_s16le",
                "-ar", str(sample_rate), "-ac", "1",
                "-loglevel", "error",
                "pipe:1",
            ],
            capture_output=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout
    except FileNotFoundError:
        logger.warning("ffmpeg not found, attempting raw WAV read")

    # Fallback: read WAV data directly (skip 44-byte header)
    with open(input_path, "rb") as f:
        data = f.read()
    if data[:4] == b"RIFF":
        return data[44:]
    return data


# ---------------------------------------------------------------------------
# OpenAI Realtime implementation
# ---------------------------------------------------------------------------
async def _generate_openai_realtime(
    input_audio_path: str,
    model_id: str,
    config: dict,
) -> dict:
    """Generate S2S response using OpenAI Realtime API via WebSocket."""
    import websockets

    api_key = settings.openai_api_key
    if not api_key:
        raise S2SProviderError("OpenAI API key not configured")

    os.makedirs(settings.audio_storage_path, exist_ok=True)
    filename = f"{uuid.uuid4()}.wav"
    audio_path = os.path.join(settings.audio_storage_path, filename)

    sample_rate = 24000
    pcm_data = _convert_to_pcm(input_audio_path, sample_rate)

    ws_url = f"wss://api.openai.com/v1/realtime?model={model_id}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    start_time = time.perf_counter()
    first_byte_time = None
    audio_chunks: list[bytes] = []

    try:
        async with asyncio.timeout(settings.s2s_timeout_seconds + 5):
            async with websockets.connect(ws_url, additional_headers=headers) as ws:
                # Configure session
                voice_id = config.get("voice_id", "alloy")
                await ws.send(json.dumps({
                    "type": "session.update",
                    "session": {
                        "modalities": ["text", "audio"],
                        "voice": voice_id,
                        "input_audio_format": "pcm16",
                        "output_audio_format": "pcm16",
                        "input_audio_transcription": {"model": "whisper-1"},
                    },
                }))

                # Send input audio in chunks
                chunk_size = 8192
                for i in range(0, len(pcm_data), chunk_size):
                    chunk = pcm_data[i:i + chunk_size]
                    await ws.send(json.dumps({
                        "type": "input_audio_buffer.append",
                        "audio": base64.b64encode(chunk).decode(),
                    }))

                # Commit and request response
                await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
                await ws.send(json.dumps({"type": "response.create"}))

                # Collect response audio
                async for msg in ws:
                    event = json.loads(msg)
                    event_type = event.get("type", "")

                    if event_type == "response.audio.delta":
                        if first_byte_time is None:
                            first_byte_time = time.perf_counter()
                        audio_b64 = event.get("delta", "")
                        if audio_b64:
                            audio_chunks.append(base64.b64decode(audio_b64))

                    elif event_type == "response.audio.done":
                        break

                    elif event_type == "response.done":
                        break

                    elif event_type == "error":
                        error_msg = event.get("error", {}).get("message", "Unknown error")
                        raise S2SProviderError(f"OpenAI Realtime error: {error_msg}")

    except asyncio.TimeoutError:
        raise S2SProviderError(f"OpenAI Realtime timed out after {settings.s2s_timeout_seconds}s")
    except websockets.exceptions.WebSocketException as e:
        raise S2SProviderError(f"OpenAI Realtime WebSocket error: {e}")

    if not audio_chunks:
        raise S2SProviderError("OpenAI Realtime returned no audio data")

    if first_byte_time is None:
        first_byte_time = time.perf_counter()

    end_time = time.perf_counter()

    # Assemble audio and write WAV
    raw_audio = b"".join(audio_chunks)
    wav_header = _build_wav_header(len(raw_audio), sample_rate, 1, 16)
    with open(audio_path, "wb") as f:
        f.write(wav_header)
        f.write(raw_audio)

    duration_seconds = len(raw_audio) / (2 * sample_rate)
    ttfb_ms = (first_byte_time - start_time) * 1000
    e2e_latency_ms = (end_time - start_time) * 1000

    logger.info(
        "Generated S2S [openai]: model=%s duration=%.2fs ttfb=%.0fms e2e=%.0fms",
        model_id, duration_seconds, ttfb_ms, e2e_latency_ms,
    )

    return {
        "audio_path": audio_path,
        "filename": filename,
        "duration_seconds": round(duration_seconds, 2),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_latency_ms, 1),
    }


# ---------------------------------------------------------------------------
# Hume EVI implementation
# ---------------------------------------------------------------------------
async def _generate_hume_evi(
    input_audio_path: str,
    model_id: str,
    config: dict,
) -> dict:
    """Generate S2S response using Hume EVI API via WebSocket."""
    import websockets

    api_key = settings.hume_api_key
    if not api_key:
        raise S2SProviderError("Hume API key not configured")

    os.makedirs(settings.audio_storage_path, exist_ok=True)
    filename = f"{uuid.uuid4()}.wav"
    audio_path = os.path.join(settings.audio_storage_path, filename)

    sample_rate = 24000

    # Read input audio and base64-encode
    with open(input_audio_path, "rb") as f:
        input_bytes = f.read()
    input_b64 = base64.b64encode(input_bytes).decode()

    config_id = config.get("config_id")
    ws_url = f"wss://api.hume.ai/v0/evi/chat"
    if config_id:
        ws_url += f"?config_id={config_id}"

    headers = {
        "X-Hume-Api-Key": api_key,
    }

    start_time = time.perf_counter()
    first_byte_time = None
    audio_chunks: list[bytes] = []

    try:
        async with asyncio.timeout(settings.s2s_timeout_seconds + 5):
            async with websockets.connect(ws_url, additional_headers=headers) as ws:
                # Send audio input
                await ws.send(json.dumps({
                    "type": "audio_input",
                    "data": input_b64,
                }))

                # Collect response
                async for msg in ws:
                    event = json.loads(msg)
                    event_type = event.get("type", "")

                    if event_type == "audio_output":
                        if first_byte_time is None:
                            first_byte_time = time.perf_counter()
                        audio_b64 = event.get("data", "")
                        if audio_b64:
                            audio_chunks.append(base64.b64decode(audio_b64))

                    elif event_type == "assistant_end":
                        break

                    elif event_type == "error":
                        error_msg = event.get("message", "Unknown Hume error")
                        raise S2SProviderError(f"Hume EVI error: {error_msg}")

    except asyncio.TimeoutError:
        raise S2SProviderError(f"Hume EVI timed out after {settings.s2s_timeout_seconds}s")
    except websockets.exceptions.WebSocketException as e:
        raise S2SProviderError(f"Hume EVI WebSocket error: {e}")

    if not audio_chunks:
        raise S2SProviderError("Hume EVI returned no audio data")

    if first_byte_time is None:
        first_byte_time = time.perf_counter()

    end_time = time.perf_counter()

    # Assemble audio and write WAV
    raw_audio = b"".join(audio_chunks)
    wav_header = _build_wav_header(len(raw_audio), sample_rate, 1, 16)
    with open(audio_path, "wb") as f:
        f.write(wav_header)
        f.write(raw_audio)

    duration_seconds = len(raw_audio) / (2 * sample_rate)
    ttfb_ms = (first_byte_time - start_time) * 1000
    e2e_latency_ms = (end_time - start_time) * 1000

    logger.info(
        "Generated S2S [hume]: model=%s duration=%.2fs ttfb=%.0fms e2e=%.0fms",
        model_id, duration_seconds, ttfb_ms, e2e_latency_ms,
    )

    return {
        "audio_path": audio_path,
        "filename": filename,
        "duration_seconds": round(duration_seconds, 2),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_latency_ms, 1),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _build_wav_header(
    data_size: int,
    sample_rate: int,
    num_channels: int,
    bits_per_sample: int,
) -> bytes:
    """Build a standard 44-byte WAV (RIFF) header for PCM data."""
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)
    header = struct.pack(
        "<4sI4s"
        "4sIHHIIHH"
        "4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header
