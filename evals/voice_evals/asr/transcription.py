"""Whisper-based audio transcription.

Provides a thin, caching wrapper around OpenAI's open-source Whisper model
so that callers can transcribe audio files with a single function call.

The ``whisper`` package is lazy-loaded.  Models are cached at module level
so that repeated calls with the same ``model_name`` and ``device`` do not
trigger redundant weight loading.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("voice_evals.asr.transcription")

# Cache key: (model_name, device) -> loaded whisper model
_model_cache: dict[tuple[str, str], object] = {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_whisper():  # noqa: ANN202
    """Lazy-import the ``whisper`` package."""
    try:
        import whisper
    except ImportError:
        from ..exceptions import MissingDependencyError
        raise MissingDependencyError("openai-whisper", "asr")
    return whisper


def _get_model(model_name: str, device: str):  # noqa: ANN202
    """Return a cached Whisper model, loading it on first access."""
    key = (model_name, device)
    if key not in _model_cache:
        whisper = _require_whisper()
        logger.info("Loading Whisper model '%s' on device '%s'", model_name, device)
        try:
            _model_cache[key] = whisper.load_model(model_name, device=device)
        except Exception as exc:
            from ..exceptions import ModelLoadError
            raise ModelLoadError(
                f"Failed to load Whisper model '{model_name}' on '{device}': {exc}"
            ) from exc
    return _model_cache[key]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def transcribe(
    audio_path: str,
    model_name: str = "base",
    device: str = "cpu",
) -> str:
    """Transcribe an audio file using OpenAI Whisper.

    Parameters
    ----------
    audio_path:
        Path to the audio file (any format ffmpeg can decode).
    model_name:
        Whisper model size.  One of ``"tiny"``, ``"base"``, ``"small"``,
        ``"medium"``, ``"large"``, ``"large-v2"``, ``"large-v3"``.
    device:
        PyTorch device string (``"cpu"``, ``"cuda"``, ``"mps"``).

    Returns
    -------
    str
        The transcribed text (stripped of leading/trailing whitespace).

    Raises
    ------
    MissingDependencyError
        If the ``openai-whisper`` package is not installed.
    TranscriptionError
        If transcription fails for any reason (corrupt file, model error,
        out-of-memory, etc.).
    """
    if not audio_path or not isinstance(audio_path, str):
        from ..exceptions import TranscriptionError
        raise TranscriptionError("audio_path must be a non-empty string")

    model = _get_model(model_name, device)

    logger.info("Transcribing '%s' with Whisper '%s'", audio_path, model_name)

    try:
        result = model.transcribe(audio_path)  # type: ignore[union-attr]
    except Exception as exc:
        from ..exceptions import TranscriptionError
        raise TranscriptionError(
            f"Whisper transcription failed for '{audio_path}': {exc}"
        ) from exc

    text: str = result.get("text", "").strip()  # type: ignore[union-attr]
    logger.debug("Transcript (%d chars): %.120s", len(text), text)
    return text
