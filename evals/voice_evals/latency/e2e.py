"""End-to-end latency breakdown.

Decomposes the full voice pipeline latency into individual component
durations (VAD, STT, LLM, TTS) from externally provided timestamps.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("voice_evals.latency.e2e")


def _safe_diff_ms(
    timestamps: dict, start_key: str, end_key: str,
) -> float | None:
    """Compute (end - start) * 1000 in milliseconds, or None if missing."""
    start = timestamps.get(start_key)
    end = timestamps.get(end_key)
    if start is None or end is None:
        return None
    try:
        return (float(end) - float(start)) * 1000.0
    except (TypeError, ValueError) as exc:
        logger.warning(
            "Cannot compute %s→%s: %s", start_key, end_key, exc
        )
        return None


def calculate_e2e_breakdown(timestamps: dict) -> dict[str, Any]:
    """Break down end-to-end latency into pipeline component durations.

    Parameters
    ----------
    timestamps:
        Dictionary of float epoch (or relative) timestamps with the
        following expected keys:

        - ``vad_end`` — voice activity detection completes
        - ``stt_start`` — speech-to-text begins
        - ``stt_end`` — speech-to-text completes
        - ``llm_start`` — LLM inference begins
        - ``llm_first_token`` — first LLM token generated
        - ``llm_end`` — LLM response fully generated
        - ``tts_start`` — text-to-speech begins
        - ``tts_first_byte`` — first audio byte produced
        - ``tts_end`` — TTS fully rendered

    Returns
    -------
    dict
        Component latencies in milliseconds:

        - ``vad_to_stt`` — gap between VAD end and STT start
        - ``stt_duration`` — STT processing time
        - ``stt_to_llm`` — gap between STT end and LLM start
        - ``llm_ttft`` — LLM time to first token
        - ``llm_duration`` — full LLM generation time
        - ``llm_to_tts`` — gap between LLM end and TTS start
        - ``tts_ttfb`` — TTS time to first byte
        - ``tts_duration`` — full TTS rendering time
        - ``total_e2e`` — total end-to-end from VAD end to TTS end

        Any component for which the required timestamps are absent is
        set to ``None``.
    """
    components = {
        "vad_to_stt": ("vad_end", "stt_start"),
        "stt_duration": ("stt_start", "stt_end"),
        "stt_to_llm": ("stt_end", "llm_start"),
        "llm_ttft": ("llm_start", "llm_first_token"),
        "llm_duration": ("llm_start", "llm_end"),
        "llm_to_tts": ("llm_end", "tts_start"),
        "tts_ttfb": ("tts_start", "tts_first_byte"),
        "tts_duration": ("tts_start", "tts_end"),
        "total_e2e": ("vad_end", "tts_end"),
    }

    result: dict[str, Any] = {}
    for name, (start_key, end_key) in components.items():
        result[name] = _safe_diff_ms(timestamps, start_key, end_key)

    # Log a summary of available components.
    available = {k: v for k, v in result.items() if v is not None}
    missing = {k for k, v in result.items() if v is None}

    if available:
        summary = "  ".join(f"{k}={v:.2f}ms" for k, v in available.items())
        logger.debug("E2E breakdown: %s", summary)
    if missing:
        logger.debug("E2E components missing timestamps: %s", missing)

    return result
