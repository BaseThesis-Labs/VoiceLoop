"""Audio file loading, validation, and preprocessing."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import numpy as np

from ..exceptions import AudioLoadError
from ..types import AudioData

logger = logging.getLogger("voice_evals.audio.loader")

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({
    ".wav", ".mp3", ".flac", ".ogg", ".m4a",
})


def _validate_path(path: str) -> Path:
    """Validate that *path* points to a readable, supported audio file.

    Raises
    ------
    AudioLoadError
        If the file does not exist, is not readable, or has an unsupported
        extension.
    """
    p = Path(path)

    if not p.exists():
        raise AudioLoadError(f"File not found: {path}")

    if not p.is_file():
        raise AudioLoadError(f"Path is not a regular file: {path}")

    if not os.access(p, os.R_OK):
        raise AudioLoadError(f"File is not readable: {path}")

    ext = p.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise AudioLoadError(
            f"Unsupported audio format '{ext}'. "
            f"Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    return p


def _load_with_soundfile(path: Path) -> tuple[np.ndarray, int]:
    """Attempt to load audio via *soundfile*.

    Returns
    -------
    tuple[np.ndarray, int]
        ``(samples, sample_rate)`` where samples is float32 with shape
        ``(n_samples,)`` for mono or ``(channels, n_samples)`` for multi-channel.

    Raises
    ------
    AudioLoadError
        If soundfile cannot read the file.
    """
    try:
        import soundfile as sf
    except ImportError:
        raise AudioLoadError(
            "soundfile is not installed. Install it with: pip install soundfile"
        )

    try:
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    except Exception as exc:
        raise AudioLoadError(f"soundfile failed to read '{path}': {exc}") from exc

    # sf.read returns (frames, channels) — transpose to (channels, frames)
    if data.shape[1] == 1:
        samples = data[:, 0]  # mono → 1-D
    else:
        samples = data.T  # (channels, frames)

    return samples, int(sr)


def _load_with_librosa(path: Path) -> tuple[np.ndarray, int]:
    """Fallback loader using *librosa*.

    Librosa always returns mono by default; we respect the original channel
    layout by loading with ``mono=False``.

    Returns
    -------
    tuple[np.ndarray, int]
        ``(samples, sample_rate)``

    Raises
    ------
    AudioLoadError
        If librosa is not installed or cannot read the file.
    """
    try:
        import librosa
    except ImportError:
        raise AudioLoadError(
            "Neither soundfile nor librosa could load the file. "
            "Install at least one: pip install soundfile  OR  pip install librosa"
        )

    try:
        # sr=None preserves original sample rate; mono=False keeps all channels.
        data, sr = librosa.load(str(path), sr=None, mono=False)
    except Exception as exc:
        raise AudioLoadError(f"librosa failed to read '{path}': {exc}") from exc

    samples = data.astype(np.float32)
    return samples, int(sr)


def load_audio(path: str) -> AudioData:
    """Load and validate an audio file.

    The function first attempts to read via *soundfile* (fast C-based backend).
    If that fails it falls back to *librosa* which can handle a broader range of
    codecs via ffmpeg.

    Parameters
    ----------
    path:
        Filesystem path to the audio file.

    Returns
    -------
    AudioData
        Standardized audio representation.

    Raises
    ------
    AudioLoadError
        If the file cannot be loaded by any available backend.
    """
    validated = _validate_path(path)
    logger.debug("Loading audio: %s", validated)

    samples: np.ndarray | None = None
    sr: int = 0
    soundfile_err: AudioLoadError | None = None

    # Primary: soundfile
    try:
        samples, sr = _load_with_soundfile(validated)
    except AudioLoadError as exc:
        soundfile_err = exc
        logger.debug("soundfile failed, trying librosa fallback: %s", exc)

    # Fallback: librosa
    if samples is None:
        try:
            samples, sr = _load_with_librosa(validated)
        except AudioLoadError:
            # Re-raise the original soundfile error if librosa also fails,
            # since soundfile is the primary backend.
            raise soundfile_err or AudioLoadError(
                f"All backends failed to load '{path}'"
            )

    # Determine channel count and duration.
    if samples.ndim == 1:
        channels = 1
        n_samples = samples.shape[0]
    else:
        channels = samples.shape[0]
        n_samples = samples.shape[1]

    if n_samples == 0:
        raise AudioLoadError(f"Audio file contains no samples: {path}")

    duration = n_samples / sr

    logger.info(
        "Loaded %s — %.2fs, %dHz, %d channel(s)",
        validated.name,
        duration,
        sr,
        channels,
    )

    return AudioData(
        samples=samples,
        sample_rate=sr,
        channels=channels,
        duration=duration,
        path=str(validated.resolve()),
    )


def ensure_audio(audio: AudioData | str) -> AudioData:
    """Convenience helper: accept either an ``AudioData`` or a file path.

    Parameters
    ----------
    audio:
        An already-loaded ``AudioData`` instance or a string file path.

    Returns
    -------
    AudioData
    """
    if isinstance(audio, AudioData):
        return audio
    return load_audio(audio)
