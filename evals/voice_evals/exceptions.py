"""Voice evals exception hierarchy."""

from __future__ import annotations


class VoiceEvalError(Exception):
    """Base exception for all voice_evals errors."""


class MissingDependencyError(VoiceEvalError, ImportError):
    """Raised when an optional dependency is not installed."""

    def __init__(self, package: str, extra: str) -> None:
        self.package = package
        self.extra = extra
        super().__init__(
            f"'{package}' is required for this metric. "
            f"Install it with: pip install voice-evals[{extra}]"
        )


class AudioLoadError(VoiceEvalError):
    """Audio file is missing, corrupt, or in an unsupported format."""


class AuthenticationError(VoiceEvalError):
    """HuggingFace token is invalid or missing for a gated model."""


class TranscriptionError(VoiceEvalError):
    """Speech-to-text transcription failed."""


class ModelLoadError(VoiceEvalError):
    """ML model failed to load (OOM, corrupt weights, etc)."""


class GroundTruthError(VoiceEvalError):
    """Ground truth transcript file is missing or unreadable."""
