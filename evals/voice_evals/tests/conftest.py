"""Shared fixtures for voice_evals tests."""

import numpy as np
import pytest
from voice_evals.types import AudioData, AudioInfo


@pytest.fixture
def mono_audio():
    """1-second mono audio at 16kHz — sine wave + noise."""
    sr = 16000
    t = np.linspace(0, 1.0, sr, dtype=np.float32)
    # 440 Hz sine wave with a little noise
    samples = 0.5 * np.sin(2 * np.pi * 440 * t) + 0.02 * np.random.default_rng(42).standard_normal(sr).astype(np.float32)
    return AudioData(
        samples=samples,
        sample_rate=sr,
        channels=1,
        duration=1.0,
        path="/tmp/test_mono.wav",
    )


@pytest.fixture
def stereo_audio():
    """1-second stereo audio at 16kHz."""
    sr = 16000
    rng = np.random.default_rng(42)
    t = np.linspace(0, 1.0, sr, dtype=np.float32)
    ch0 = 0.5 * np.sin(2 * np.pi * 440 * t).astype(np.float32)
    ch1 = 0.3 * np.sin(2 * np.pi * 880 * t).astype(np.float32)
    samples = np.stack([ch0, ch1])
    return AudioData(
        samples=samples,
        sample_rate=sr,
        channels=2,
        duration=1.0,
        path="/tmp/test_stereo.wav",
    )


@pytest.fixture
def silence_audio():
    """1-second of silence at 16kHz."""
    sr = 16000
    samples = np.zeros(sr, dtype=np.float32)
    return AudioData(
        samples=samples,
        sample_rate=sr,
        channels=1,
        duration=1.0,
        path="/tmp/test_silence.wav",
    )


@pytest.fixture
def audio_info():
    """Basic AudioInfo fixture."""
    return AudioInfo(
        duration_seconds=5.0,
        sample_rate=16000,
        channels=1,
        snr_db=25.0,
        is_stereo=False,
    )


@pytest.fixture
def wav_file(tmp_path, mono_audio):
    """Write mono_audio to an actual .wav file and return the path."""
    import soundfile as sf
    path = tmp_path / "test.wav"
    sf.write(str(path), mono_audio.samples, mono_audio.sample_rate)
    return str(path)
