"""Tests for voice_evals.latency subpackage."""

import time
import pytest

from voice_evals.latency.rtf import calculate_rtfx, timed_evaluation
from voice_evals.latency.percentiles import calculate_percentiles
from voice_evals.latency.ttft import calculate_ttft, calculate_vart, _ts_diff_ms
from voice_evals.latency.e2e import calculate_e2e_breakdown


class TestCalculateRTFx:
    def test_basic(self):
        assert calculate_rtfx(10.0, 5.0) == pytest.approx(2.0)

    def test_faster_than_realtime(self):
        assert calculate_rtfx(10.0, 1.0) == pytest.approx(10.0)

    def test_slower_than_realtime(self):
        assert calculate_rtfx(1.0, 10.0) == pytest.approx(0.1)

    def test_zero_processing_time(self):
        assert calculate_rtfx(5.0, 0.0) == float("inf")

    def test_zero_audio_duration(self):
        assert calculate_rtfx(0.0, 5.0) == 0.0

    def test_negative_audio_duration(self):
        assert calculate_rtfx(-1.0, 5.0) == 0.0

    def test_negative_processing_time(self):
        with pytest.raises(ValueError):
            calculate_rtfx(5.0, -1.0)


class TestTimedEvaluation:
    def test_measures_time(self):
        with timed_evaluation() as timing:
            time.sleep(0.05)
        assert timing["elapsed"] >= 0.04
        assert timing["elapsed"] < 1.0

    def test_yields_dict(self):
        with timed_evaluation() as timing:
            assert isinstance(timing, dict)
            assert "elapsed" in timing


class TestCalculatePercentiles:
    def test_basic(self):
        latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        result = calculate_percentiles(latencies)
        assert result["p50"] == pytest.approx(55.0)
        assert result["count"] == 10
        assert result["min"] == 10.0
        assert result["max"] == 100.0

    def test_empty(self):
        result = calculate_percentiles([])
        assert result["p50"] is None
        assert result["count"] == 0

    def test_single_value(self):
        result = calculate_percentiles([42.0])
        assert result["p50"] == pytest.approx(42.0)
        assert result["p99"] == pytest.approx(42.0)
        assert result["count"] == 1

    def test_has_all_keys(self):
        result = calculate_percentiles([1, 2, 3])
        expected_keys = {"p50", "p90", "p95", "p99", "mean", "std", "min", "max", "count"}
        assert set(result.keys()) == expected_keys


class TestTsDiffMs:
    def test_basic(self):
        ts = {"start": 1.0, "end": 2.0}
        assert _ts_diff_ms(ts, "start", "end") == pytest.approx(1000.0)

    def test_missing_key(self):
        assert _ts_diff_ms({}, "start", "end") is None

    def test_partial_missing(self):
        assert _ts_diff_ms({"start": 1.0}, "start", "end") is None


class TestCalculateTTFT:
    def test_llm_ttft(self):
        ts = {"llm_start": 1.0, "llm_first_token": 1.150}
        assert calculate_ttft(ts) == pytest.approx(150.0)

    def test_tts_fallback(self):
        ts = {"tts_start": 2.0, "tts_first_byte": 2.050}
        assert calculate_ttft(ts) == pytest.approx(50.0)

    def test_priority_order(self):
        ts = {
            "llm_start": 1.0, "llm_first_token": 1.100,
            "tts_start": 2.0, "tts_first_byte": 2.200,
        }
        # Should prefer llm pair
        assert calculate_ttft(ts) == pytest.approx(100.0)

    def test_no_timestamps(self):
        assert calculate_ttft({}) is None


class TestCalculateVART:
    def test_basic(self):
        ts = {
            "llm_start": 1.0, "llm_first_token": 1.100,
            "tts_start": 2.0, "tts_first_byte": 2.050,
        }
        vart = calculate_vart(ts)
        assert vart == pytest.approx(150.0)

    def test_missing_timestamps(self):
        assert calculate_vart({}) is None
        assert calculate_vart({"llm_start": 1.0}) is None


class TestCalculateE2EBreakdown:
    def test_full_pipeline(self):
        ts = {
            "vad_end": 0.0,
            "stt_start": 0.010,
            "stt_end": 0.510,
            "llm_start": 0.520,
            "llm_first_token": 0.620,
            "llm_end": 1.020,
            "tts_start": 1.030,
            "tts_first_byte": 1.080,
            "tts_end": 1.530,
        }
        result = calculate_e2e_breakdown(ts)
        assert result["vad_to_stt"] == pytest.approx(10.0)
        assert result["stt_duration"] == pytest.approx(500.0)
        assert result["llm_ttft"] == pytest.approx(100.0)
        assert result["tts_ttfb"] == pytest.approx(50.0)
        assert result["total_e2e"] == pytest.approx(1530.0)

    def test_partial_timestamps(self):
        ts = {"llm_start": 1.0, "llm_first_token": 1.1}
        result = calculate_e2e_breakdown(ts)
        assert result["llm_ttft"] == pytest.approx(100.0)
        assert result["total_e2e"] is None

    def test_empty_timestamps(self):
        result = calculate_e2e_breakdown({})
        assert all(v is None for v in result.values())
