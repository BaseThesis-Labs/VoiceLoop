"""Tests for voice_evals.audio subpackage."""

import numpy as np
import pytest

from voice_evals.audio.snr import calculate_snr, _frame_energies
from voice_evals.audio.vad import (
    detect_speech_segments,
    calculate_speaking_time,
    _energy_vad,
    _merge_segments,
)
from voice_evals.audio.loader import load_audio, ensure_audio, _validate_path
from voice_evals.exceptions import AudioLoadError
from voice_evals.types import AudioData


class TestFrameEnergies:
    def test_basic_shape(self, mono_audio):
        energies = _frame_energies(mono_audio.samples, mono_audio.sample_rate)
        assert len(energies) > 0
        assert energies.dtype == np.float64

    def test_silence_has_zero_energy(self, silence_audio):
        energies = _frame_energies(silence_audio.samples, silence_audio.sample_rate)
        np.testing.assert_allclose(energies, 0.0, atol=1e-10)


class TestCalculateSNR:
    def test_positive_snr_for_signal(self, mono_audio):
        snr = calculate_snr(mono_audio)
        assert snr > 0, "Expected positive SNR for a tone with low noise"

    def test_silence_returns_zero(self, silence_audio):
        snr = calculate_snr(silence_audio)
        assert snr == 0.0

    def test_stereo_handled(self, stereo_audio):
        snr = calculate_snr(stereo_audio)
        assert isinstance(snr, float)


class TestLoadAudio:
    def test_load_wav_file(self, wav_file):
        audio = load_audio(wav_file)
        assert isinstance(audio, AudioData)
        assert audio.channels == 1
        assert audio.sample_rate == 16000
        assert audio.duration > 0

    def test_nonexistent_file(self):
        with pytest.raises(AudioLoadError, match="File not found"):
            load_audio("/nonexistent/audio.wav")

    def test_unsupported_extension(self, tmp_path):
        f = tmp_path / "test.xyz"
        f.write_text("not audio")
        with pytest.raises(AudioLoadError, match="Unsupported audio format"):
            load_audio(str(f))

    def test_ensure_audio_passthrough(self, mono_audio):
        result = ensure_audio(mono_audio)
        assert result is mono_audio

    def test_ensure_audio_from_path(self, wav_file):
        result = ensure_audio(wav_file)
        assert isinstance(result, AudioData)


class TestValidatePath:
    def test_directory_raises(self, tmp_path):
        with pytest.raises(AudioLoadError, match="not a regular file"):
            _validate_path(str(tmp_path))


class TestEnergyVAD:
    def test_detects_speech_in_signal(self, mono_audio):
        segments = _energy_vad(mono_audio, threshold=0.5)
        assert len(segments) > 0, "Should detect speech in a tone signal"
        for start, end in segments:
            assert end > start

    def test_no_speech_in_silence(self, silence_audio):
        segments = _energy_vad(silence_audio, threshold=0.5)
        assert len(segments) == 0

    def test_detect_speech_segments_public(self, mono_audio):
        segments = detect_speech_segments(mono_audio, prefer_silero=False)
        assert isinstance(segments, list)


class TestMergeSegments:
    def test_merge_close_segments(self):
        segs = [(0.0, 0.5), (0.52, 1.0)]
        merged = _merge_segments(segs, max_gap=0.05)
        assert len(merged) == 1
        assert merged[0] == (0.0, 1.0)

    def test_keep_distant_segments(self):
        segs = [(0.0, 0.5), (1.0, 1.5)]
        merged = _merge_segments(segs, max_gap=0.05)
        assert len(merged) == 2

    def test_empty_input(self):
        assert _merge_segments([], max_gap=0.05) == []


class TestCalculateSpeakingTime:
    def test_basic(self):
        segments = [(0.0, 1.0), (2.0, 3.5)]
        assert calculate_speaking_time(segments) == pytest.approx(2.5)

    def test_empty(self):
        assert calculate_speaking_time([]) == 0.0
