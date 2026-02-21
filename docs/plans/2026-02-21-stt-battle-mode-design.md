# STT (Speech-to-Text) Battle Mode Design

**Date:** 2026-02-21
**Status:** Approved
**Branch:** `feat/multi-mode-battles`

## Overview

STT battles are the inverse of TTS: users provide audio input and compare text transcripts from different STT models. Users listen to the audio, read all transcripts, and vote on which is most accurate. After voting, model names are revealed alongside diff highlighting and WER/CER metrics (when ground truth is available).

## User Flow

```
idle → loading → listening → voting → revealed
```

| State | Description |
|-------|-------------|
| **idle** | Input panel with two tabs: "Record your own" (mic) or "Use a curated clip" (library). Battle pre-created via API. |
| **loading** | Audio submitted to backend. All 4 STT providers process in parallel. Timer counts up. |
| **listening** | Audio player at top. 4 transcript cards (A/B/C/D) below in randomized order. Monospaced text, no model names. |
| **voting** | "Which transcription is most accurate?" — pick A, B, C, D, or Tie. |
| **revealed** | Model names unmasked. Diff highlighting activated. WER, CER, latency shown per card. |

## Audio Input

### Dual Input Mode

**1. Record your own:** Users record via browser microphone using the existing `AudioRecorder` component. Max 15 seconds. No ground truth available — users vote on perceived accuracy only.

**2. Curated clips:** Pre-built audio library with known ground truth. Clips generated via TTS service from text prompts, ensuring the ground truth is the original text. Grouped by category with difficulty badges.

### Curated Clip Categories

- Clean speech
- Noisy environment
- Accented speech
- Code-switching
- Domain jargon
- Fast speech
- Overlapping speakers
- Numbers & entities

## STT Providers

All 4 providers compete in every battle:

| Provider | Model | API Type |
|----------|-------|----------|
| OpenAI | Whisper | REST (multipart upload) |
| Deepgram | Nova-2 | REST (binary body) |
| AssemblyAI | Universal | REST (upload + poll) |
| Google | Cloud Speech-to-Text | REST (client library) |

### Provider Integration Details

**OpenAI Whisper:**
- POST `https://api.openai.com/v1/audio/transcriptions`
- Multipart form: file + model="whisper-1"
- Returns JSON with `text` field

**Deepgram:**
- POST `https://api.deepgram.com/v1/listen`
- Binary audio body, `Content-Type: audio/webm`
- Query params: `model=nova-2&smart_format=true`
- Returns JSON with nested transcript

**AssemblyAI:**
- Step 1: POST `https://api.assemblyai.com/v2/upload` (binary body) → `upload_url`
- Step 2: POST `https://api.assemblyai.com/v2/transcript` with `audio_url` → `id`
- Step 3: Poll GET `https://api.assemblyai.com/v2/transcript/{id}` until `status=completed`
- Returns JSON with `text` field

**Google Cloud STT:**
- Uses `google-cloud-speech` client library
- `RecognitionConfig` with encoding, sample rate
- `recognize()` method returns results with transcript

## Backend Architecture

### Two-Step API Flow

**Step 1 — `POST /battles/generate` with `battle_type=stt`:**
- Queries `VoiceModel` where `model_type='stt'`
- Selects all available models (up to 4, model_a through model_d)
- Creates Battle record with model IDs, no evaluations yet
- Fetches curated clips from `audio_clips` table
- Returns `STTBattleSetupResponse`

**Step 2 — `POST /battles/{id}/input-audio`:**
- Accepts uploaded audio (WebM) OR `curated_clip_id`
- Stores input audio path on Battle record
- Fans out to all 4 STT providers in parallel via `asyncio.gather()`
- Creates `Evaluation` record per model with `transcript_output`
- Returns `STTBattleResponse` with all transcripts and latencies

**Step 3 — `GET /battles/{id}/metrics`:**
- Post-vote progressive polling
- Computes WER, CER against ground truth (curated clips only)
- Generates word-level diff data
- Returns model names, providers, metrics, diff arrays

### New Service: `stt_service.py`

```python
async def transcribe_with_provider(
    audio_path: str,
    provider: str,
    model_id: str,
    config: dict,
) -> dict:
    """Returns: transcript, latency_ms, word_count, ttfb_ms"""
```

One async function per provider. All REST-based (no WebSockets needed).

### New Service: `stt_metrics.py`

```python
def compute_wer(reference: str, hypothesis: str) -> float
def compute_cer(reference: str, hypothesis: str) -> float
def compute_word_diff(reference: str, hypothesis: str) -> list[dict]
```

- WER: Levenshtein at word level. `(S + D + I) / N`
- CER: Levenshtein at character level
- Word diff: DP alignment preserving the path, returns `[{word, type, ref_word?}]`

### New Table: `audio_clips`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| category | Text | e.g. "clean_speech", "noisy" |
| difficulty | Text | "easy", "medium", "hard" |
| ground_truth | Text | Reference transcript |
| audio_path | Text | Path to audio file |
| duration_seconds | Float | Clip duration |
| tags | JSONB | Additional metadata |
| created_at | DateTime | Auto-set |

## Frontend Components

### New Components

**1. `STTBattlePage.tsx`**
Main page with state machine. Rendered when `battleMode === 'stt'` in BattlePage.

**2. `STTInputPanel.tsx`**
Two-tab input (reuses pattern from S2SInputPanel):
- "Record your own": uses AudioRecorder component
- "Use a curated clip": grouped by category, difficulty badges, play-preview

**3. `TranscriptCard.tsx`**
Core comparison card:
- Monospaced text, scrollable
- Label (A/B/C/D) with color accent
- Word count + latency badges
- Before vote: plain text
- After vote: diff-highlighted, WER badge, model name
- Equal min-height enforced

**4. `DiffHighlighter.tsx`**
Renders diff-highlighted text:
- Green background: insertions
- Red strikethrough: deletions
- Orange background: substitutions
- Takes diff array from metrics API

**5. `AudioClipPlayer.tsx`**
Persistent audio player at top of battle:
- Play/pause, progress scrubber, elapsed/total time
- Playback speed: 0.5x / 1x / 1.5x
- Loop button
- Visible during listening and voting phases
- Uses WaveformVisualizer

### Reused Components

- `AudioRecorder` — mic recording (from S2S)
- `VoteButton` — voting buttons (shared)
- `WaveformVisualizer` — audio visualization
- `GatedLoadingState` — loading state (adapted message)

## Post-Vote Metrics

### With Ground Truth (Curated Clips)

- **WER** (Word Error Rate) — percentage of word-level errors
- **CER** (Character Error Rate) — percentage of character-level errors
- **Diff view** — word-level highlighting vs ground truth
- **Latency** — TTFB and E2E per provider
- **Model names & providers** — unmasked

### Without Ground Truth (User-Recorded)

- **Latency** — TTFB and E2E per provider
- **Model names & providers** — unmasked
- **Diff section** — shows "No reference transcript available"
- Users voted on perceived accuracy only

### Progressive Reveal

1. Vote submitted → model names revealed instantly
2. Poll `/battles/{id}/metrics` at 1s intervals
3. Status: `computing` → `partial` → `complete`
4. Diff and WER appear as computed

## Seed Data

### STT Models (4)

| Name | Provider | Model ID |
|------|----------|----------|
| Whisper Large V3 | openai | whisper-1 |
| Deepgram Nova-2 | deepgram | nova-2 |
| AssemblyAI Universal | assemblyai | universal |
| Google Cloud STT | google | latest_long |

### Curated Audio Clips

10-15 clips generated via TTS from text prompts across all 8 categories. The text prompts serve as ground truth. Audio generated using a consistent, clear TTS voice.

## Database Changes

- New `audio_clips` table (migration)
- `VoiceModel` entries with `model_type='stt'`
- Existing `Evaluation.transcript_output` stores STT results
- Existing `Battle.input_audio_path` stores input audio
