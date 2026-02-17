"""Speaker Embedding Cosine Similarity (SECS).

Measures how similar two speech audio samples sound in terms of speaker
identity.  Uses a pre-trained speaker verification model (WavLM-based) to
extract speaker embeddings and computes their cosine similarity.

A score close to 1.0 indicates the two samples sound like the same speaker;
a score near 0.0 or negative indicates different speakers.
"""

from __future__ import annotations

import logging
from typing import Union

import numpy as np

from ..audio.loader import ensure_audio
from ..exceptions import MissingDependencyError, ModelLoadError
from ..types import AudioData

logger = logging.getLogger("voice_evals.tts.speaker_similarity")

# Module-level cache for the loaded model and processor.
_model_cache: dict[str, object] = {}

# Pre-trained model for speaker verification.
_DEFAULT_MODEL_NAME = "microsoft/wavlm-base-plus-sv"

# Expected sample rate for WavLM models.
_WAVLM_SR = 16000


def _ensure_torch():
    """Lazily import torch, raising a user-friendly error if absent."""
    try:
        import torch
        return torch
    except ImportError:
        raise MissingDependencyError("torch", "tts")


def _ensure_transformers():
    """Lazily import transformers, raising a user-friendly error if absent."""
    try:
        import transformers
        return transformers
    except ImportError:
        raise MissingDependencyError("transformers", "tts")


def _load_audio_array(
    audio_path_or_data: Union[str, AudioData],
) -> np.ndarray:
    """Load audio and return a 1-D float32 array resampled to 16 kHz.

    Parameters
    ----------
    audio_path_or_data:
        File path or pre-loaded ``AudioData``.

    Returns
    -------
    np.ndarray
        Mono float32 waveform at 16 kHz.
    """
    audio = ensure_audio(audio_path_or_data)
    mono = audio.to_mono()

    if mono.sample_rate != _WAVLM_SR:
        mono = mono.resample(_WAVLM_SR)

    return mono.samples.astype(np.float32)


def _get_model_and_feature_extractor(device: str = "cpu"):
    """Load or retrieve the cached WavLM speaker verification model.

    Parameters
    ----------
    device:
        PyTorch device string.

    Returns
    -------
    tuple[model, feature_extractor]
        The loaded model (in eval mode, on the target device) and its
        associated feature extractor.
    """
    torch = _ensure_torch()
    transformers = _ensure_transformers()

    cache_key = f"wavlm_sv_{device}"
    if cache_key in _model_cache:
        return _model_cache[cache_key]

    logger.info(
        "Loading speaker verification model '%s' on device=%s ...",
        _DEFAULT_MODEL_NAME,
        device,
    )

    try:
        from transformers import AutoModel, AutoFeatureExtractor  # type: ignore[import-untyped]

        feature_extractor = AutoFeatureExtractor.from_pretrained(
            _DEFAULT_MODEL_NAME,
        )
        model = AutoModel.from_pretrained(_DEFAULT_MODEL_NAME)
        model = model.to(device)
        model.eval()
    except Exception as exc:
        raise ModelLoadError(
            f"Failed to load speaker verification model "
            f"'{_DEFAULT_MODEL_NAME}': {exc}"
        ) from exc

    _model_cache[cache_key] = (model, feature_extractor)
    logger.info("Speaker verification model loaded successfully.")
    return model, feature_extractor


def _extract_embedding(
    audio: np.ndarray,
    model,
    feature_extractor,
    device: str,
) -> np.ndarray:
    """Extract a speaker embedding from a waveform.

    Parameters
    ----------
    audio : np.ndarray
        1-D float32 waveform at 16 kHz.
    model:
        The WavLM model.
    feature_extractor:
        The HuggingFace feature extractor.
    device : str
        PyTorch device string.

    Returns
    -------
    np.ndarray
        1-D embedding vector (L2-normalised).
    """
    torch = _ensure_torch()

    inputs = feature_extractor(
        audio,
        sampling_rate=_WAVLM_SR,
        return_tensors="pt",
        padding=True,
    )
    input_values = inputs["input_values"].to(device)

    with torch.no_grad():
        outputs = model(input_values)

    # Use the pooled output or mean of last hidden state as the embedding.
    if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
        embedding = outputs.pooler_output.squeeze(0)
    else:
        # Mean-pool over the time dimension.
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze(0)

    emb_np = embedding.cpu().numpy().astype(np.float64)

    # L2 normalise.
    norm = np.linalg.norm(emb_np)
    if norm > 0:
        emb_np = emb_np / norm

    return emb_np


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors.

    Parameters
    ----------
    a, b : np.ndarray
        1-D vectors (assumed L2-normalised).

    Returns
    -------
    float
        Cosine similarity in ``[-1, 1]``.
    """
    dot = float(np.dot(a, b))
    return max(-1.0, min(1.0, dot))


def calculate_secs(
    audio_path_or_data: Union[str, AudioData],
    reference_path_or_data: Union[str, AudioData],
    device: str = "cpu",
) -> float:
    """Compute Speaker Embedding Cosine Similarity between two audio samples.

    Parameters
    ----------
    audio_path_or_data:
        Path or ``AudioData`` for the hypothesis (synthesised) speech.
    reference_path_or_data:
        Path or ``AudioData`` for the reference (ground-truth) speaker.
    device:
        PyTorch device for inference.

    Returns
    -------
    float
        Cosine similarity in ``[-1, 1]``.  Values close to 1.0 indicate the
        same speaker; values near 0.0 or negative indicate different speakers.

    Raises
    ------
    MissingDependencyError
        If ``torch`` or ``transformers`` is not installed.
    ModelLoadError
        If the speaker verification model cannot be loaded.
    """
    model, feature_extractor = _get_model_and_feature_extractor(device)

    hyp_audio = _load_audio_array(audio_path_or_data)
    ref_audio = _load_audio_array(reference_path_or_data)

    if hyp_audio.size == 0 or ref_audio.size == 0:
        logger.warning("One or both audio samples are empty — returning 0.0")
        return 0.0

    hyp_emb = _extract_embedding(hyp_audio, model, feature_extractor, device)
    ref_emb = _extract_embedding(ref_audio, model, feature_extractor, device)

    similarity = _cosine_similarity(hyp_emb, ref_emb)

    logger.info("Speaker similarity (SECS): %.4f", similarity)
    return similarity
