"""Time-to-first-token and voice assistant response time metrics.

These functions compute latency metrics from externally provided
timestamp dictionaries.  They do **not** perform any timing themselves;
they only derive the metric from pre-recorded event timestamps.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("voice_evals.latency.ttft")


def _ts_diff_ms(timestamps: dict, start_key: str, end_key: str) -> float | None:
    """Return (end - start) in milliseconds, or None if keys are missing."""
    start = timestamps.get(start_key)
    end = timestamps.get(end_key)
    if start is None or end is None:
        return None
    try:
        return (float(end) - float(start)) * 1000.0
    except (TypeError, ValueError) as exc:
        logger.warning(
            "Cannot compute diff for %s→%s: %s", start_key, end_key, exc
        )
        return None


def calculate_ttft(timestamps: dict) -> float | None:
    """Calculate Time-To-First-Token from pipeline timestamps.

    Tries the following pairs in order, returning the first valid result:

    1. ``llm_start`` → ``llm_first_token``  (LLM TTFT)
    2. ``tts_start`` → ``tts_first_byte``   (TTS TTFB)
    3. ``stt_start`` → ``stt_first_result``  (STT first partial)

    Parameters
    ----------
    timestamps:
        Dictionary with float epoch or relative timestamps.  Expected
        keys include ``llm_start``, ``llm_first_token``, ``tts_start``,
        ``tts_first_byte``, etc.

    Returns
    -------
    float | None
        TTFT in milliseconds, or ``None`` if no suitable timestamp pair
        is available.
    """
    # Try each pair in priority order.
    pairs = [
        ("llm_start", "llm_first_token"),
        ("tts_start", "tts_first_byte"),
        ("stt_start", "stt_first_result"),
    ]

    for start_key, end_key in pairs:
        ttft = _ts_diff_ms(timestamps, start_key, end_key)
        if ttft is not None:
            logger.debug(
                "TTFT (from %s→%s): %.2f ms", start_key, end_key, ttft
            )
            return ttft

    logger.warning("No valid timestamp pairs found for TTFT calculation")
    return None


def calculate_vart(timestamps: dict) -> float | None:
    """Calculate Voice Assistant Response Time (VART).

    VART = LLM TTFT + TTS TTFB

    This measures the total time from when the LLM starts processing to
    when the first audio byte is produced by TTS — the user-perceived
    delay before the assistant starts speaking.

    Parameters
    ----------
    timestamps:
        Dictionary with float epoch or relative timestamps.  Requires
        ``llm_start``, ``llm_first_token``, ``tts_start``, and
        ``tts_first_byte``.

    Returns
    -------
    float | None
        VART in milliseconds, or ``None`` if required timestamps are
        missing.
    """
    llm_ttft = _ts_diff_ms(timestamps, "llm_start", "llm_first_token")
    tts_ttfb = _ts_diff_ms(timestamps, "tts_start", "tts_first_byte")

    if llm_ttft is None or tts_ttfb is None:
        logger.warning(
            "Cannot compute VART — llm_ttft=%s, tts_ttfb=%s",
            llm_ttft,
            tts_ttfb,
        )
        return None

    vart = llm_ttft + tts_ttfb

    logger.debug(
        "VART: %.2f ms  (LLM TTFT=%.2f ms + TTS TTFB=%.2f ms)",
        vart,
        llm_ttft,
        tts_ttfb,
    )
    return vart
