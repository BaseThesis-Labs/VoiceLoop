"""Result dataclasses for all evaluation metrics."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

import numpy as np


# ---------------------------------------------------------------------------
# Audio types
# ---------------------------------------------------------------------------

@dataclass
class AudioData:
    """Standardized audio representation used across all modules."""

    samples: np.ndarray  # float32, shape (channels, samples) or (samples,)
    sample_rate: int
    channels: int
    duration: float
    path: str

    def to_mono(self) -> AudioData:
        """Mix down to mono."""
        if self.channels == 1:
            return self
        mono = self.samples.mean(axis=0) if self.samples.ndim > 1 else self.samples
        return AudioData(
            samples=mono,
            sample_rate=self.sample_rate,
            channels=1,
            duration=self.duration,
            path=self.path,
        )

    def resample(self, target_sr: int) -> AudioData:
        """Resample to a target sample rate."""
        if self.sample_rate == target_sr:
            return self
        try:
            import librosa
        except ImportError:
            from .exceptions import MissingDependencyError
            raise MissingDependencyError("librosa", "core")
        mono = self.to_mono()
        resampled = librosa.resample(
            mono.samples, orig_sr=self.sample_rate, target_sr=target_sr,
        )
        return AudioData(
            samples=resampled,
            sample_rate=target_sr,
            channels=1,
            duration=self.duration,
            path=self.path,
        )

    def get_channel(self, idx: int) -> AudioData:
        """Extract a single channel."""
        if self.channels == 1:
            return self
        if self.samples.ndim == 1:
            return self
        return AudioData(
            samples=self.samples[idx],
            sample_rate=self.sample_rate,
            channels=1,
            duration=self.duration,
            path=self.path,
        )


@dataclass
class AudioInfo:
    """Lightweight audio metadata included in every EvalResult."""

    duration_seconds: float
    sample_rate: int
    channels: int
    snr_db: float
    is_stereo: bool


# ---------------------------------------------------------------------------
# ASR metrics
# ---------------------------------------------------------------------------

@dataclass
class ASRMetrics:
    """String-level and semantic accuracy metrics."""

    transcript: str
    wer: float
    wer_normalized: float
    cer: float
    mer: float
    wip: float
    wil: float
    word_accuracy: float
    semascore: float | None = None
    saer: float | None = None
    saer_f_form: float | None = None
    saer_epsilon_sem: float | None = None
    asd: float | None = None
    asd_similarity: float | None = None


# ---------------------------------------------------------------------------
# TTS metrics
# ---------------------------------------------------------------------------

@dataclass
class TTSMetrics:
    """Speech quality and expressiveness metrics."""

    utmos: float | None = None
    nisqa_overall: float | None = None
    nisqa_noisiness: float | None = None
    nisqa_coloration: float | None = None
    nisqa_discontinuity: float | None = None
    nisqa_loudness: float | None = None
    dnsmos_overall: float | None = None
    dnsmos_signal: float | None = None
    dnsmos_background: float | None = None
    f0_rmse: float | None = None
    secs: float | None = None
    emotion: str | None = None
    emotion_scores: dict[str, float] | None = None
    prosody_score: float | None = None
    pitch_std_hz: float | None = None
    monotone_score: float | None = None
    pace_std: float | None = None
    pace_score: float | None = None
    intonation_score: float | None = None


# ---------------------------------------------------------------------------
# Agent metrics
# ---------------------------------------------------------------------------

@dataclass
class AgentMetrics:
    """Voice agent behavioral evaluation metrics."""

    task_success: bool | None = None
    task_success_rate: float | None = None
    containment: bool | None = None
    intent_accuracy: float | None = None
    slot_accuracy: float | None = None
    coherence_score: float | None = None
    error_detected: bool | None = None
    error_recovered: bool | None = None
    recovery_rate: float | None = None


# ---------------------------------------------------------------------------
# Latency metrics
# ---------------------------------------------------------------------------

@dataclass
class LatencyMetrics:
    """Performance and timing metrics."""

    rtfx: float | None = None
    e2e_latency_ms: float | None = None
    ttft_ms: float | None = None
    latency_p50: float | None = None
    latency_p90: float | None = None
    latency_p95: float | None = None
    latency_p99: float | None = None


# ---------------------------------------------------------------------------
# Diarization
# ---------------------------------------------------------------------------

@dataclass
class SpeakerInfo:
    """Per-speaker statistics from diarization."""

    speaker_id: str
    speaking_time: float
    speaking_percentage: float
    num_turns: int
    avg_turn_duration: float
    words_per_minute: float | None = None


@dataclass
class DiarizationResult:
    """Speaker diarization output."""

    num_speakers: int
    speakers: list[SpeakerInfo]
    timeline: str = ""


# ---------------------------------------------------------------------------
# Top-level result
# ---------------------------------------------------------------------------

@dataclass
class EvalResult:
    """Complete evaluation result — the top-level output of VoiceEvalPipeline."""

    audio: AudioInfo
    asr: ASRMetrics | None = None
    tts: TTSMetrics | None = None
    agent: AgentMetrics | None = None
    latency: LatencyMetrics | None = None
    diarization: DiarizationResult | None = None
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-compatible dict.

        Matches the structure arena-api expects:
        ``overall_metrics``, ``num_speakers``, ``speaker_metrics``,
        ``diarization_timeline``.
        """
        overall: dict[str, Any] = {}

        # Audio info
        overall["total_duration_seconds"] = self.audio.duration_seconds
        overall["sample_rate"] = self.audio.sample_rate
        overall["channels"] = self.audio.channels
        overall["snr_db"] = self.audio.snr_db
        overall["is_stereo"] = self.audio.is_stereo

        # ASR
        if self.asr is not None:
            overall["transcript_text"] = self.asr.transcript
            overall["wer_score"] = self.asr.wer
            overall["wer_normalized"] = self.asr.wer_normalized
            overall["word_accuracy"] = self.asr.word_accuracy
            overall["cer_score"] = self.asr.cer
            overall["mer_score"] = self.asr.mer
            overall["wip_score"] = self.asr.wip
            overall["wil_score"] = self.asr.wil
            overall["semascore"] = self.asr.semascore
            overall["saer"] = self.asr.saer
            overall["saer_f_form"] = self.asr.saer_f_form
            overall["saer_epsilon_sem"] = self.asr.saer_epsilon_sem
            overall["asd"] = self.asr.asd
            overall["asd_similarity"] = self.asr.asd_similarity

        # TTS
        if self.tts is not None:
            for k, v in asdict(self.tts).items():
                overall[k] = v

        # Agent
        if self.agent is not None:
            for k, v in asdict(self.agent).items():
                overall[k] = v

        # Latency
        if self.latency is not None:
            for k, v in asdict(self.latency).items():
                overall[k] = v

        # Diarization
        diarization_data: dict[str, Any] = {}
        if self.diarization is not None:
            diarization_data["num_speakers"] = self.diarization.num_speakers
            diarization_data["speaker_metrics"] = [
                asdict(s) for s in self.diarization.speakers
            ]
            diarization_data["diarization_timeline"] = self.diarization.timeline
        else:
            diarization_data["num_speakers"] = 0
            diarization_data["speaker_metrics"] = []
            diarization_data["diarization_timeline"] = ""

        return {
            "overall_metrics": overall,
            **diarization_data,
            "warnings": self.warnings,
        }

    def to_arena_metrics(self) -> dict[str, Any]:
        """Flatten to the keys the arena frontend expects."""
        m: dict[str, Any] = {}
        if self.tts:
            m["utmos"] = self.tts.utmos
            m["nisqa"] = self.tts.nisqa_overall
            m["dnsmos"] = self.tts.dnsmos_overall
            m["secs"] = self.tts.secs
            m["f0rmse"] = self.tts.f0_rmse
        if self.asr:
            m["wer"] = self.asr.wer
        if self.latency:
            m["ttfb"] = self.latency.ttft_ms
            m["medianLatency"] = self.latency.latency_p50
        if self.agent:
            m["taskCompletion"] = self.agent.task_success_rate
            m["bargeIn"] = None  # requires full-duplex eval
        return m
