"""Integration tests for VoiceEvalPipeline."""

import json
from unittest.mock import patch, MagicMock

import numpy as np
import pytest

from voice_evals.config import EvalConfig
from voice_evals.pipeline import VoiceEvalPipeline
from voice_evals.types import AudioData, EvalResult


@pytest.fixture
def pipeline():
    return VoiceEvalPipeline(config=EvalConfig(device="cpu", whisper_model="base"))


@pytest.fixture
def mock_audio():
    """An AudioData that load_audio would return."""
    return AudioData(
        samples=np.random.default_rng(42).standard_normal(16000).astype(np.float32),
        sample_rate=16000,
        channels=1,
        duration=1.0,
        path="/tmp/test.wav",
    )


class TestPipelineEvaluate:
    @patch("voice_evals.audio.snr.calculate_snr", return_value=25.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_minimal_evaluation(self, mock_load, mock_snr, pipeline, mock_audio):
        mock_load.return_value = mock_audio
        result = pipeline.evaluate("/tmp/test.wav", groups=[])
        assert isinstance(result, EvalResult)
        assert result.audio.duration_seconds == 1.0
        assert result.audio.snr_db == 25.0
        assert result.asr is None
        assert result.tts is None

    @patch("voice_evals.audio.snr.calculate_snr", return_value=20.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_latency_with_timestamps(self, mock_load, mock_snr, pipeline, mock_audio):
        mock_load.return_value = mock_audio
        timestamps = {
            "llm_start": 1.0,
            "llm_first_token": 1.150,
            "llm_end": 2.0,
        }
        result = pipeline.evaluate(
            "/tmp/test.wav",
            groups=["latency"],
            timestamps=timestamps,
        )
        assert result.latency is not None
        assert result.latency.ttft_ms == pytest.approx(150.0)

    @patch("voice_evals.audio.snr.calculate_snr", return_value=20.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_result_to_dict(self, mock_load, mock_snr, pipeline, mock_audio):
        mock_load.return_value = mock_audio
        result = pipeline.evaluate("/tmp/test.wav", groups=[])
        d = result.to_dict()
        assert "overall_metrics" in d
        assert "warnings" in d
        # Should be JSON-serializable
        json.dumps(d)

    @patch("voice_evals.audio.snr.calculate_snr", return_value=20.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_evaluate_batch(self, mock_load, mock_snr, pipeline, mock_audio):
        mock_load.return_value = mock_audio
        results = pipeline.evaluate_batch(
            ["/tmp/a.wav", "/tmp/b.wav"],
            groups=[],
        )
        assert len(results) == 2
        assert all(isinstance(r, EvalResult) for r in results)

    @patch("voice_evals.audio.snr.calculate_snr", return_value=20.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_ground_truth_from_string(self, mock_load, mock_snr, pipeline, mock_audio):
        mock_load.return_value = mock_audio
        result = pipeline.evaluate(
            "/tmp/test.wav",
            ground_truth="hello world",
            groups=[],
        )
        assert isinstance(result, EvalResult)

    @patch("voice_evals.audio.snr.calculate_snr", return_value=20.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_ground_truth_from_file(self, mock_load, mock_snr, pipeline, mock_audio, tmp_path):
        mock_load.return_value = mock_audio
        gt_file = tmp_path / "ref.txt"
        gt_file.write_text("hello world")
        result = pipeline.evaluate(
            "/tmp/test.wav",
            ground_truth=str(gt_file),
            groups=[],
        )
        assert isinstance(result, EvalResult)

    @patch("voice_evals.audio.snr.calculate_snr", return_value=20.0)
    @patch("voice_evals.audio.loader.load_audio")
    def test_agent_skipped_without_transcript(self, mock_load, mock_snr, pipeline, mock_audio):
        mock_load.return_value = mock_audio
        result = pipeline.evaluate(
            "/tmp/test.wav",
            groups=["agent"],
        )
        # Agent should be skipped with a warning since no transcript
        assert result.agent is None
        assert any("no transcript" in w.lower() for w in result.warnings)


class TestPipelineConfig:
    def test_default_config(self):
        pipeline = VoiceEvalPipeline()
        assert pipeline.config.device == "auto"
        assert pipeline.config.whisper_model == "base"

    def test_custom_config(self):
        config = EvalConfig(device="cpu", whisper_model="tiny")
        pipeline = VoiceEvalPipeline(config=config)
        assert pipeline.config.device == "cpu"
        assert pipeline.config.whisper_model == "tiny"
