"""Audio I/O, preprocessing, and analysis."""

from __future__ import annotations

from .loader import ensure_audio, load_audio
from .snr import calculate_snr
from .vad import calculate_speaking_time, detect_speech_segments

# diarize is intentionally not imported at package level because it pulls in
# heavy optional dependencies (pyannote.audio, torch).  Import it explicitly:
#   from voice_evals.audio.diarization import diarize

__all__ = [
    "calculate_snr",
    "calculate_speaking_time",
    "detect_speech_segments",
    "ensure_audio",
    "load_audio",
]
