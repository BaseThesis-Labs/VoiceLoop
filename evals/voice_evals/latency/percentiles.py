"""Latency percentile computation.

Aggregates a list of per-sample latency measurements into summary
statistics (P50, P90, P95, P99) for batch evaluation reporting.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("voice_evals.latency.percentiles")


def _require_numpy():  # noqa: ANN202
    """Lazy-import *numpy*, raising a friendly error if absent."""
    try:
        import numpy as np
    except ImportError:
        from ..exceptions import MissingDependencyError

        raise MissingDependencyError("numpy", "core")
    return np


def calculate_percentiles(latencies: list[float]) -> dict[str, Any]:
    """Compute summary percentile statistics from latency measurements.

    Parameters
    ----------
    latencies:
        A list of latency values in milliseconds.  Typically one value
        per evaluated sample in a batch run.

    Returns
    -------
    dict
        Keys: ``p50``, ``p90``, ``p95``, ``p99``, ``mean``, ``std``,
        ``min``, ``max``, ``count``.  All values are ``None`` when the
        input list is empty.
    """
    if not latencies:
        logger.warning("Empty latency list — returning all None")
        return {
            "p50": None,
            "p90": None,
            "p95": None,
            "p99": None,
            "mean": None,
            "std": None,
            "min": None,
            "max": None,
            "count": 0,
        }

    np = _require_numpy()

    arr = np.asarray(latencies, dtype=np.float64)

    p50, p90, p95, p99 = np.percentile(arr, [50, 90, 95, 99]).tolist()

    result = {
        "p50": float(p50),
        "p90": float(p90),
        "p95": float(p95),
        "p99": float(p99),
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr)),
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "count": len(latencies),
    }

    logger.debug(
        "Latency percentiles — P50=%.2f  P90=%.2f  P95=%.2f  P99=%.2f  (n=%d)",
        result["p50"],
        result["p90"],
        result["p95"],
        result["p99"],
        result["count"],
    )

    return result
