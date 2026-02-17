"""Real-time factor computation.

RTFx measures how fast a system processes audio relative to real time.
An RTFx of 2.0 means the system processes audio twice as fast as playback.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Generator

logger = logging.getLogger("voice_evals.latency.rtf")


def calculate_rtfx(audio_duration: float, processing_time: float) -> float:
    """Compute the Real-Time Factor (RTFx).

    RTFx = audio_duration / processing_time.  A value greater than 1.0
    means the system is faster than real time.

    Parameters
    ----------
    audio_duration:
        Duration of the audio in seconds.
    processing_time:
        Wall-clock time spent processing in seconds.

    Returns
    -------
    float
        RTFx ratio.  Returns ``float('inf')`` when *processing_time* is
        zero (instantaneous processing).  Returns ``0.0`` when
        *audio_duration* is zero or negative.

    Raises
    ------
    ValueError
        If *processing_time* is negative.
    """
    if processing_time < 0:
        raise ValueError(
            f"processing_time must be non-negative, got {processing_time}"
        )

    if audio_duration <= 0:
        logger.warning(
            "audio_duration is %.4f — returning RTFx 0.0", audio_duration
        )
        return 0.0

    if processing_time == 0:
        logger.debug("processing_time is 0 — returning RTFx inf")
        return float("inf")

    rtfx = audio_duration / processing_time

    logger.debug(
        "RTFx = %.4f  (audio=%.4fs, processing=%.4fs)",
        rtfx,
        audio_duration,
        processing_time,
    )
    return rtfx


@contextmanager
def timed_evaluation() -> Generator[dict[str, float], None, None]:
    """Context manager that measures elapsed wall-clock time.

    Yields a mutable dict.  On exit the ``"elapsed"`` key is set to the
    number of seconds elapsed since entering the block.

    Example
    -------
    >>> with timed_evaluation() as timing:
    ...     do_expensive_work()
    >>> print(f"Took {timing['elapsed']:.3f}s")
    """
    result: dict[str, float] = {"elapsed": 0.0}
    start = time.perf_counter()
    try:
        yield result
    finally:
        result["elapsed"] = time.perf_counter() - start
        logger.debug("timed_evaluation block took %.6fs", result["elapsed"])
