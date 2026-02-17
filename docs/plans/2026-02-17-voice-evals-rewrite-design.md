# Voice Evals Package Rewrite — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Branch:** TBD (voice-evals-rewrite)

## Context

The `evals/voice_evals/` package is the evaluation engine powering the Voice Loop Arena. The current codebase has critical issues: missing `pipeline2.py` dependency (breaks all imports), undefined variables, `sys.path` hacks, stub modules, silent failures, and incomplete features. It needs a complete rewrite.

The evaluation dimensions are informed by the "Evaluations in Voice AI: A Complete Technical Reference" PDF covering the full voice AI evaluation landscape.

## Goals

1. Production-ready evaluation package consumed by `packages/arena-api/`
2. Full coverage: ASR accuracy, TTS quality, voice agent metrics, latency measurement
3. Clean architecture: each metric is a standalone module, pipeline orchestrates them
4. Lazy loading with pip extras: `voice-evals[asr]`, `[tts]`, `[agent]`, `[full]`
5. Both Python API and CLI (`voice-evals evaluate audio.wav`)
6. Synchronous core, arena-api wraps with `run_in_executor()`

## Package Structure

```
evals/voice_evals/
├── pyproject.toml
├── README.md
├── __init__.py                 # Public API exports
├── __main__.py                 # python -m voice_evals
├── cli.py                      # CLI with argparse
├── pipeline.py                 # VoiceEvalPipeline orchestrator
├── config.py                   # EvalConfig dataclass
├── types.py                    # All result dataclasses
├── exceptions.py               # Error hierarchy
│
├── asr/                        # ASR string & semantic accuracy
│   ├── __init__.py
│   ├── transcription.py        # Whisper wrapper
│   ├── wer.py                  # WER, CER, MER, WIP, WIL
│   ├── semascore.py            # SeMaScore
│   ├── saer.py                 # SAER
│   └── asd.py                  # Aligned Semantic Distance
│
├── tts/                        # TTS & speech quality
│   ├── __init__.py
│   ├── utmos.py                # UTMOS22 MOS prediction
│   ├── nisqa.py                # NISQA multi-dimensional
│   ├── dnsmos.py               # DNSMOS P.835
│   ├── prosody.py              # F0-RMSE, pitch, pace, intonation
│   ├── speaker_similarity.py   # SECS via WavLM
│   └── emotion.py              # Emotion2Vec
│
├── agent/                      # Voice agent behavioral metrics
│   ├── __init__.py
│   ├── task_success.py         # TSR, containment
│   ├── intent.py               # Intent accuracy, slot filling, JGA
│   ├── dialogue.py             # Coherence scoring
│   └── error_recovery.py       # Detection, clarification, recovery
│
├── latency/                    # Performance & timing
│   ├── __init__.py
│   ├── rtf.py                  # Real-time factor
│   ├── percentiles.py          # P50/P90/P95/P99
│   ├── ttft.py                 # Time-to-first-token
│   └── e2e.py                  # E2E latency breakdown
│
├── audio/                      # Audio I/O & preprocessing
│   ├── __init__.py
│   ├── loader.py               # Load, resample, validate
│   ├── snr.py                  # Signal-to-noise ratio
│   ├── vad.py                  # Voice activity detection
│   └── diarization.py          # Speaker diarization
│
├── _vendor/                    # Vendored UTMOS22
│   └── utmos22/
│       ├── __init__.py
│       ├── wav2vec2.py
│       └── strong.py
│
└── tests/
    ├── conftest.py
    ├── test_pipeline.py
    ├── test_cli.py
    ├── asr/
    │   ├── test_wer.py
    │   ├── test_semascore.py
    │   ├── test_saer.py
    │   └── test_asd.py
    ├── tts/
    │   ├── test_utmos.py
    │   ├── test_prosody.py
    │   └── test_speaker_sim.py
    ├── agent/
    │   ├── test_task_success.py
    │   └── test_intent.py
    └── audio/
        ├── test_loader.py
        ├── test_snr.py
        └── test_diarization.py
```

## Type System

All results are typed dataclasses, serializable to JSON.

### EvalResult (top-level)

```python
@dataclass
class EvalResult:
    audio: AudioInfo
    asr: ASRMetrics | None
    tts: TTSMetrics | None
    agent: AgentMetrics | None
    latency: LatencyMetrics | None
    diarization: DiarizationResult | None
    warnings: list[str]

    def to_dict(self) -> dict: ...
    def to_arena_metrics(self) -> dict: ...
```

### ASRMetrics

```python
@dataclass
class ASRMetrics:
    transcript: str
    wer: float                      # [0, inf) lower=better
    wer_normalized: float           # fillers removed
    cer: float
    mer: float                      # [0, 1] bounded
    wip: float                      # [0, 1] higher=better
    wil: float                      # [0, 1] lower=better
    word_accuracy: float
    semascore: float | None         # requires BERT + ground truth
    saer: float | None              # requires LaBSE + ground truth
    asd: float | None               # requires BERT + ground truth
```

### TTSMetrics

```python
@dataclass
class TTSMetrics:
    utmos: float | None             # [1, 5] MOS
    nisqa_overall: float | None
    nisqa_noisiness: float | None
    nisqa_coloration: float | None
    nisqa_discontinuity: float | None
    nisqa_loudness: float | None
    dnsmos_overall: float | None
    dnsmos_signal: float | None
    dnsmos_background: float | None
    f0_rmse: float | None           # Hz
    secs: float | None              # [-1, 1] cosine sim
    emotion: str | None
    emotion_scores: dict | None
    prosody_score: float | None     # [0, 1] composite
```

### AgentMetrics

```python
@dataclass
class AgentMetrics:
    task_success: bool | None
    task_success_rate: float | None
    containment: bool | None
    intent_accuracy: float | None
    slot_accuracy: float | None
    coherence_score: float | None
    error_detected: bool | None
    error_recovered: bool | None
    recovery_rate: float | None
```

### LatencyMetrics

```python
@dataclass
class LatencyMetrics:
    rtfx: float
    e2e_latency_ms: float | None
    ttft_ms: float | None
    latency_p50: float | None
    latency_p90: float | None
    latency_p95: float | None
    latency_p99: float | None
```

### AudioInfo & Supporting Types

```python
@dataclass
class AudioData:
    samples: np.ndarray
    sample_rate: int
    channels: int
    duration: float
    path: str

    def to_mono(self) -> AudioData: ...
    def resample(self, target_sr: int) -> AudioData: ...
    def get_channel(self, idx: int) -> AudioData: ...

@dataclass
class AudioInfo:
    duration_seconds: float
    sample_rate: int
    channels: int
    snr_db: float
    is_stereo: bool

@dataclass
class SpeakerInfo:
    speaker_id: str
    speaking_time: float
    speaking_percentage: float
    num_turns: int
    avg_turn_duration: float
    words_per_minute: float | None

@dataclass
class DiarizationResult:
    num_speakers: int
    speakers: list[SpeakerInfo]
    timeline: str
```

## Public API

### Pipeline (primary usage)

```python
from voice_evals import VoiceEvalPipeline, EvalConfig

pipeline = VoiceEvalPipeline(config=EvalConfig(whisper_model="base"))
result = pipeline.evaluate(
    audio_path="conversation.wav",
    ground_truth="transcript.txt",
    groups=["asr", "tts", "latency"],
    enable_diarization=True,
    hf_token="hf_xxx",
)
result.to_dict()          # for arena-api
result.to_arena_metrics() # flat dict for arena frontend
```

### Individual metrics

```python
from voice_evals.asr.wer import calculate_wer
from voice_evals.tts.utmos import calculate_utmos

wer = calculate_wer(hypothesis="the cat sat", reference="a cat sat")
utmos = calculate_utmos("audio.wav")
```

### Arena-API integration

```python
# Drop-in replacement for current eval_worker.py
from voice_evals import VoiceEvalPipeline

def run_evaluation(audio_path, transcript_path, hf_token,
                   enable_diarization, num_speakers) -> dict:
    pipeline = VoiceEvalPipeline()
    result = pipeline.evaluate(
        audio_path=audio_path,
        ground_truth=transcript_path,
        enable_diarization=enable_diarization,
        hf_token=hf_token,
        num_speakers=num_speakers,
    )
    return result.to_dict()
```

## CLI

```bash
voice-evals evaluate audio.wav
voice-evals evaluate audio.wav --ground-truth ref.txt --groups asr tts
voice-evals evaluate audio.wav --diarize --hf-token $HF_TOKEN
voice-evals evaluate audio.wav --output results.json --format json
voice-evals batch audios/ --output results/
voice-evals info              # show installed extras & available metrics
voice-evals info --check      # verify model availability
```

## Dependency Management

### Install extras (pyproject.toml)

- `pip install voice-evals` — core only (numpy, scipy, soundfile, librosa)
- `pip install voice-evals[asr]` — whisper, jiwer, transformers, sentence-transformers
- `pip install voice-evals[tts]` — torch, torchaudio, nisqa
- `pip install voice-evals[agent]` — openai (LLM-as-judge)
- `pip install voice-evals[diarization]` — pyannote.audio
- `pip install voice-evals[full]` — everything

### Lazy loading

Models load on first use. Missing deps raise `MissingDependencyError` with install command. Pipeline catches these per-group and degrades gracefully (sets group to None, adds warning).

### Model caching

Module-level `_model_cache` dict. Models persist for process lifetime. Arena-api's ProcessPoolExecutor means each worker loads once.

## Error Handling

### Exception hierarchy

```
VoiceEvalError (base)
├── MissingDependencyError  — optional dep not installed
├── AudioLoadError          — file missing, corrupt, unsupported
├── AuthenticationError     — HF token invalid/missing
├── TranscriptionError      — Whisper failed
├── ModelLoadError          — OOM, corrupted weights
└── GroundTruthError        — ground truth file unreadable
```

### Pipeline behavior

- Each metric group runs in try/except
- Failures don't crash the pipeline — group set to None
- `EvalResult.warnings` captures human-readable skip reasons
- No print() — uses `logging.getLogger("voice_evals")`

## Testing

### Two tiers

1. **Unit tests** (no ML models): precomputed WER values, synthetic audio, error handling. Run on every push.
2. **Integration tests** (`@pytest.mark.slow`): load real models, run on actual audio. Nightly/release only.

### Fixtures

Synthetic audio generated via numpy (sine waves, noise, silence). No large files in repo.

## Implementation Order

1. Foundation: types, exceptions, config, audio/loader
2. ASR: wer, transcription, semantic metrics
3. TTS: utmos, prosody, nisqa, dnsmos, secs, emotion
4. Latency: rtf, percentiles, ttft
5. Agent: task success, intent, dialogue, error recovery
6. Pipeline orchestrator + CLI
7. Tests
