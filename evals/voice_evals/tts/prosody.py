"""Prosody analysis (F0, pitch variation, pace, intonation).

Extracts prosodic features from speech audio using fundamental frequency (F0)
analysis, energy-based syllable rate estimation, and intonation contour
characterisation.  When a reference audio is provided, F0-RMSE is computed to
quantify how closely the synthesised speech matches the reference prosody.
"""

from __future__ import annotations

import logging
from typing import Union

import numpy as np

from ..audio.loader import ensure_audio
from ..exceptions import MissingDependencyError
from ..types import AudioData

logger = logging.getLogger("voice_evals.tts.prosody")

# Module-level cache (not used for heavy models here, but kept for
# consistency with other modules and potential future caching).
_model_cache: dict[str, object] = {}

# ---- F0 extraction parameters ----
_F0_FMIN: float = 50.0
_F0_FMAX: float = 500.0

# ---- Monotone scoring ----
# A pitch standard deviation below this (in Hz) is considered highly monotone.
_MONOTONE_STD_THRESHOLD: float = 50.0

# ---- Pace scoring ----
# Maximum expected standard deviation of inter-onset intervals (seconds).
_PACE_MAX_EXPECTED_STD: float = 0.25

# ---- Composite weights ----
_W_PITCH: float = 0.3
_W_PACE: float = 0.3
_W_INTONATION: float = 0.4


def _ensure_librosa():
    """Lazily import librosa, raising a user-friendly error if absent."""
    try:
        import librosa  # noqa: F811
        return librosa
    except ImportError:
        raise MissingDependencyError("librosa", "core")


def _extract_f0(y: np.ndarray, sr: int):
    """Extract F0 contour using pYIN.

    Parameters
    ----------
    y : np.ndarray
        Mono float32 waveform.
    sr : int
        Sample rate.

    Returns
    -------
    tuple[np.ndarray, np.ndarray, np.ndarray]
        ``(f0, voiced_flag, voiced_probs)``
        ``f0`` contains NaN for unvoiced frames.
    """
    librosa = _ensure_librosa()
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=_F0_FMIN,
        fmax=_F0_FMAX,
        sr=sr,
    )
    return f0, voiced_flag, voiced_probs


def _valid_f0(f0: np.ndarray) -> np.ndarray:
    """Return only the voiced (non-NaN) F0 values."""
    return f0[~np.isnan(f0)]


def _compute_pitch_metrics(f0: np.ndarray) -> tuple[float, float]:
    """Compute pitch standard deviation and monotone score.

    Parameters
    ----------
    f0 : np.ndarray
        Raw F0 contour (may contain NaN).

    Returns
    -------
    tuple[float, float]
        ``(pitch_std_hz, monotone_score)``
    """
    voiced = _valid_f0(f0)
    if len(voiced) < 2:
        return 0.0, 1.0

    pitch_std = float(np.std(voiced))
    monotone = 1.0 - min(pitch_std / _MONOTONE_STD_THRESHOLD, 1.0)
    return pitch_std, monotone


def _compute_pace_metrics(y: np.ndarray, sr: int) -> tuple[float, float]:
    """Estimate speaking pace variation from energy-envelope onset peaks.

    Parameters
    ----------
    y : np.ndarray
        Mono waveform.
    sr : int
        Sample rate.

    Returns
    -------
    tuple[float, float]
        ``(pace_std, pace_score)``
        ``pace_std`` is the standard deviation of inter-onset intervals in
        seconds.  ``pace_score`` is 1.0 for perfectly even pace and decreases
        toward 0 for highly variable pace.
    """
    librosa = _ensure_librosa()

    # Compute onset strength envelope.
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    # Detect onset frames.
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        units="frames",
    )

    if len(onset_frames) < 3:
        # Not enough onsets to measure variability.
        return 0.0, 1.0

    # Convert onset frames to time in seconds.
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    intervals = np.diff(onset_times)

    if len(intervals) < 2:
        return 0.0, 1.0

    pace_std = float(np.std(intervals))
    pace_score = 1.0 - min(pace_std / _PACE_MAX_EXPECTED_STD, 1.0)
    return pace_std, pace_score


def _compute_intonation_score(f0: np.ndarray) -> float:
    """Score intonation variety based on F0 contour shape analysis.

    Measures the presence of rising and falling pitch patterns.  A score of
    1.0 indicates rich, varied intonation; 0.0 indicates flat/absent
    intonation.

    Parameters
    ----------
    f0 : np.ndarray
        F0 contour (may contain NaN).

    Returns
    -------
    float
        Intonation score in ``[0, 1]``.
    """
    voiced = _valid_f0(f0)
    if len(voiced) < 4:
        return 0.0

    # Compute first-order differences (Hz per frame).
    diffs = np.diff(voiced)

    # Count rising vs falling transitions.
    rising = np.sum(diffs > 0)
    falling = np.sum(diffs < 0)
    total = len(diffs)

    if total == 0:
        return 0.0

    # A balanced mix of rising/falling indicates natural intonation.
    # Pure rising or pure falling is less natural than a mixture.
    rising_ratio = rising / total
    falling_ratio = falling / total

    # Balance metric: 1.0 when 50/50, 0.0 when all one direction.
    balance = 1.0 - abs(rising_ratio - falling_ratio)

    # Magnitude of pitch changes (normalised).
    mean_abs_diff = float(np.mean(np.abs(diffs)))
    # Larger pitch excursions (up to a point) indicate more expressive
    # intonation.  Cap at 30 Hz mean change per frame.
    magnitude_score = min(mean_abs_diff / 30.0, 1.0)

    # Combine balance and magnitude.
    intonation = 0.5 * balance + 0.5 * magnitude_score
    return float(np.clip(intonation, 0.0, 1.0))


def _compute_f0_rmse(
    f0_ref: np.ndarray,
    f0_hyp: np.ndarray,
) -> float | None:
    """Compute F0 RMSE between reference and hypothesis contours.

    Only voiced frames present in **both** contours are compared.  If the
    contours differ in length, the shorter one is used and frames are aligned
    from the start.

    Parameters
    ----------
    f0_ref : np.ndarray
        Reference F0 contour.
    f0_hyp : np.ndarray
        Hypothesis (synthesised) F0 contour.

    Returns
    -------
    float or None
        RMSE in Hz, or ``None`` if there are insufficient aligned voiced
        frames.
    """
    min_len = min(len(f0_ref), len(f0_hyp))
    if min_len == 0:
        return None

    ref = f0_ref[:min_len]
    hyp = f0_hyp[:min_len]

    # Keep only mutually voiced frames.
    mask = ~np.isnan(ref) & ~np.isnan(hyp)
    if np.sum(mask) < 2:
        return None

    diff = ref[mask] - hyp[mask]
    rmse = float(np.sqrt(np.mean(diff ** 2)))
    return rmse


def analyze_prosody(
    audio_path_or_data: Union[str, AudioData],
    reference_path_or_data: Union[str, AudioData, None] = None,
) -> dict[str, float | None]:
    """Analyse prosodic features of a speech signal.

    Parameters
    ----------
    audio_path_or_data:
        Path to an audio file **or** a pre-loaded ``AudioData`` instance for
        the hypothesis (synthesised) speech.
    reference_path_or_data:
        Optional reference audio for computing F0-RMSE.  Can be a file path
        or ``AudioData``.

    Returns
    -------
    dict[str, float | None]
        Dictionary with keys:

        - ``f0_rmse`` — F0 RMSE vs. reference (``None`` if no reference).
        - ``pitch_std_hz`` — Standard deviation of voiced F0 in Hz.
        - ``monotone_score`` — 0 (expressive) to 1 (monotone).
        - ``pace_std`` — Std of inter-onset intervals in seconds.
        - ``pace_score`` — 0 (irregular pace) to 1 (even pace).
        - ``intonation_score`` — 0 (flat) to 1 (varied intonation).
        - ``prosody_score`` — Weighted composite score (higher = better).
    """
    _ensure_librosa()

    audio = ensure_audio(audio_path_or_data)
    mono = audio.to_mono()
    y = mono.samples.astype(np.float32)
    sr = mono.sample_rate

    if y.size == 0:
        logger.warning("Empty audio — returning zero prosody scores.")
        return {
            "f0_rmse": None,
            "pitch_std_hz": 0.0,
            "monotone_score": 1.0,
            "pace_std": 0.0,
            "pace_score": 1.0,
            "intonation_score": 0.0,
            "prosody_score": 0.0,
        }

    # ---- F0 extraction ----
    f0, _, _ = _extract_f0(y, sr)

    # ---- Pitch metrics ----
    pitch_std_hz, monotone_score = _compute_pitch_metrics(f0)

    # ---- Pace metrics ----
    pace_std, pace_score = _compute_pace_metrics(y, sr)

    # ---- Intonation ----
    intonation_score = _compute_intonation_score(f0)

    # ---- F0 RMSE (optional) ----
    f0_rmse: float | None = None
    if reference_path_or_data is not None:
        try:
            ref_audio = ensure_audio(reference_path_or_data)
            ref_mono = ref_audio.to_mono()
            ref_y = ref_mono.samples.astype(np.float32)
            ref_sr = ref_mono.sample_rate

            # Resample reference to match hypothesis if needed.
            if ref_sr != sr:
                ref_audio_resampled = ref_mono.resample(sr)
                ref_y = ref_audio_resampled.samples.astype(np.float32)

            f0_ref, _, _ = _extract_f0(ref_y, sr)
            f0_rmse = _compute_f0_rmse(f0_ref, f0)
        except Exception:
            logger.exception("Failed to compute F0-RMSE against reference")
            f0_rmse = None

    # ---- Composite prosody score ----
    # Higher is better: invert monotone_score (1 = monotone is bad).
    expressiveness = 1.0 - monotone_score
    prosody_score = (
        _W_PITCH * expressiveness
        + _W_PACE * pace_score
        + _W_INTONATION * intonation_score
    )
    prosody_score = float(np.clip(prosody_score, 0.0, 1.0))

    result = {
        "f0_rmse": f0_rmse,
        "pitch_std_hz": pitch_std_hz,
        "monotone_score": monotone_score,
        "pace_std": pace_std,
        "pace_score": pace_score,
        "intonation_score": intonation_score,
        "prosody_score": prosody_score,
    }

    logger.info(
        "Prosody analysis — pitch_std=%.1f Hz, monotone=%.2f, pace_std=%.3f, "
        "pace=%.2f, intonation=%.2f, composite=%.2f, f0_rmse=%s",
        pitch_std_hz,
        monotone_score,
        pace_std,
        pace_score,
        intonation_score,
        prosody_score,
        f0_rmse,
    )
    return result
