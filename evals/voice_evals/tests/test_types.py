"""Tests for voice_evals.types dataclasses."""

import numpy as np
import pytest
from voice_evals.types import (
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


class TestAudioData:
    def test_to_mono_already_mono(self, mono_audio):
        result = mono_audio.to_mono()
        assert result is mono_audio

    def test_to_mono_from_stereo(self, stereo_audio):
        mono = stereo_audio.to_mono()
        assert mono.channels == 1
        assert mono.samples.ndim == 1
        assert len(mono.samples) == stereo_audio.samples.shape[1]

    def test_get_channel(self, stereo_audio):
        ch0 = stereo_audio.get_channel(0)
        assert ch0.channels == 1
        np.testing.assert_array_equal(ch0.samples, stereo_audio.samples[0])

    def test_get_channel_mono_noop(self, mono_audio):
        result = mono_audio.get_channel(0)
        assert result is mono_audio


class TestEvalResult:
    def test_to_dict_minimal(self, audio_info):
        result = EvalResult(audio=audio_info)
        d = result.to_dict()
        assert "overall_metrics" in d
        assert d["overall_metrics"]["total_duration_seconds"] == 5.0
        assert d["num_speakers"] == 0
        assert d["speaker_metrics"] == []
        assert d["warnings"] == []

    def test_to_dict_with_asr(self, audio_info):
        asr = ASRMetrics(
            transcript="hello world",
            wer=0.1, wer_normalized=0.08, cer=0.05,
            mer=0.1, wip=0.9, wil=0.1, word_accuracy=0.9,
        )
        result = EvalResult(audio=audio_info, asr=asr)
        d = result.to_dict()
        assert d["overall_metrics"]["wer_score"] == 0.1
        assert d["overall_metrics"]["transcript_text"] == "hello world"

    def test_to_dict_with_diarization(self, audio_info):
        spk = SpeakerInfo(
            speaker_id="SPEAKER_00",
            speaking_time=3.0,
            speaking_percentage=60.0,
            num_turns=5,
            avg_turn_duration=0.6,
        )
        dia = DiarizationResult(num_speakers=1, speakers=[spk], timeline="[SPK0]")
        result = EvalResult(audio=audio_info, diarization=dia)
        d = result.to_dict()
        assert d["num_speakers"] == 1
        assert len(d["speaker_metrics"]) == 1
        assert d["speaker_metrics"][0]["speaker_id"] == "SPEAKER_00"

    def test_to_arena_metrics(self, audio_info):
        tts = TTSMetrics(utmos=3.5, nisqa_overall=4.0, dnsmos_overall=3.8, secs=0.9, f0_rmse=10.0)
        asr = ASRMetrics(
            transcript="hi", wer=0.05, wer_normalized=0.04, cer=0.02,
            mer=0.05, wip=0.95, wil=0.05, word_accuracy=0.95,
        )
        latency = LatencyMetrics(ttft_ms=120.0, latency_p50=100.0)
        result = EvalResult(audio=audio_info, asr=asr, tts=tts, latency=latency)
        m = result.to_arena_metrics()
        assert m["utmos"] == 3.5
        assert m["wer"] == 0.05
        assert m["ttfb"] == 120.0
        assert m["medianLatency"] == 100.0

    def test_warnings_propagated(self, audio_info):
        result = EvalResult(audio=audio_info, warnings=["test warning"])
        d = result.to_dict()
        assert "test warning" in d["warnings"]
