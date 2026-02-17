"""UTMOS22 speech quality prediction (MOS estimation).

Uses the UTMOS22Strong model from Saeki et al. to predict a Mean Opinion Score
(MOS) for a given speech audio sample. The model is a wav2vec2-based neural
network trained on crowd-sourced MOS annotations.

Reference:
    Saeki et al., "UTMOS: UTokyo-SaruLab System for VoiceMOS Challenge 2022"
"""

from __future__ import annotations

import logging
from typing import Union

import numpy as np

from ..audio.loader import ensure_audio
from ..exceptions import MissingDependencyError, ModelLoadError
from ..types import AudioData

logger = logging.getLogger("voice_evals.tts.utmos")

# Module-level cache for the loaded model to avoid re-initialisation.
_model_cache: dict[str, object] = {}

# HuggingFace checkpoint URL used by the original UTMOS demo.
_CHECKPOINT_URL = (
    "https://huggingface.co/spaces/sarulab-speech/UTMOS-demo/resolve/main/"
    "epoch%3D3-step%3D7459.ckpt"
)


def _ensure_torch():
    """Lazily import torch, raising a user-friendly error if absent."""
    try:
        import torch  # noqa: F811
        return torch
    except ImportError:
        raise MissingDependencyError("torch", "tts")


def _load_audio_tensor(audio_path_or_data: Union[str, AudioData], device: str):
    """Load audio and return a (1, T) torch tensor at the original sample rate.

    Parameters
    ----------
    audio_path_or_data:
        File path or pre-loaded ``AudioData``.
    device:
        Target torch device string.

    Returns
    -------
    tuple[Tensor, int]
        ``(waveform, sample_rate)`` where waveform has shape ``(1, T)``.
    """
    torch = _ensure_torch()
    audio = ensure_audio(audio_path_or_data)
    mono = audio.to_mono()
    waveform = torch.from_numpy(mono.samples.astype(np.float32)).unsqueeze(0)
    waveform = waveform.to(device)
    return waveform, mono.sample_rate


def _get_model(device: str = "cpu"):
    """Return the cached UTMOS22Strong model, loading weights on first call.

    Parameters
    ----------
    device:
        PyTorch device string (``"cpu"``, ``"cuda"``, ``"mps"``).

    Returns
    -------
    UTMOS22Strong
        Model in eval mode on the requested device.
    """
    torch = _ensure_torch()
    cache_key = f"utmos22_{device}"

    if cache_key in _model_cache:
        return _model_cache[cache_key]

    logger.info("Loading UTMOS22Strong model on device=%s ...", device)

    try:
        from ..._vendor.utmos22.strong.model import UTMOS22Strong
    except Exception as exc:
        raise ModelLoadError(
            f"Failed to import vendored UTMOS22Strong model: {exc}"
        ) from exc

    model = UTMOS22Strong()

    # Load pre-trained weights from the HuggingFace checkpoint.
    try:
        state_dict = torch.hub.load_state_dict_from_url(
            _CHECKPOINT_URL,
            map_location=device,
        )
    except Exception as exc:
        raise ModelLoadError(
            f"Failed to download UTMOS22 checkpoint from {_CHECKPOINT_URL}: {exc}"
        ) from exc

    # The checkpoint stores keys prefixed with "model." inside "state_dict".
    raw_state = state_dict.get("state_dict", state_dict)
    filtered = {
        k.replace("model.", ""): v
        for k, v in raw_state.items()
        if k.startswith("model.")
    }

    if not filtered:
        # Fallback: perhaps keys are already unprefixed.
        filtered = raw_state

    try:
        model.load_state_dict(filtered, strict=False)
    except Exception as exc:
        raise ModelLoadError(
            f"Failed to load UTMOS22 state dict: {exc}"
        ) from exc

    model = model.to(device)
    model.eval()

    _model_cache[cache_key] = model
    logger.info("UTMOS22Strong model loaded successfully.")
    return model


def calculate_utmos(
    audio_path_or_data: Union[str, AudioData],
    device: str = "cpu",
) -> float:
    """Predict a MOS score for the given audio using UTMOS22Strong.

    Parameters
    ----------
    audio_path_or_data:
        Path to an audio file **or** a pre-loaded ``AudioData`` instance.
    device:
        PyTorch device for inference (``"cpu"``, ``"cuda"``, ``"mps"``).

    Returns
    -------
    float
        Predicted MOS score in the range ``[1, 5]``.

    Raises
    ------
    MissingDependencyError
        If ``torch`` is not installed.
    ModelLoadError
        If the model or its weights cannot be loaded.
    """
    torch = _ensure_torch()

    model = _get_model(device)
    waveform, sr = _load_audio_tensor(audio_path_or_data, device)

    with torch.no_grad():
        score = model(waveform, sr)

    # The model returns a tensor of shape (B,); extract the scalar.
    mos = float(score.squeeze().cpu().item())

    # Clamp to the valid MOS range.
    mos = max(1.0, min(5.0, mos))

    logger.info("UTMOS score: %.3f", mos)
    return mos
