"""DNSMOS P.835 speech quality prediction.

Microsoft's Deep Noise Suppression MOS (DNSMOS) predicts three quality
dimensions following the ITU-T P.835 framework: overall quality, speech signal
quality, and background noise quality.

This module provides a best-effort implementation:
1. If ``onnxruntime`` is installed and the DNSMOS model can be loaded, it is
   used for inference.
2. Otherwise, ``None`` values are returned with a warning.

Reference:
    Reddy et al., "DNSMOS P.835 - A Non-Intrusive Perceptual Objective Speech
    Quality Metric to Evaluate Noise Suppressors"
"""

from __future__ import annotations

import logging
import os
from typing import Union

import numpy as np

from ..audio.loader import ensure_audio
from ..types import AudioData

logger = logging.getLogger("voice_evals.tts.dnsmos")

# Module-level cache for the ONNX session.
_model_cache: dict[str, object] = {}

# Keys returned in the result dictionary.
_RESULT_KEYS = (
    "dnsmos_overall",
    "dnsmos_signal",
    "dnsmos_background",
)

# Expected sample rate for DNSMOS models.
_DNSMOS_SR = 16000

# Known model URLs / local paths.
_DNSMOS_PRIMARY_MODEL_URL = (
    "https://github.com/microsoft/DNS-Challenge/raw/master/DNSMOS/"
    "sig_bak_ovr.onnx"
)


def _null_result() -> dict[str, float | None]:
    """Return a result dict with all values set to ``None``."""
    return {k: None for k in _RESULT_KEYS}


def _prepare_audio(audio_path_or_data: Union[str, AudioData]) -> np.ndarray:
    """Load audio and return a 1-D float32 array at 16 kHz.

    Parameters
    ----------
    audio_path_or_data:
        File path or pre-loaded ``AudioData``.

    Returns
    -------
    np.ndarray
        Mono float32 waveform resampled to 16 kHz.
    """
    audio = ensure_audio(audio_path_or_data)
    mono = audio.to_mono()

    # Resample to the expected rate if necessary.
    if mono.sample_rate != _DNSMOS_SR:
        mono = mono.resample(_DNSMOS_SR)

    return mono.samples.astype(np.float32)


def _get_onnx_session(model_path: str | None = None):
    """Load or retrieve the cached ONNX inference session.

    Parameters
    ----------
    model_path:
        Optional explicit path to the ``.onnx`` model file.  When ``None``
        the function attempts to download from the known URL.

    Returns
    -------
    ort.InferenceSession or None
        The ONNX runtime session, or ``None`` if it cannot be created.
    """
    cache_key = "dnsmos_session"
    if cache_key in _model_cache:
        return _model_cache[cache_key]

    try:
        import onnxruntime as ort  # type: ignore[import-untyped]
    except ImportError:
        logger.debug("onnxruntime is not installed — DNSMOS unavailable.")
        return None

    # Determine model path.
    resolved_path = model_path

    if resolved_path is None:
        # Check environment variable.
        resolved_path = os.environ.get("DNSMOS_MODEL_PATH")

    if resolved_path is not None and os.path.isfile(resolved_path):
        try:
            session = ort.InferenceSession(resolved_path)
            _model_cache[cache_key] = session
            logger.info("Loaded DNSMOS ONNX model from %s", resolved_path)
            return session
        except Exception:
            logger.exception("Failed to load DNSMOS model from %s", resolved_path)
            return None

    # Try downloading via the known URL.
    try:
        import urllib.request
        import tempfile

        cache_dir = os.path.join(
            os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")),
            "voice_evals",
            "dnsmos",
        )
        os.makedirs(cache_dir, exist_ok=True)
        local_model = os.path.join(cache_dir, "sig_bak_ovr.onnx")

        if not os.path.isfile(local_model):
            logger.info("Downloading DNSMOS model to %s ...", local_model)
            urllib.request.urlretrieve(_DNSMOS_PRIMARY_MODEL_URL, local_model)

        session = ort.InferenceSession(local_model)
        _model_cache[cache_key] = session
        logger.info("Loaded DNSMOS ONNX model from cache.")
        return session

    except Exception:
        logger.exception("Failed to download or load DNSMOS ONNX model.")
        return None


def _run_inference(session, audio: np.ndarray) -> dict[str, float | None]:
    """Run the DNSMOS ONNX model on a prepared waveform.

    Parameters
    ----------
    session:
        ``onnxruntime.InferenceSession`` with the loaded model.
    audio:
        1-D float32 waveform at 16 kHz.

    Returns
    -------
    dict[str, float | None]
        Predicted quality scores.
    """
    try:
        input_name = session.get_inputs()[0].name
        # The model expects shape (batch, samples).
        inp = audio.reshape(1, -1)
        outputs = session.run(None, {input_name: inp})

        # The DNSMOS sig_bak_ovr model typically returns [sig, bak, ovr]
        # or a single array with three values.
        if len(outputs) == 1:
            scores = outputs[0].flatten()
        else:
            scores = np.array([o.item() if hasattr(o, "item") else float(o)
                               for o in outputs])

        if scores.size >= 3:
            return {
                "dnsmos_signal": float(scores[0]),
                "dnsmos_background": float(scores[1]),
                "dnsmos_overall": float(scores[2]),
            }
        elif scores.size == 1:
            return {
                "dnsmos_overall": float(scores[0]),
                "dnsmos_signal": None,
                "dnsmos_background": None,
            }
        else:
            logger.warning("Unexpected DNSMOS output shape: %s", scores.shape)
            return _null_result()

    except Exception:
        logger.exception("DNSMOS inference failed")
        return _null_result()


def calculate_dnsmos(
    audio_path_or_data: Union[str, AudioData],
    device: str = "cpu",
) -> dict[str, float | None]:
    """Predict speech quality using DNSMOS P.835.

    Parameters
    ----------
    audio_path_or_data:
        Path to an audio file **or** a pre-loaded ``AudioData`` instance.
    device:
        Device hint (currently unused; DNSMOS runs via ONNX Runtime on CPU or
        its own provider selection).

    Returns
    -------
    dict[str, float | None]
        Dictionary with keys ``dnsmos_overall``, ``dnsmos_signal``,
        ``dnsmos_background``.  Values are ``None`` when the DNSMOS model is
        unavailable.
    """
    session = _get_onnx_session()
    if session is None:
        logger.warning(
            "DNSMOS is not available. Install 'onnxruntime' and ensure the "
            "DNSMOS ONNX model is accessible. Returning None for all DNSMOS "
            "dimensions."
        )
        return _null_result()

    audio = _prepare_audio(audio_path_or_data)
    result = _run_inference(session, audio)

    logger.info(
        "DNSMOS scores — overall: %s, signal: %s, background: %s",
        result.get("dnsmos_overall"),
        result.get("dnsmos_signal"),
        result.get("dnsmos_background"),
    )
    return result
