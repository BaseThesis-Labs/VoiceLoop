"""Signal-to-noise ratio estimation."""

from __future__ import annotations

import logging

import numpy as np

from ..types import AudioData
from .loader import ensure_audio

logger = logging.getLogger("voice_evals.audio.snr")

# Defaults for frame-level energy computation.
_DEFAULT_FRAME_LENGTH_MS: float = 25.0
_DEFAULT_HOP_LENGTH_MS: float = 10.0

# Fraction of frames classified as speech (highest energy) and noise (lowest).
_SPEECH_PERCENTILE: float = 0.30
_NOISE_PERCENTILE: float = 0.30

# Minimum number of frames needed for a meaningful estimate.
_MIN_FRAMES: int = 3

# Floor value to avoid log(0) and division-by-zero.
_ENERGY_FLOOR: float = 1e-10


def _frame_energies(
    samples: np.ndarray,
    sample_rate: int,
    frame_length_ms: float = _DEFAULT_FRAME_LENGTH_MS,
    hop_length_ms: float = _DEFAULT_HOP_LENGTH_MS,
) -> np.ndarray:
    """Compute per-frame RMS energy.

    Parameters
    ----------
    samples:
        1-D float32 mono audio signal.
    sample_rate:
        Sample rate in Hz.
    frame_length_ms:
        Analysis window length in milliseconds.
    hop_length_ms:
        Hop (stride) between consecutive windows in milliseconds.

    Returns
    -------
    np.ndarray
        1-D array of per-frame energy values (mean squared amplitude).
    """
    frame_len = max(1, int(sample_rate * frame_length_ms / 1000.0))
    hop_len = max(1, int(sample_rate * hop_length_ms / 1000.0))

    n_samples = len(samples)
    if n_samples < frame_len:
        # Entire signal fits within one frame.
        return np.array([np.mean(samples ** 2)], dtype=np.float64)

    n_frames = 1 + (n_samples - frame_len) // hop_len
    energies = np.empty(n_frames, dtype=np.float64)

    for i in range(n_frames):
        start = i * hop_len
        frame = samples[start : start + frame_len]
        energies[i] = np.mean(frame ** 2)

    return energies


def calculate_snr(
    audio: AudioData | str,
    frame_length_ms: float = _DEFAULT_FRAME_LENGTH_MS,
    hop_length_ms: float = _DEFAULT_HOP_LENGTH_MS,
    speech_percentile: float = _SPEECH_PERCENTILE,
    noise_percentile: float = _NOISE_PERCENTILE,
) -> float:
    """Estimate the signal-to-noise ratio (SNR) of an audio signal in dB.

    The method uses energy-based segmentation:

    1. Split the signal into short overlapping frames.
    2. Compute the mean-squared energy of each frame.
    3. Sort frames by energy.
    4. Treat the top *speech_percentile* fraction as speech and the bottom
       *noise_percentile* fraction as noise.
    5. SNR = 10 * log10(mean_speech_energy / mean_noise_energy).

    Parameters
    ----------
    audio:
        An ``AudioData`` instance or a file path string.
    frame_length_ms:
        Analysis frame length in ms (default 25).
    hop_length_ms:
        Hop between frames in ms (default 10).
    speech_percentile:
        Fraction of highest-energy frames treated as speech (default 0.30).
    noise_percentile:
        Fraction of lowest-energy frames treated as noise (default 0.30).

    Returns
    -------
    float
        Estimated SNR in dB.  Returns ``0.0`` for silence-only audio and
        ``float('inf')`` when noise energy is effectively zero.
    """
    audio_data = ensure_audio(audio)
    mono = audio_data.to_mono()

    # Very short or empty audio.
    if mono.samples.size == 0:
        logger.warning("Empty audio — returning SNR 0.0 dB")
        return 0.0

    energies = _frame_energies(
        mono.samples, mono.sample_rate, frame_length_ms, hop_length_ms,
    )

    n_frames = len(energies)
    if n_frames < _MIN_FRAMES:
        logger.warning(
            "Audio too short for reliable SNR (%d frames). "
            "Returning rough estimate.",
            n_frames,
        )
        overall = float(np.mean(energies))
        if overall < _ENERGY_FLOOR:
            return 0.0
        return 10.0 * np.log10(overall / _ENERGY_FLOOR)

    sorted_energies = np.sort(energies)

    n_noise = max(1, int(n_frames * noise_percentile))
    n_speech = max(1, int(n_frames * speech_percentile))

    noise_energy = float(np.mean(sorted_energies[:n_noise]))
    speech_energy = float(np.mean(sorted_energies[-n_speech:]))

    # Handle edge cases.
    if speech_energy < _ENERGY_FLOOR:
        # Entire signal is effectively silence.
        logger.debug("Signal energy below floor — returning SNR 0.0 dB")
        return 0.0

    if noise_energy < _ENERGY_FLOOR:
        # Noise floor is negligible — very clean signal.
        logger.debug("Noise energy below floor — returning +inf SNR")
        return float("inf")

    snr_db = 10.0 * np.log10(speech_energy / noise_energy)

    logger.info("Estimated SNR: %.2f dB", snr_db)
    return float(snr_db)
