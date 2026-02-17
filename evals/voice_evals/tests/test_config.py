"""Tests for voice_evals.config and voice_evals.exceptions."""

import pytest
from voice_evals.config import EvalConfig
from voice_evals.exceptions import (
    VoiceEvalError,
    MissingDependencyError,
    AudioLoadError,
    AuthenticationError,
    TranscriptionError,
    ModelLoadError,
    GroundTruthError,
)


class TestEvalConfig:
    def test_defaults(self):
        config = EvalConfig()
        assert config.device == "auto"
        assert config.whisper_model == "base"
        assert config.saer_lambda == 0.5
        assert config.vad_threshold == 0.5
        assert config.agent_channel == 0
        assert config.user_channel == 1
        assert "um" in config.wer_filler_words

    def test_custom_values(self):
        config = EvalConfig(
            device="cpu",
            whisper_model="large-v3",
            saer_lambda=0.7,
        )
        assert config.device == "cpu"
        assert config.whisper_model == "large-v3"
        assert config.saer_lambda == 0.7

    def test_resolve_device_cpu(self):
        config = EvalConfig(device="cpu")
        assert config.resolve_device() == "cpu"

    def test_resolve_device_auto(self):
        config = EvalConfig(device="auto")
        device = config.resolve_device()
        # Should return one of cpu, cuda, mps
        assert device in ("cpu", "cuda", "mps")

    def test_filler_words_not_shared(self):
        c1 = EvalConfig()
        c2 = EvalConfig()
        c1.wer_filler_words.append("yo")
        assert "yo" not in c2.wer_filler_words


class TestExceptionHierarchy:
    def test_base_exception(self):
        with pytest.raises(VoiceEvalError):
            raise VoiceEvalError("test")

    def test_missing_dependency(self):
        err = MissingDependencyError("torch", "tts")
        assert "torch" in str(err)
        assert "voice-evals[tts]" in str(err)
        assert err.package == "torch"
        assert err.extra == "tts"

    def test_missing_dependency_is_import_error(self):
        with pytest.raises(ImportError):
            raise MissingDependencyError("pkg", "extra")

    def test_audio_load_error(self):
        with pytest.raises(VoiceEvalError):
            raise AudioLoadError("bad file")

    def test_all_subclasses(self):
        for cls in [AudioLoadError, AuthenticationError, TranscriptionError,
                     ModelLoadError, GroundTruthError]:
            assert issubclass(cls, VoiceEvalError)
