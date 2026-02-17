"""Evaluation pipeline configuration."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EvalConfig:
    """Configuration for the evaluation pipeline.

    All fields have sensible defaults. Override only what you need.
    """

    # Device selection: "cpu", "cuda", "mps", or "auto" (pick best available)
    device: str = "auto"

    # Whisper model size for ASR transcription
    whisper_model: str = "base"

    # Directory for caching downloaded models (None = library defaults)
    cache_dir: str | None = None

    # SAER form-vs-semantic balance (0 = pure semantic, 1 = pure form)
    saer_lambda: float = 0.5

    # VAD energy threshold for silence detection
    vad_threshold: float = 0.5

    # Filler words stripped before computing normalized WER
    wer_filler_words: list[str] = field(default_factory=lambda: [
        "um", "uh", "ah", "er", "hmm", "like", "you know",
    ])

    # Stereo channel mapping (for dual-channel recordings)
    agent_channel: int = 0
    user_channel: int = 1

    def resolve_device(self) -> str:
        """Return a concrete device string."""
        if self.device != "auto":
            return self.device
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass
        return "cpu"
