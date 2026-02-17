"""Voice activity detection."""

from __future__ import annotations

import logging
from typing import Sequence

import numpy as np

from ..types import AudioData
from .loader import ensure_audio

logger = logging.getLogger("voice_evals.audio.vad")

# Energy-based VAD defaults.
_FRAME_LENGTH_MS: float = 25.0
_HOP_LENGTH_MS: float = 10.0
_MIN_SEGMENT_DURATION: float = 0.100  # seconds
_MERGE_GAP: float = 0.050  # merge segments closer than 50 ms


# ---------------------------------------------------------------------------
# Silero VAD (optional, lazy-loaded)
# ---------------------------------------------------------------------------

def _silero_available() -> bool:
    """Return ``True`` if Silero VAD can be used."""
    try:
        import torch  # noqa: F401
        return True
    except ImportError:
        return False


def _silero_vad(
    audio: AudioData,
    threshold: float,
) -> list[tuple[float, float]]:
    """Run Silero VAD via ``torch.hub``.

    Parameters
    ----------
    audio:
        Mono, 16 kHz AudioData (will be resampled internally if needed).
    threshold:
        Speech probability threshold in [0, 1].

    Returns
    -------
    list[tuple[float, float]]
        Speech segments as ``(start_sec, end_sec)`` pairs.
    """
    import torch

    SILERO_SR = 16_000

    mono = audio.to_mono()
    if mono.sample_rate != SILERO_SR:
        mono = mono.resample(SILERO_SR)

    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        trust_repo=True,
    )
    get_speech_timestamps = utils[0]

    wav_tensor = torch.from_numpy(mono.samples).float()

    timestamps = get_speech_timestamps(
        wav_tensor,
        model,
        threshold=threshold,
        sampling_rate=SILERO_SR,
        return_seconds=True,
    )

    segments: list[tuple[float, float]] = [
        (float(ts["start"]), float(ts["end"])) for ts in timestamps
    ]

    logger.info(
        "Silero VAD found %d speech segment(s) (threshold=%.2f)",
        len(segments),
        threshold,
    )
    return segments


# ---------------------------------------------------------------------------
# Energy-based VAD (always available)
# ---------------------------------------------------------------------------

def _energy_vad(
    audio: AudioData,
    threshold: float,
    frame_length_ms: float = _FRAME_LENGTH_MS,
    hop_length_ms: float = _HOP_LENGTH_MS,
    min_segment_duration: float = _MIN_SEGMENT_DURATION,
    merge_gap: float = _MERGE_GAP,
) -> list[tuple[float, float]]:
    """Simple energy-based voice activity detection.

    Algorithm
    ---------
    1. Compute per-frame energy (mean squared amplitude).
    2. Derive an adaptive threshold: ``mean_energy * threshold``.
    3. Mark frames whose energy exceeds the threshold as speech.
    4. Merge adjacent speech frames into contiguous segments.
    5. Discard segments shorter than *min_segment_duration*.

    Parameters
    ----------
    audio:
        AudioData (should be mono; will be converted if needed).
    threshold:
        Multiplier applied to mean frame energy to determine the speech /
        silence boundary.  Higher values require louder speech.
    frame_length_ms:
        Window length in milliseconds.
    hop_length_ms:
        Hop size in milliseconds.
    min_segment_duration:
        Minimum segment length in seconds — shorter bursts are discarded.
    merge_gap:
        Maximum gap (seconds) between two segments that will be merged.

    Returns
    -------
    list[tuple[float, float]]
        Speech segments as ``(start_sec, end_sec)`` pairs.
    """
    mono = audio.to_mono()
    samples = mono.samples
    sr = mono.sample_rate

    frame_len = max(1, int(sr * frame_length_ms / 1000.0))
    hop_len = max(1, int(sr * hop_length_ms / 1000.0))
    n_samples = len(samples)

    if n_samples < frame_len:
        energy = float(np.mean(samples ** 2))
        if energy > 0:
            return [(0.0, mono.duration)]
        return []

    n_frames = 1 + (n_samples - frame_len) // hop_len
    energies = np.empty(n_frames, dtype=np.float64)
    for i in range(n_frames):
        start = i * hop_len
        frame = samples[start : start + frame_len]
        energies[i] = np.mean(frame ** 2)

    mean_energy = float(np.mean(energies))
    energy_threshold = mean_energy * threshold

    # Detect speech frames.
    is_speech = energies > energy_threshold

    # Convert boolean mask to contiguous segments.
    raw_segments: list[tuple[float, float]] = []
    in_segment = False
    seg_start = 0.0

    for i in range(n_frames):
        t = i * hop_len / sr
        if is_speech[i] and not in_segment:
            seg_start = t
            in_segment = True
        elif not is_speech[i] and in_segment:
            raw_segments.append((seg_start, t))
            in_segment = False

    # Close any open segment.
    if in_segment:
        raw_segments.append((seg_start, min(mono.duration, n_frames * hop_len / sr)))

    # Merge segments separated by a tiny gap.
    merged = _merge_segments(raw_segments, merge_gap)

    # Drop very short segments.
    segments = [
        (s, e) for s, e in merged if (e - s) >= min_segment_duration
    ]

    logger.info(
        "Energy VAD found %d speech segment(s) (threshold=%.2f)",
        len(segments),
        threshold,
    )
    return segments


def _merge_segments(
    segments: list[tuple[float, float]],
    max_gap: float,
) -> list[tuple[float, float]]:
    """Merge segments that are separated by less than *max_gap* seconds."""
    if not segments:
        return []

    merged: list[tuple[float, float]] = [segments[0]]
    for start, end in segments[1:]:
        prev_start, prev_end = merged[-1]
        if start - prev_end <= max_gap:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_speech_segments(
    audio: AudioData | str,
    threshold: float = 0.5,
    *,
    prefer_silero: bool = True,
) -> list[tuple[float, float]]:
    """Detect speech segments in an audio signal.

    By default the function tries to use **Silero VAD** (requires ``torch``)
    for higher accuracy.  If ``torch`` is not installed it transparently falls
    back to a lightweight energy-based detector that has no ML dependencies.

    Parameters
    ----------
    audio:
        An ``AudioData`` instance or a file path.
    threshold:
        Detection sensitivity.  For Silero VAD this is the speech probability
        threshold (0--1, default 0.5).  For energy-based VAD this is a
        multiplier on mean frame energy.
    prefer_silero:
        If ``True`` (default) and ``torch`` is available, use Silero VAD.
        Set to ``False`` to force energy-based detection.

    Returns
    -------
    list[tuple[float, float]]
        Each element is a ``(start_seconds, end_seconds)`` pair.
    """
    audio_data = ensure_audio(audio)

    if prefer_silero and _silero_available():
        try:
            return _silero_vad(audio_data, threshold)
        except Exception:
            logger.warning(
                "Silero VAD failed; falling back to energy-based VAD",
                exc_info=True,
            )

    return _energy_vad(audio_data, threshold)


def calculate_speaking_time(segments: Sequence[tuple[float, float]]) -> float:
    """Calculate total speaking time from a list of speech segments.

    Parameters
    ----------
    segments:
        Iterable of ``(start_seconds, end_seconds)`` tuples as returned by
        :func:`detect_speech_segments`.

    Returns
    -------
    float
        Total speaking duration in seconds.
    """
    return sum(max(0.0, end - start) for start, end in segments)
