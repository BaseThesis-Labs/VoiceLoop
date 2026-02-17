"""Emotion detection from speech audio.

Detects the dominant emotion and per-emotion confidence scores from a speech
signal.  Supports multiple backends in order of preference:

1. **FunASR** with the Emotion2Vec model (``funasr`` package).
2. **Transformers** with a HuggingFace emotion classification model.
3. **Fallback** — returns ``None`` values with a warning.
"""

from __future__ import annotations

import logging
from typing import Union

import numpy as np

from ..audio.loader import ensure_audio
from ..types import AudioData

logger = logging.getLogger("voice_evals.tts.emotion")

# Module-level cache for loaded models.
_model_cache: dict[str, object] = {}

# HuggingFace model for fallback emotion classification.
_HF_EMOTION_MODEL = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"

# Expected sample rate for most speech models.
_TARGET_SR = 16000


def _null_result() -> dict[str, str | dict[str, float] | None]:
    """Return a result dict with all values set to ``None``."""
    return {"emotion": None, "emotion_scores": None}


# ---------------------------------------------------------------------------
# Backend 1: FunASR / Emotion2Vec
# ---------------------------------------------------------------------------

def _try_funasr(audio_path: str, device: str) -> dict | None:
    """Attempt emotion detection via FunASR's Emotion2Vec.

    Returns
    -------
    dict or None
        Result dict if successful, otherwise ``None``.
    """
    try:
        from funasr import AutoModel as FunAutoModel  # type: ignore[import-untyped]
    except ImportError:
        return None

    cache_key = f"funasr_emotion_{device}"
    if cache_key in _model_cache:
        model = _model_cache[cache_key]
    else:
        try:
            model = FunAutoModel(
                model="iic/emotion2vec_plus_seed",
                device=device,
            )
            _model_cache[cache_key] = model
            logger.info("Loaded Emotion2Vec model via FunASR on device=%s", device)
        except Exception:
            logger.debug("Failed to load Emotion2Vec via FunASR.", exc_info=True)
            return None

    try:
        result = model.generate(audio_path)

        if not result:
            return None

        # FunASR typically returns a list of dicts; take the first.
        entry = result[0] if isinstance(result, list) else result

        # Extract labels and scores.
        if isinstance(entry, dict):
            labels = entry.get("labels", [])
            scores = entry.get("scores", [])

            if labels and scores:
                emotion_scores = {
                    str(label): float(score)
                    for label, score in zip(labels, scores)
                }
                dominant = max(emotion_scores, key=emotion_scores.get)  # type: ignore[arg-type]
                return {
                    "emotion": dominant,
                    "emotion_scores": emotion_scores,
                }

        logger.debug("FunASR returned unexpected format: %s", type(entry))
        return None

    except Exception:
        logger.debug("FunASR emotion detection failed.", exc_info=True)
        return None


# ---------------------------------------------------------------------------
# Backend 2: HuggingFace Transformers
# ---------------------------------------------------------------------------

def _try_transformers(
    audio: np.ndarray,
    sr: int,
    device: str,
) -> dict | None:
    """Attempt emotion detection via a HuggingFace pipeline.

    Parameters
    ----------
    audio : np.ndarray
        1-D float32 mono waveform.
    sr : int
        Sample rate of the waveform.
    device : str
        PyTorch device string.

    Returns
    -------
    dict or None
        Result dict if successful, otherwise ``None``.
    """
    try:
        import torch  # noqa: F811
    except ImportError:
        return None

    try:
        from transformers import (  # type: ignore[import-untyped]
            AutoFeatureExtractor,
            AutoModelForAudioClassification,
        )
    except ImportError:
        return None

    cache_key = f"hf_emotion_{device}"
    if cache_key in _model_cache:
        model, feature_extractor = _model_cache[cache_key]
    else:
        try:
            feature_extractor = AutoFeatureExtractor.from_pretrained(
                _HF_EMOTION_MODEL,
            )
            model = AutoModelForAudioClassification.from_pretrained(
                _HF_EMOTION_MODEL,
            )
            model = model.to(device)
            model.eval()
            _model_cache[cache_key] = (model, feature_extractor)
            logger.info(
                "Loaded HuggingFace emotion model '%s' on device=%s",
                _HF_EMOTION_MODEL,
                device,
            )
        except Exception:
            logger.debug(
                "Failed to load HuggingFace emotion model.", exc_info=True,
            )
            return None

    try:
        # Resample to the model's expected sample rate if needed.
        expected_sr = getattr(feature_extractor, "sampling_rate", _TARGET_SR)
        if sr != expected_sr:
            try:
                import librosa
                audio = librosa.resample(audio, orig_sr=sr, target_sr=expected_sr)
            except ImportError:
                logger.debug("librosa not available for resampling.")
                return None

        inputs = feature_extractor(
            audio,
            sampling_rate=expected_sr,
            return_tensors="pt",
            padding=True,
        )
        input_values = inputs["input_values"].to(device)

        with torch.no_grad():
            logits = model(input_values).logits

        probs = torch.nn.functional.softmax(logits, dim=-1).squeeze(0)
        probs_np = probs.cpu().numpy()

        # Map indices to labels.
        id2label = getattr(model.config, "id2label", None)
        if id2label is None:
            id2label = {i: f"emotion_{i}" for i in range(len(probs_np))}

        emotion_scores = {
            str(id2label[i]): float(probs_np[i])
            for i in range(len(probs_np))
        }

        dominant = max(emotion_scores, key=emotion_scores.get)  # type: ignore[arg-type]
        return {
            "emotion": dominant,
            "emotion_scores": emotion_scores,
        }

    except Exception:
        logger.debug("HuggingFace emotion inference failed.", exc_info=True)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_emotion(
    audio_path_or_data: Union[str, AudioData],
    device: str = "cpu",
) -> dict[str, str | dict[str, float] | None]:
    """Detect emotion from a speech audio sample.

    Parameters
    ----------
    audio_path_or_data:
        Path to an audio file **or** a pre-loaded ``AudioData`` instance.
    device:
        PyTorch device for inference.

    Returns
    -------
    dict
        Dictionary with keys:

        - ``emotion`` — Dominant emotion label (e.g. ``"happy"``,
          ``"angry"``), or ``None`` if no backend is available.
        - ``emotion_scores`` — Dict mapping each emotion label to a
          confidence score, or ``None``.
    """
    audio = ensure_audio(audio_path_or_data)

    # Backend 1: FunASR / Emotion2Vec
    result = _try_funasr(audio.path, device)
    if result is not None:
        logger.info(
            "Emotion detected (FunASR): %s (scores: %s)",
            result.get("emotion"),
            result.get("emotion_scores"),
        )
        return result

    # Backend 2: HuggingFace Transformers
    mono = audio.to_mono()
    result = _try_transformers(
        mono.samples.astype(np.float32),
        mono.sample_rate,
        device,
    )
    if result is not None:
        logger.info(
            "Emotion detected (Transformers): %s (scores: %s)",
            result.get("emotion"),
            result.get("emotion_scores"),
        )
        return result

    # No backend available.
    logger.warning(
        "No emotion detection backend available. Install 'funasr' "
        "(recommended) or 'transformers' with a speech emotion model. "
        "Returning None."
    )
    return _null_result()
