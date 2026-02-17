"""voice_evals — comprehensive voice AI evaluation toolkit."""

from .config import EvalConfig
from .pipeline import VoiceEvalPipeline
from .types import (
    AudioData,
    AudioInfo,
    ASRMetrics,
    TTSMetrics,
    AgentMetrics,
    LatencyMetrics,
    SpeakerInfo,
    DiarizationResult,
    EvalResult,
)
from .exceptions import (
    VoiceEvalError,
    MissingDependencyError,
    AudioLoadError,
    AuthenticationError,
    TranscriptionError,
    ModelLoadError,
    GroundTruthError,
)

__version__ = "0.1.0"

__all__ = [
    "VoiceEvalPipeline",
    "EvalConfig",
    "AudioData",
    "AudioInfo",
    "ASRMetrics",
    "TTSMetrics",
    "AgentMetrics",
    "LatencyMetrics",
    "SpeakerInfo",
    "DiarizationResult",
    "EvalResult",
    "VoiceEvalError",
    "MissingDependencyError",
    "AudioLoadError",
    "AuthenticationError",
    "TranscriptionError",
    "ModelLoadError",
    "GroundTruthError",
]
