# Arena Backend & Data Layer Design

**Date:** 2026-02-16
**Status:** Approved
**Scope:** Connect the voice_evals Python framework to the Arena frontend via a FastAPI backend with PostgreSQL storage.

---

## 1. Architecture Overview

Three-layer stack:

```
Arena Frontend (React/Vite, port 5174)
        │ HTTP/JSON + WebSocket
Arena API (FastAPI/Python, port 8000)
        │                │
  PostgreSQL        voice_evals pipeline
  (structured       (Whisper, BERT, UTMOS,
   results,          Pyannote, FunASR —
   rankings)         GPU-accelerated)
```

**FastAPI** wraps the existing `voice_evals` package. Evals are long-running (10-60s), so the API accepts requests, returns a job ID immediately, runs evals asynchronously via `ProcessPoolExecutor`, and pushes progress via WebSocket.

The `voice_evals` codebase remains a standalone CLI tool. The API imports it as an editable install — no code duplication.

---

## 2. Database Schema (PostgreSQL)

### models
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | e.g. "GPT-4o Realtime" |
| provider | text | "openai", "google", "custom" |
| version | text | "v1.2" |
| config_json | jsonb | Model params, system prompt |
| elo_rating | float | Default 1500 |
| total_battles | int | |
| win_rate | float | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### evaluations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| model_id | uuid FK → models | |
| scenario_id | uuid FK → scenarios | Nullable |
| status | text | pending/running/completed/failed |
| audio_path | text | S3 key or local path |
| transcript_ref | text | Ground truth, nullable |
| metrics_json | jsonb | Full EnhancedVoiceMetrics output |
| diarization_json | jsonb | Speaker segments + stats |
| duration_seconds | float | |
| created_at | timestamptz | |

### scenarios
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | "Angry customer refund" |
| category | text | customer_service/sales/support |
| description | text | |
| difficulty | text | easy/medium/hard |
| ground_truth_transcript | text | Nullable |
| created_at | timestamptz | |

### battles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| scenario_id | uuid FK → scenarios | |
| model_a_id | uuid FK → models | |
| model_b_id | uuid FK → models | |
| eval_a_id | uuid FK → evaluations | |
| eval_b_id | uuid FK → evaluations | |
| winner | text | "a"/"b"/"tie"/null |
| vote_source | text | human/auto/metrics |
| elo_delta | float | Rating change applied |
| created_at | timestamptz | |

### leaderboard_snapshots
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| model_id | uuid FK → models | |
| elo_rating | float | |
| win_rate | float | |
| total_battles | int | |
| avg_wer | float | |
| avg_semascore | float | |
| avg_prosody | float | |
| avg_quality | float | |
| rank | int | |
| snapshot_date | date | |

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_token | text | Anonymous by default |
| votes_cast | int | |
| created_at | timestamptz | |

**Key decisions:**
- `metrics_json` as JSONB avoids 30+ columns, remains queryable in Postgres.
- `leaderboard_snapshots` captures daily rankings for trend charts.
- ELO lives on `models` for fast reads, updated atomically after each battle.

---

## 3. API Endpoints

**Base URL:** `/api/v1`

### Models
| Method | Path | Purpose |
|--------|------|---------|
| POST | /models | Register a model |
| GET | /models | List models (with filters) |
| GET | /models/:id | Model detail + aggregate stats |
| PATCH | /models/:id | Update model config |

### Evaluations
| Method | Path | Purpose |
|--------|------|---------|
| POST | /evaluations | Submit audio for eval (multipart) → returns job_id |
| GET | /evaluations/:id | Get eval result (full metrics) |
| GET | /evaluations | List evals (filter by model, scenario) |
| WS | /evaluations/:id/stream | Real-time progress events |

### Battles
| Method | Path | Purpose |
|--------|------|---------|
| POST | /battles | Create battle (two models + scenario) |
| GET | /battles/:id | Battle result with both eval comparisons |
| POST | /battles/:id/vote | Submit human vote |
| GET | /battles | List battles (filter, paginate) |

### Scenarios
| Method | Path | Purpose |
|--------|------|---------|
| POST | /scenarios | Create scenario |
| GET | /scenarios | List scenarios |
| GET | /scenarios/:id | Scenario detail + battle history |

### Leaderboard
| Method | Path | Purpose |
|--------|------|---------|
| GET | /leaderboard | Current rankings (sortable) |
| GET | /leaderboard/history | ELO trends over time |

### Analytics
| Method | Path | Purpose |
|--------|------|---------|
| GET | /analytics/summary | Global stats |
| GET | /analytics/correlations | Metric correlations |

### Evaluation Flow
1. Frontend `POST /evaluations` with audio + model_id
2. API saves audio, creates DB record (status: pending), enqueues job
3. Returns `{ id, status: "pending" }` immediately
4. Frontend opens WebSocket to `/evaluations/:id/stream`
5. Worker runs `VoiceEvaluationPipeline`, pushes progress events
6. On completion, saves metrics_json to DB, pushes "complete"
7. Frontend fetches full results from `GET /evaluations/:id`

---

## 4. Async Worker Architecture

**ProcessPoolExecutor** (no Redis/Celery needed for single-machine deployment).

```
FastAPI (async main thread)
    │
    ├── POST /evaluations → DB insert → submit to ProcessPoolExecutor
    │                                       │
    │                                  Worker Process (GPU)
    │                                  └── VoiceEvaluationPipeline.evaluate()
    │                                       │
    ├── WebSocket ◄─────────────────────────┘ progress callbacks
    │
    └── GET /evaluations/:id → read from DB
```

**Why not Celery?** Evals are GPU-bound on a single machine. ProcessPoolExecutor with 2-4 workers handles concurrent evals without message broker overhead. Migration to Celery later is straightforward since task boundaries are clean.

**Pipeline wrapper:**
```python
def run_evaluation(audio_path, transcript_path, config) -> dict:
    pipeline = VoiceEvaluationPipeline(
        audio_path=audio_path,
        transcript_path=transcript_path,
        hf_token=config.hf_token,
        enable_diarization=config.enable_diarization,
        num_speakers=config.num_speakers,
    )
    metrics = pipeline.evaluate()
    return dataclasses.asdict(metrics)
```

**Only modification to voice_evals:** Add optional `progress_callback` parameter to `evaluate()` that fires at each of the 17 pipeline steps.

---

## 5. Project Structure

```
packages/arena-api/
├── app/
│   ├── main.py                  # FastAPI app, CORS, lifespan
│   ├── config.py                # pydantic-settings
│   ├── database.py              # SQLAlchemy async engine + session
│   ├── models/                  # ORM models (6 tables)
│   ├── schemas/                 # Pydantic request/response
│   ├── routers/                 # Route handlers (6 routers)
│   ├── workers/
│   │   └── eval_worker.py       # ProcessPoolExecutor wrapper
│   └── services/
│       ├── elo.py               # Bradley-Terry ELO calculation
│       └── eval_service.py      # Eval orchestration + DB writes
├── alembic/                     # Database migrations
├── requirements.txt
├── pyproject.toml
└── README.md
```

**voice_evals imported as editable install:**
```
# requirements.txt
-e ../../evals
```

**Key dependencies:** fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic-settings, python-multipart, websockets

**Run locally:**
```bash
cd packages/arena-api
uvicorn app.main:app --reload --port 8000
```

---

## 6. ELO Rating System

### Bradley-Terry with standard ELO

All models start at 1500. K-factor = 32.

```
expected_a = 1 / (1 + 10^((rating_b - rating_a) / 400))
new_a = rating_a + K * (outcome - expected_a)
```

### Three vote sources

1. **Auto-vote (metrics-based):** Composite score from eval metrics:
   - 30% semascore + 25% (1-wer) + 20% prosody + 15% quality + 10% (1-latency)
   - Tie if difference < 0.02. Weights configurable.

2. **Human vote:** Blind comparison — users hear both outputs without seeing metrics, then pick a winner.

3. **Hybrid (default):** Both votes count. Human votes weighted 1.5x vs auto.

### Matchmaking
Models within 200 ELO points of each other are matched. Random scenario selection within chosen category.

### Leaderboard snapshots
Daily cron captures each model's ELO, win rate, and average metrics for trend charts.

---

## 7. Frontend Integration

### API client layer
New file `packages/arena/src/api/client.ts` — typed fetch wrapper for all endpoints.

### Migration order (one page at a time)
1. **Leaderboard** — pure read, easiest
2. **Model Profile** — model detail + eval history
3. **Scenarios** — scenario list + battle history
4. **Battle Page** — full interactive flow with WebSocket progress
5. **Analytics** — real aggregates replace hardcoded charts
6. **Playground** — custom audio upload + live eval

### Mock data fallback
API client detects if backend is unreachable and falls back to `mockData.ts`. Frontend always works standalone for demos.

---

## 8. Configuration

Single `.env` at `packages/arena-api/.env`:

```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/voiceloop_arena
HF_TOKEN=hf_xxx
ENABLE_DIARIZATION=true
DEFAULT_NUM_SPEAKERS=2
API_PORT=8000
CORS_ORIGINS=http://localhost:5174,http://localhost:5173
MAX_EVAL_WORKERS=2
MAX_UPLOAD_SIZE_MB=50
ELO_K_FACTOR=32
HUMAN_VOTE_WEIGHT=1.5
AUDIO_STORAGE_PATH=./uploads
```

Loaded via `pydantic-settings`. Validated at startup. Production (EC2): swap DATABASE_URL to RDS, optionally enable S3 for audio storage. No code changes.

---

## Deployment

| Environment | API | Database | GPU | Audio Storage |
|-------------|-----|----------|-----|---------------|
| Local dev | uvicorn :8000 | Postgres local | Local GPU | ./uploads |
| Production | uvicorn/gunicorn on EC2 | RDS PostgreSQL | EC2 GPU instance | S3 bucket |

Frontend proxy in `packages/arena/vite.config.ts`:
```typescript
proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } }
```
