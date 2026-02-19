"""TTS service supporting multiple providers (Cartesia, SmallestAI, Deepgram, ElevenLabs)."""
import logging
import os
import struct
import time
import uuid

from app.config import settings

logger = logging.getLogger("arena.tts_service")

# ---------------------------------------------------------------------------
# Provider client singletons (lazy-init)
# ---------------------------------------------------------------------------
_cartesia_client = None
_smallestai_client = None


def _get_cartesia_client():
    """Lazy-init Cartesia client singleton."""
    global _cartesia_client
    if _cartesia_client is None:
        from cartesia import Cartesia
        _cartesia_client = Cartesia(api_key=settings.cartesia_api_key)
    return _cartesia_client


def _get_smallestai_client():
    """Lazy-init SmallestAI WavesClient singleton."""
    global _smallestai_client
    if _smallestai_client is None:
        from smallestai.waves import WavesClient
        _smallestai_client = WavesClient(api_key=settings.smallest_api_key)
    return _smallestai_client


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def generate_tts(text: str, provider: str, voice_id: str, model_id: str) -> dict:
    """Generate TTS audio and save as WAV.

    Args:
        text: The text to synthesize.
        provider: TTS provider name ("cartesia", "smallestai", or "deepgram").
        voice_id: Provider-specific voice identifier.
        model_id: Provider-specific model identifier.

    Returns:
        dict with: audio_path, filename, duration_seconds, ttfb_ms, generation_time_ms
    """
    if provider == "cartesia":
        return _generate_cartesia(text, voice_id, model_id)
    elif provider == "smallestai":
        return _generate_smallestai(text, voice_id, model_id)
    elif provider == "deepgram":
        return _generate_deepgram(text, voice_id, model_id)
    elif provider == "elevenlabs":
        return _generate_elevenlabs(text, voice_id, model_id)
    else:
        raise ValueError(f"Unknown TTS provider: {provider}")


# ---------------------------------------------------------------------------
# Cartesia implementation
# ---------------------------------------------------------------------------
def _generate_cartesia(text: str, voice_id: str, model_id: str) -> dict:
    """Generate TTS audio using Cartesia and save as WAV."""
    client = _get_cartesia_client()
    os.makedirs(settings.audio_storage_path, exist_ok=True)

    filename = f"{uuid.uuid4()}.wav"
    audio_path = os.path.join(settings.audio_storage_path, filename)

    start_time = time.perf_counter()
    first_byte_time = None

    # Use bytes mode for simplest integration
    output = client.tts.bytes(
        model_id=model_id,
        transcript=text,
        voice={"mode": "id", "id": voice_id},
        output_format={
            "container": "wav",
            "encoding": "pcm_s16le",
            "sample_rate": 44100,
        },
    )

    # Cartesia v3 returns a bytes object or generator — handle both
    if isinstance(output, bytes):
        audio_bytes = output
    else:
        chunks = []
        for chunk in output:
            if first_byte_time is None:
                first_byte_time = time.perf_counter()
            chunks.append(chunk)
        audio_bytes = b"".join(chunks)

    if first_byte_time is None:
        first_byte_time = time.perf_counter()

    with open(audio_path, "wb") as f:
        f.write(audio_bytes)

    end_time = time.perf_counter()

    # Calculate duration from WAV file size
    # WAV header is 44 bytes, PCM s16le = 2 bytes per sample, 44100 Hz
    data_size = max(0, os.path.getsize(audio_path) - 44)
    duration_seconds = data_size / (2 * 44100)  # 2 bytes per sample, mono

    ttfb_ms = (first_byte_time - start_time) * 1000
    generation_time_ms = (end_time - start_time) * 1000

    logger.info(
        "Generated TTS [cartesia]: voice=%s duration=%.2fs ttfb=%.0fms total=%.0fms",
        voice_id, duration_seconds, ttfb_ms, generation_time_ms,
    )

    return {
        "audio_path": audio_path,
        "filename": filename,
        "duration_seconds": round(duration_seconds, 2),
        "ttfb_ms": round(ttfb_ms, 1),
        "generation_time_ms": round(generation_time_ms, 1),
    }


# ---------------------------------------------------------------------------
# SmallestAI implementation
# ---------------------------------------------------------------------------
def _generate_smallestai(text: str, voice_id: str, model_id: str) -> dict:
    """Generate TTS audio using SmallestAI WavesClient and save as WAV."""
    client = _get_smallestai_client()
    os.makedirs(settings.audio_storage_path, exist_ok=True)

    filename = f"{uuid.uuid4()}.wav"
    audio_path = os.path.join(settings.audio_storage_path, filename)

    sample_rate = 24000
    num_channels = 1
    bits_per_sample = 16
    bytes_per_sample = bits_per_sample // 8

    start_time = time.perf_counter()

    # SmallestAI synthesize returns raw PCM bytes directly (no generator)
    audio_bytes = client.synthesize(
        text=text,
        model=model_id,
        voice_id=voice_id,
        sample_rate=sample_rate,
    )

    first_byte_time = time.perf_counter()

    # Wrap raw PCM data in a WAV container
    data_size = len(audio_bytes)
    wav_header = _build_wav_header(
        data_size=data_size,
        sample_rate=sample_rate,
        num_channels=num_channels,
        bits_per_sample=bits_per_sample,
    )

    with open(audio_path, "wb") as f:
        f.write(wav_header)
        f.write(audio_bytes)

    end_time = time.perf_counter()

    # Duration: 16-bit mono at 24000 Hz
    file_size = os.path.getsize(audio_path)
    duration_seconds = (file_size - 44) / (bytes_per_sample * sample_rate)

    ttfb_ms = (first_byte_time - start_time) * 1000
    generation_time_ms = (end_time - start_time) * 1000

    logger.info(
        "Generated TTS [smallestai]: voice=%s duration=%.2fs ttfb=%.0fms total=%.0fms",
        voice_id, duration_seconds, ttfb_ms, generation_time_ms,
    )

    return {
        "audio_path": audio_path,
        "filename": filename,
        "duration_seconds": round(duration_seconds, 2),
        "ttfb_ms": round(ttfb_ms, 1),
        "generation_time_ms": round(generation_time_ms, 1),
    }


# ---------------------------------------------------------------------------
# Deepgram implementation
# ---------------------------------------------------------------------------
def _generate_deepgram(text: str, voice_id: str, model_id: str) -> dict:
    """Generate TTS audio using Deepgram REST API and save as WAV.

    Deepgram model strings combine generation + voice + language, e.g.
    ``aura-2-thalia-en``.  We store ``voice_id="thalia"`` and
    ``model_id="aura-2"`` separately so the engine selector can swap
    generations while keeping the same voice.
    """
    import requests as _requests

    os.makedirs(settings.audio_storage_path, exist_ok=True)

    filename = f"{uuid.uuid4()}.wav"
    audio_path = os.path.join(settings.audio_storage_path, filename)

    sample_rate = 24000
    num_channels = 1
    bits_per_sample = 16
    bytes_per_sample = bits_per_sample // 8

    # Build the full Deepgram model string: "aura-2-thalia-en"
    deepgram_model = f"{model_id}-{voice_id}-en"

    start_time = time.perf_counter()

    resp = _requests.post(
        "https://api.deepgram.com/v1/speak",
        params={
            "model": deepgram_model,
            "encoding": "linear16",
            "sample_rate": str(sample_rate),
            "container": "none",  # raw PCM, we add our own WAV header
        },
        headers={
            "Authorization": f"Token {settings.deepgram_api_key}",
            "Content-Type": "application/json",
        },
        json={"text": text},
        timeout=30,
    )
    resp.raise_for_status()

    first_byte_time = time.perf_counter()
    audio_bytes = resp.content

    # Wrap raw PCM data in a WAV container
    data_size = len(audio_bytes)
    wav_header = _build_wav_header(
        data_size=data_size,
        sample_rate=sample_rate,
        num_channels=num_channels,
        bits_per_sample=bits_per_sample,
    )

    with open(audio_path, "wb") as f:
        f.write(wav_header)
        f.write(audio_bytes)

    end_time = time.perf_counter()

    # Duration: 16-bit mono at 24000 Hz
    file_size = os.path.getsize(audio_path)
    duration_seconds = (file_size - 44) / (bytes_per_sample * sample_rate)

    ttfb_ms = (first_byte_time - start_time) * 1000
    generation_time_ms = (end_time - start_time) * 1000

    logger.info(
        "Generated TTS [deepgram]: model=%s duration=%.2fs ttfb=%.0fms total=%.0fms",
        deepgram_model, duration_seconds, ttfb_ms, generation_time_ms,
    )

    return {
        "audio_path": audio_path,
        "filename": filename,
        "duration_seconds": round(duration_seconds, 2),
        "ttfb_ms": round(ttfb_ms, 1),
        "generation_time_ms": round(generation_time_ms, 1),
    }


# ---------------------------------------------------------------------------
# ElevenLabs implementation
# ---------------------------------------------------------------------------
def _generate_elevenlabs(text: str, voice_id: str, model_id: str) -> dict:
    """Generate TTS audio using ElevenLabs REST API and save as WAV.

    Uses the v1 text-to-speech endpoint with PCM output, then wraps in WAV.
    """
    import requests as _requests

    os.makedirs(settings.audio_storage_path, exist_ok=True)

    filename = f"{uuid.uuid4()}.wav"
    audio_path = os.path.join(settings.audio_storage_path, filename)

    sample_rate = 24000
    num_channels = 1
    bits_per_sample = 16
    bytes_per_sample = bits_per_sample // 8

    start_time = time.perf_counter()

    resp = _requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "model_id": model_id,
        },
        params={
            "output_format": "pcm_24000",
        },
        timeout=30,
    )
    resp.raise_for_status()

    first_byte_time = time.perf_counter()
    audio_bytes = resp.content

    # Wrap raw PCM data in a WAV container
    data_size = len(audio_bytes)
    wav_header = _build_wav_header(
        data_size=data_size,
        sample_rate=sample_rate,
        num_channels=num_channels,
        bits_per_sample=bits_per_sample,
    )

    with open(audio_path, "wb") as f:
        f.write(wav_header)
        f.write(audio_bytes)

    end_time = time.perf_counter()

    # Duration: 16-bit mono at 24000 Hz
    file_size = os.path.getsize(audio_path)
    duration_seconds = (file_size - 44) / (bytes_per_sample * sample_rate)

    ttfb_ms = (first_byte_time - start_time) * 1000
    generation_time_ms = (end_time - start_time) * 1000

    logger.info(
        "Generated TTS [elevenlabs]: voice=%s duration=%.2fs ttfb=%.0fms total=%.0fms",
        voice_id, duration_seconds, ttfb_ms, generation_time_ms,
    )

    return {
        "audio_path": audio_path,
        "filename": filename,
        "duration_seconds": round(duration_seconds, 2),
        "ttfb_ms": round(ttfb_ms, 1),
        "generation_time_ms": round(generation_time_ms, 1),
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
    # RIFF chunk
    header = struct.pack(
        "<4sI4s"       # ChunkID, ChunkSize, Format
        "4sIHHIIHH"    # Subchunk1ID, Subchunk1Size, AudioFormat, NumChannels,
                       # SampleRate, ByteRate, BlockAlign, BitsPerSample
        "4sI",         # Subchunk2ID, Subchunk2Size
        b"RIFF",
        36 + data_size,  # ChunkSize
        b"WAVE",
        b"fmt ",
        16,              # Subchunk1Size (PCM)
        1,               # AudioFormat (PCM = 1)
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header
