"""NISQA speech quality prediction (multi-dimensional).

NISQA (Non-Intrusive Speech Quality Assessment) predicts multiple quality
dimensions: overall quality, noisiness, coloration, discontinuity, and loudness.

This module provides a best-effort implementation:
1. If the ``nisqa`` Python package is installed, it is used directly.
2. Otherwise, ``None`` values are returned with a warning.

Reference:
    Mittag et al., "NISQA: A Deep CNN-Self-Attention Model for
    Multidimensional Speech Quality Prediction with Crowdsourced Datasets"
"""

from __future__ import annotations

import logging
from typing import Union

import numpy as np

from ..audio.loader import ensure_audio
from ..types import AudioData

logger = logging.getLogger("voice_evals.tts.nisqa")

# Module-level cache for the loaded model.
_model_cache: dict[str, object] = {}

# Keys returned in the result dictionary.
_RESULT_KEYS = (
    "nisqa_overall",
    "nisqa_noisiness",
    "nisqa_coloration",
    "nisqa_discontinuity",
    "nisqa_loudness",
)


def _null_result() -> dict[str, float | None]:
    """Return a result dict with all values set to ``None``."""
    return {k: None for k in _RESULT_KEYS}


def _try_nisqa_package(audio_path: str) -> dict[str, float | None] | None:
    """Attempt prediction using the ``nisqa`` package.

    Returns
    -------
    dict or None
        Result dict if the package is available and prediction succeeds,
        otherwise ``None``.
    """
    try:
        import nisqa  # type: ignore[import-untyped]
    except ImportError:
        return None

    try:
        # The nisqa package typically provides a predict function or a
        # NISQAModel class.  Exact API varies by version.
        if hasattr(nisqa, "predict"):
            result = nisqa.predict(audio_path)
        elif hasattr(nisqa, "NISQA"):
            model = nisqa.NISQA()
            result = model.predict(audio_path)
        else:
            logger.debug("nisqa package found but no usable API detected.")
            return None

        # Normalise the output into our standard dict.
        if isinstance(result, dict):
            return {
                "nisqa_overall": result.get("mos_pred", result.get("overall")),
                "nisqa_noisiness": result.get("noi_pred", result.get("noisiness")),
                "nisqa_coloration": result.get("col_pred", result.get("coloration")),
                "nisqa_discontinuity": result.get("dis_pred", result.get("discontinuity")),
                "nisqa_loudness": result.get("loud_pred", result.get("loudness")),
            }

        logger.warning("nisqa returned unexpected type: %s", type(result))
        return None

    except Exception:
        logger.exception("nisqa prediction failed")
        return None


def calculate_nisqa(
    audio_path_or_data: Union[str, AudioData],
    device: str = "cpu",
) -> dict[str, float | None]:
    """Predict multi-dimensional speech quality using NISQA.

    Parameters
    ----------
    audio_path_or_data:
        Path to an audio file **or** a pre-loaded ``AudioData`` instance.
    device:
        PyTorch device for inference (currently unused; reserved for future
        GPU-accelerated backends).

    Returns
    -------
    dict[str, float | None]
        Dictionary with keys ``nisqa_overall``, ``nisqa_noisiness``,
        ``nisqa_coloration``, ``nisqa_discontinuity``, ``nisqa_loudness``.
        Values are ``None`` when the NISQA model is unavailable.
    """
    audio = ensure_audio(audio_path_or_data)

    # The nisqa package typically requires a file path rather than raw samples.
    audio_path = audio.path

    # Strategy 1: try the nisqa Python package.
    result = _try_nisqa_package(audio_path)
    if result is not None:
        logger.info(
            "NISQA scores — overall: %s, noisiness: %s, coloration: %s, "
            "discontinuity: %s, loudness: %s",
            result.get("nisqa_overall"),
            result.get("nisqa_noisiness"),
            result.get("nisqa_coloration"),
            result.get("nisqa_discontinuity"),
            result.get("nisqa_loudness"),
        )
        return result

    # No backend available — return None values.
    logger.warning(
        "NISQA model is not available. Install the 'nisqa' package for "
        "multi-dimensional speech quality prediction. "
        "Returning None for all NISQA dimensions."
    )
    return _null_result()
