# Experiments API — Programmatic Voice AI A/B Testing

**Date:** 2026-02-20
**Status:** Design approved

## Overview

Turn the KoeCode Arena into a developer-facing platform for programmatic voice AI A/B testing. Developers submit text + specify models + choose a scenario, and the API generates audio, runs evaluations, and returns ranked results. Think "Wingify/VWO for voice AI."

Serves three user types equally: TTS model builders benchmarking against competitors, voice agent orchestrators choosing providers for production, and product teams running experiments on voice quality.

## Core Concepts

### Experiment

Top-level container a developer creates. Contains:

- **name** — human-readable label (e.g., "Q3 IVR voice test")
- **scenario** — evaluation context (e.g., "customer_support", "medical", "financial")
- **eval_mode** — `automated`, `human`, or `both`
- **models** — list of 2-4 provider/voice combinations to compare
- **prompts** — list of text strings to synthesize (max 20 for v1)
- **webhook_url** — optional, notified on completion
- **status** — `created` → `running` → `completed` (or `failed`)

### Trial

One prompt x one model = one trial. An experiment with 3 models and 10 prompts produces 30 trials. Each trial holds:

- Generated audio file path
- Latency metrics (TTFB, total generation time)
- Audio properties (duration, sample rate, silence ratio)
- Evaluation scores (automated and/or human)

### ExperimentResult

Aggregated output computed when all trials complete:

- Per-model mean + stddev for each metric
- Composite score (weighted average across metrics)
- Head-to-head win matrix — for each model pair, how often A scored higher than B
- Overall ranking with confidence interval
- Declared winner (or "inconclusive" if not statistically significant)

### Relationships

```
Developer (1) → (many) Experiment
Experiment (1) → (many) Trial
Experiment (1) → (1) ExperimentResult
```

## API Endpoints

### Authentication

All endpoints require `Authorization: Bearer <api_key>`. Keys are hashed at rest, plaintext shown once at creation. Each experiment is scoped to the developer who created it.

### Endpoints

#### Create experiment

```
POST /api/v1/experiments

{
  "name": "Q3 IVR voice test",
  "scenario": "customer_support",
  "eval_mode": "automated",
  "models": [
    {"provider": "cartesia", "voice_id": "abc123"},
    {"provider": "deepgram"},
    {"provider": "elevenlabs", "voice_id": "def456"}
  ],
  "prompts": [
    "Thank you for calling. How can I help you today?",
    "Your account balance is four hundred and twenty dollars.",
    "I'm transferring you to a specialist now."
  ],
  "webhook_url": "https://example.com/webhook"
}
```

Returns experiment ID + status `created`. Validates models exist, scenario is valid, prompts are non-empty. Max 4 models, max 20 prompts.

#### Run experiment

```
POST /api/v1/experiments/{id}/run
```

Kicks off generation + evaluation as a background job. Returns status `running`. For automated mode, completes in seconds-to-minutes depending on prompt count.

#### Get experiment status

```
GET /api/v1/experiments/{id}
```

Returns current status, progress (e.g., `14/27 trials complete`), and metadata.

#### Get results

```
GET /api/v1/experiments/{id}/results
```

Only available when status is `completed`. Returns the full aggregated report.

#### List experiments

```
GET /api/v1/experiments?status=completed&scenario=medical&limit=20
```

Paginated list of all experiments for this API key. Filter by status, scenario.

#### Get trial detail

```
GET /api/v1/experiments/{id}/trials
```

Returns individual trial-level data — audio URLs, per-trial scores, latency. For debugging or deep-dives.

## Evaluation & Scoring

### Automated metrics (per trial)

- **TTFB** (ms) — time to first byte from TTS provider
- **Generation time** (ms) — total time to generate audio
- **Duration** (seconds) — length of generated audio
- **Silence ratio** — percentage of audio that is silence (dead air detection)

### Aggregated results (per model)

- Mean + stddev for each metric across all prompts
- Composite score (weighted average)
- Head-to-head win matrix
- Overall ranking with confidence
- Declared winner (only if statistically significant)

### Human evaluation (v2)

- Trials get queued into the existing arena battle system (blind voting UI)
- Judges see pairs from the experiment's trial audio
- Results accumulate until vote threshold (default: 10 votes per pair)
- ELO-style scoring scoped to the experiment

### MOS prediction (v2)

- UTMOS or NISQA model for predicting Mean Opinion Score (1-5 naturalness)
- Runs on generated audio server-side, no human needed
- Added as an additional automated metric

## Architecture

### Where it lives

All new code goes into the existing FastAPI backend (`packages/arena-api/`). No new services. Reuses existing TTS generation, audio storage, and PostgreSQL database.

### New files

```
app/models/experiment.py      — Experiment, Trial, ExperimentResult SQLAlchemy models
app/models/developer.py       — Developer account + hashed API key
app/routers/experiments.py    — 6 experiment endpoints
app/routers/developers.py     — Key creation/management
app/services/experiment_runner.py — Orchestrates run: parallel TTS, scoring, aggregation
app/services/scoring.py       — Automated metrics computation
app/middleware/api_auth.py     — Bearer token validation middleware
```

### Experiment run flow

1. Developer calls `POST /experiments/{id}/run`
2. Endpoint validates experiment, sets status to `running`
3. Spawns background task (`asyncio.create_task`, same pattern as battle generation)
4. Background task: for each prompt x model combination, calls `generate_tts()` (existing function), creates Trial record with audio + latency
5. All trials complete → scoring service computes metrics, aggregates stats, builds win matrix
6. Writes ExperimentResult, sets status to `completed`
7. If webhook_url exists, POSTs result payload

### Key reuse

TTS generation is identical to what battles already do. The `generate_tts()` function doesn't change. The difference is experiments run N prompts x M models instead of 1 prompt x 4 models.

## Developer Experience

### API keys

No dashboard UI for v1. Developer creates a key via `POST /api/v1/developers`. Key plaintext shown once, hash stored. All experiment endpoints scoped to the authenticated developer.

### Documentation

- FastAPI auto-generated Swagger docs at `/docs` (free from FastAPI)
- Quickstart code snippet (Python `requests`) showing create → run → poll → results

### Error handling

Standard HTTP codes consistent with existing API:

- 400 — bad input (invalid model, empty prompts, too many models/prompts)
- 401 — missing or invalid API key
- 404 — unknown experiment
- 409 — experiment already running, or results not yet available
- `{"detail": "human readable message"}` on all errors

## Phasing

### V1 — ship first

- Developer model + API key creation endpoint
- Experiment CRUD + run + results (6 endpoints)
- Automated scoring: latency metrics only (TTFB, generation time, duration, silence ratio)
- Webhook notification on completion
- FastAPI auto-generated docs as API reference
- Guardrails: max 4 models, max 20 prompts per experiment

### V2 — fast follow

- MOS prediction scoring (UTMOS model)
- Scenario-weighted scoring rubrics
- Human eval mode (route trials into arena voting system)
- Developer dashboard UI (list experiments, view results, manage keys)
- Usage tracking per developer

### V3 — later

- Custom audio upload (benchmark own model against providers)
- SDK packages (Python, Node)
- Exportable reports (PDF/CSV)
- Rate limits and billing tiers
- Streaming pipeline API for production traffic A/B testing
