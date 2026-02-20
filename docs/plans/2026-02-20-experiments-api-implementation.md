# Experiments API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a programmatic API that lets developers create voice AI A/B testing experiments — submit text + models + scenario, get back ranked evaluation results.

**Architecture:** New models (Developer, Experiment, Trial) in the existing FastAPI backend. API key auth via middleware. Experiment runner reuses existing `generate_tts()` for audio generation, adds scoring/aggregation. All async with background task execution.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Alembic, Pydantic v2, asyncio

---

### Task 1: Developer Model + API Key

**Files:**
- Create: `packages/arena-api/app/models/developer.py`
- Create: `packages/arena-api/app/schemas/developer.py`
- Create: `packages/arena-api/app/routers/developers.py`
- Modify: `packages/arena-api/app/models/__init__.py`
- Modify: `packages/arena-api/app/main.py`

**Step 1: Create the Developer model**

Create `packages/arena-api/app/models/developer.py`:

```python
"""Developer account model with hashed API key."""
import hashlib
import secrets

from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


def generate_api_key() -> str:
    """Generate a random API key with 'kc_' prefix."""
    return f"kc_{secrets.token_hex(24)}"


def hash_api_key(key: str) -> str:
    """SHA-256 hash of an API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


class Developer(Base, TimestampMixin):
    __tablename__ = "developers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

**Step 2: Create the Pydantic schemas**

Create `packages/arena-api/app/schemas/developer.py`:

```python
from pydantic import BaseModel, EmailStr


class DeveloperCreate(BaseModel):
    name: str
    email: EmailStr


class DeveloperResponse(BaseModel):
    id: str
    name: str
    email: str
    api_key: str  # Only returned on creation (plaintext)

    model_config = {"from_attributes": True}


class DeveloperInfo(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}
```

**Step 3: Create the router**

Create `packages/arena-api/app/routers/developers.py`:

```python
"""Developer registration and API key management."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.developer import Developer, generate_api_key, hash_api_key
from app.schemas.developer import DeveloperCreate, DeveloperResponse

logger = logging.getLogger("arena.developers")

router = APIRouter(prefix="/api/v1/developers", tags=["developers"])


@router.post("", response_model=DeveloperResponse, status_code=201)
async def create_developer(body: DeveloperCreate, db: AsyncSession = Depends(get_db)):
    """Register a new developer and return an API key (shown once)."""
    # Check for existing email
    result = await db.execute(
        select(Developer).where(Developer.email == body.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    plaintext_key = generate_api_key()

    developer = Developer(
        name=body.name,
        email=body.email,
        api_key_hash=hash_api_key(plaintext_key),
    )
    db.add(developer)
    await db.commit()
    await db.refresh(developer)

    logger.info("New developer registered: %s (%s)", body.name, body.email)

    return DeveloperResponse(
        id=developer.id,
        name=developer.name,
        email=developer.email,
        api_key=plaintext_key,
    )
```

**Step 4: Register model and router**

Add to `packages/arena-api/app/models/__init__.py`:

```python
from app.models.developer import Developer
```

And add `"Developer"` to the `__all__` list.

Add to `packages/arena-api/app/main.py`:

```python
from app.routers import ..., developers
app.include_router(developers.router)
```

**Step 5: Commit**

```
git add packages/arena-api/app/models/developer.py packages/arena-api/app/schemas/developer.py packages/arena-api/app/routers/developers.py packages/arena-api/app/models/__init__.py packages/arena-api/app/main.py
git commit -m "feat: developer model + API key registration endpoint"
```

---

### Task 2: API Key Auth Middleware

**Files:**
- Create: `packages/arena-api/app/middleware/api_auth.py`

**Step 1: Create auth dependency**

Create `packages/arena-api/app/middleware/api_auth.py`:

```python
"""API key authentication dependency for experiment endpoints."""
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.developer import Developer, hash_api_key

security = HTTPBearer()


async def get_current_developer(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_db),
) -> Developer:
    """Validate Bearer token and return the associated Developer."""
    key_hash = hash_api_key(credentials.credentials)
    result = await db.execute(
        select(Developer).where(
            Developer.api_key_hash == key_hash,
            Developer.is_active == True,
        )
    )
    developer = result.scalar_one_or_none()
    if not developer:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    return developer
```

**Step 2: Commit**

```
git add packages/arena-api/app/middleware/api_auth.py
git commit -m "feat: API key auth dependency for experiment endpoints"
```

---

### Task 3: Experiment + Trial Models

**Files:**
- Create: `packages/arena-api/app/models/experiment.py`
- Modify: `packages/arena-api/app/models/__init__.py`

**Step 1: Create the models**

Create `packages/arena-api/app/models/experiment.py`:

```python
"""Experiment and Trial models for programmatic A/B testing."""
from sqlalchemy import String, Float, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Experiment(Base, TimestampMixin):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    developer_id: Mapped[str] = mapped_column(String, ForeignKey("developers.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    scenario: Mapped[str] = mapped_column(String, nullable=False)
    eval_mode: Mapped[str] = mapped_column(String, nullable=False, default="automated")
    status: Mapped[str] = mapped_column(String, nullable=False, default="created")
    models_json: Mapped[list] = mapped_column(JSONB, nullable=False)
    prompts_json: Mapped[list] = mapped_column(JSONB, nullable=False)
    webhook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    total_trials: Mapped[int] = mapped_column(Integer, default=0)
    completed_trials: Mapped[int] = mapped_column(Integer, default=0)
    results_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class Trial(Base, TimestampMixin):
    __tablename__ = "trials"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    experiment_id: Mapped[str] = mapped_column(String, ForeignKey("experiments.id"), nullable=False)
    prompt_index: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    voice_id: Mapped[str] = mapped_column(String, nullable=False)
    model_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttfb_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    generation_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    silence_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Step 2: Register models**

Add to `packages/arena-api/app/models/__init__.py`:

```python
from app.models.experiment import Experiment, Trial
```

And add `"Experiment"`, `"Trial"` to the `__all__` list.

**Step 3: Commit**

```
git add packages/arena-api/app/models/experiment.py packages/arena-api/app/models/__init__.py
git commit -m "feat: Experiment + Trial SQLAlchemy models"
```

---

### Task 4: Alembic Migration

**Files:**
- Create: `packages/arena-api/alembic/versions/d4e5f6a7b8c9_add_experiments_tables.py`

**Step 1: Create migration**

Create `packages/arena-api/alembic/versions/d4e5f6a7b8c9_add_experiments_tables.py`:

```python
"""add developers, experiments, and trials tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create developers, experiments, and trials tables."""
    # developers
    op.create_table(
        'developers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('api_key_hash', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_developers_email', 'developers', ['email'], unique=True)
    op.create_index('ix_developers_api_key_hash', 'developers', ['api_key_hash'], unique=True)

    # experiments
    op.create_table(
        'experiments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('developer_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('scenario', sa.String(), nullable=False),
        sa.Column('eval_mode', sa.String(), nullable=False, server_default='automated'),
        sa.Column('status', sa.String(), nullable=False, server_default='created'),
        sa.Column('models_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('prompts_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('webhook_url', sa.String(), nullable=True),
        sa.Column('total_trials', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_trials', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('results_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['developer_id'], ['developers.id']),
    )
    op.create_index('ix_experiments_developer_id', 'experiments', ['developer_id'])

    # trials
    op.create_table(
        'trials',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('experiment_id', sa.String(), nullable=False),
        sa.Column('prompt_index', sa.Integer(), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('voice_id', sa.String(), nullable=False),
        sa.Column('model_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('audio_path', sa.String(), nullable=True),
        sa.Column('audio_filename', sa.String(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('ttfb_ms', sa.Float(), nullable=True),
        sa.Column('generation_time_ms', sa.Float(), nullable=True),
        sa.Column('silence_ratio', sa.Float(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['experiment_id'], ['experiments.id']),
    )
    op.create_index('ix_trials_experiment_id', 'trials', ['experiment_id'])


def downgrade() -> None:
    """Drop trials, experiments, and developers tables."""
    op.drop_index('ix_trials_experiment_id', table_name='trials')
    op.drop_table('trials')
    op.drop_index('ix_experiments_developer_id', table_name='experiments')
    op.drop_table('experiments')
    op.drop_index('ix_developers_api_key_hash', table_name='developers')
    op.drop_index('ix_developers_email', table_name='developers')
    op.drop_table('developers')
```

**Step 2: Commit**

```
git add packages/arena-api/alembic/versions/d4e5f6a7b8c9_add_experiments_tables.py
git commit -m "feat: alembic migration for developers, experiments, trials tables"
```

---

### Task 5: Experiment Schemas

**Files:**
- Create: `packages/arena-api/app/schemas/experiment.py`

**Step 1: Create schemas**

Create `packages/arena-api/app/schemas/experiment.py`:

```python
"""Pydantic schemas for the Experiments API."""
from datetime import datetime
from pydantic import BaseModel, Field


class ModelSpec(BaseModel):
    provider: str
    voice_id: str | None = None


class ExperimentCreate(BaseModel):
    name: str
    scenario: str
    eval_mode: str = "automated"
    models: list[ModelSpec] = Field(..., min_length=2, max_length=4)
    prompts: list[str] = Field(..., min_length=1, max_length=20)
    webhook_url: str | None = None


class ExperimentResponse(BaseModel):
    id: str
    developer_id: str
    name: str
    scenario: str
    eval_mode: str
    status: str
    models_json: list
    prompts_json: list
    webhook_url: str | None
    total_trials: int
    completed_trials: int
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExperimentListResponse(BaseModel):
    id: str
    name: str
    scenario: str
    eval_mode: str
    status: str
    total_trials: int
    completed_trials: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TrialResponse(BaseModel):
    id: str
    experiment_id: str
    prompt_index: int
    prompt_text: str
    provider: str
    voice_id: str
    model_id: str
    status: str
    audio_url: str | None = None
    duration_seconds: float | None
    ttfb_ms: float | None
    generation_time_ms: float | None
    silence_ratio: float | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModelResultSummary(BaseModel):
    provider: str
    voice_id: str
    model_id: str
    trials_completed: int
    trials_failed: int
    avg_duration_seconds: float | None
    avg_ttfb_ms: float | None
    avg_generation_time_ms: float | None
    avg_silence_ratio: float | None
    composite_score: float


class HeadToHead(BaseModel):
    model_a: str  # "provider:voice_id"
    model_b: str
    a_wins: int
    b_wins: int
    ties: int


class ExperimentResultsResponse(BaseModel):
    experiment_id: str
    status: str
    rankings: list[ModelResultSummary]
    head_to_head: list[HeadToHead]
    winner: str | None  # "provider:voice_id" or None if inconclusive
    confidence: str  # "high", "medium", "low", "inconclusive"
```

**Step 2: Commit**

```
git add packages/arena-api/app/schemas/experiment.py
git commit -m "feat: Pydantic schemas for experiments API"
```

---

### Task 6: Scoring Service

**Files:**
- Create: `packages/arena-api/app/services/scoring.py`

**Step 1: Create scoring service**

Create `packages/arena-api/app/services/scoring.py`:

```python
"""Scoring and aggregation for experiment trials.

V1 uses latency-based metrics only. MOS prediction is a v2 addition.
"""
import logging
import struct
from statistics import mean, stdev

logger = logging.getLogger("arena.scoring")

# Weights for composite score (v1: latency-focused)
WEIGHTS = {
    "ttfb": 0.30,        # Lower is better
    "gen_time": 0.25,    # Lower is better
    "duration_accuracy": 0.20,  # Closer to median is better
    "silence": 0.25,     # Lower silence ratio is better
}


def compute_silence_ratio(audio_path: str) -> float:
    """Compute fraction of audio that is silence (amplitude < threshold).

    Reads raw PCM samples from WAV file (skips 44-byte header).
    """
    try:
        with open(audio_path, "rb") as f:
            f.seek(44)  # Skip WAV header
            raw = f.read()

        if len(raw) < 2:
            return 0.0

        # Unpack 16-bit signed PCM samples
        num_samples = len(raw) // 2
        samples = struct.unpack(f"<{num_samples}h", raw[:num_samples * 2])

        threshold = 300  # ~-44dB for 16-bit audio
        silent_count = sum(1 for s in samples if abs(s) < threshold)
        return round(silent_count / num_samples, 4)
    except Exception as e:
        logger.warning("Failed to compute silence ratio: %s", e)
        return 0.0


def compute_trial_metrics(trial_dict: dict) -> dict:
    """Compute all v1 metrics for a single trial.

    Args:
        trial_dict: dict with keys audio_path, ttfb_ms, generation_time_ms, duration_seconds

    Returns:
        dict with silence_ratio added
    """
    silence = compute_silence_ratio(trial_dict["audio_path"])
    return {"silence_ratio": silence}


def aggregate_experiment_results(trials: list[dict]) -> dict:
    """Aggregate trial results into experiment-level rankings.

    Args:
        trials: list of dicts, each with keys:
            provider, voice_id, model_id, ttfb_ms, generation_time_ms,
            duration_seconds, silence_ratio, status

    Returns:
        dict with rankings, head_to_head, winner, confidence
    """
    # Group completed trials by model key
    by_model: dict[str, list[dict]] = {}
    for t in trials:
        if t["status"] != "completed":
            continue
        key = f"{t['provider']}:{t['voice_id']}"
        by_model.setdefault(key, []).append(t)

    if len(by_model) < 2:
        return {
            "rankings": [],
            "head_to_head": [],
            "winner": None,
            "confidence": "inconclusive",
        }

    # Compute per-model averages
    rankings = []
    for key, model_trials in by_model.items():
        provider, voice_id = key.split(":", 1)
        model_id = model_trials[0]["model_id"]
        completed = [t for t in model_trials if t["status"] == "completed"]
        failed = len(model_trials) - len(completed)

        ttfbs = [t["ttfb_ms"] for t in completed if t["ttfb_ms"] is not None]
        gen_times = [t["generation_time_ms"] for t in completed if t["generation_time_ms"] is not None]
        durations = [t["duration_seconds"] for t in completed if t["duration_seconds"] is not None]
        silences = [t["silence_ratio"] for t in completed if t["silence_ratio"] is not None]

        # Composite: lower latency better, lower silence better
        # Normalize each metric 0-1 where 1 = best
        norm_ttfb = 1.0 - min((mean(ttfbs) if ttfbs else 1000) / 2000, 1.0)
        norm_gen = 1.0 - min((mean(gen_times) if gen_times else 2000) / 5000, 1.0)
        norm_silence = 1.0 - (mean(silences) if silences else 0.5)
        norm_duration = 1.0 if durations else 0.0  # Presence of audio

        composite = (
            WEIGHTS["ttfb"] * norm_ttfb
            + WEIGHTS["gen_time"] * norm_gen
            + WEIGHTS["silence"] * norm_silence
            + WEIGHTS["duration_accuracy"] * norm_duration
        )

        rankings.append({
            "provider": provider,
            "voice_id": voice_id,
            "model_id": model_id,
            "trials_completed": len(completed),
            "trials_failed": failed,
            "avg_duration_seconds": round(mean(durations), 3) if durations else None,
            "avg_ttfb_ms": round(mean(ttfbs), 1) if ttfbs else None,
            "avg_generation_time_ms": round(mean(gen_times), 1) if gen_times else None,
            "avg_silence_ratio": round(mean(silences), 4) if silences else None,
            "composite_score": round(composite, 4),
        })

    # Sort by composite score descending
    rankings.sort(key=lambda r: r["composite_score"], reverse=True)

    # Head-to-head: for each prompt, compare models pairwise
    prompt_indices = set()
    for t in trials:
        if t["status"] == "completed":
            prompt_indices.add(t["prompt_index"])

    h2h_map: dict[tuple[str, str], dict] = {}
    keys = list(by_model.keys())
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            h2h_map[(keys[i], keys[j])] = {"a_wins": 0, "b_wins": 0, "ties": 0}

    for pi in prompt_indices:
        # Get trial per model for this prompt
        prompt_trials: dict[str, dict] = {}
        for t in trials:
            if t["status"] == "completed" and t["prompt_index"] == pi:
                key = f"{t['provider']}:{t['voice_id']}"
                prompt_trials[key] = t

        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                a, b = keys[i], keys[j]
                if a not in prompt_trials or b not in prompt_trials:
                    continue
                ta, tb = prompt_trials[a], prompt_trials[b]
                # Compare by composite of TTFB + gen_time (lower = better)
                score_a = (ta.get("ttfb_ms") or 9999) + (ta.get("generation_time_ms") or 9999)
                score_b = (tb.get("ttfb_ms") or 9999) + (tb.get("generation_time_ms") or 9999)
                pair = h2h_map[(a, b)]
                if abs(score_a - score_b) < 50:  # 50ms tie threshold
                    pair["ties"] += 1
                elif score_a < score_b:
                    pair["a_wins"] += 1
                else:
                    pair["b_wins"] += 1

    head_to_head = [
        {
            "model_a": a,
            "model_b": b,
            "a_wins": v["a_wins"],
            "b_wins": v["b_wins"],
            "ties": v["ties"],
        }
        for (a, b), v in h2h_map.items()
    ]

    # Determine winner
    winner = None
    confidence = "inconclusive"
    if len(rankings) >= 2:
        top = rankings[0]
        second = rankings[1]
        gap = top["composite_score"] - second["composite_score"]
        if gap > 0.10:
            winner = f"{top['provider']}:{top['voice_id']}"
            confidence = "high"
        elif gap > 0.05:
            winner = f"{top['provider']}:{top['voice_id']}"
            confidence = "medium"
        elif gap > 0.02:
            winner = f"{top['provider']}:{top['voice_id']}"
            confidence = "low"

    return {
        "rankings": rankings,
        "head_to_head": head_to_head,
        "winner": winner,
        "confidence": confidence,
    }
```

**Step 2: Commit**

```
git add packages/arena-api/app/services/scoring.py
git commit -m "feat: scoring service for experiment trial aggregation"
```

---

### Task 7: Experiment Runner Service

**Files:**
- Create: `packages/arena-api/app/services/experiment_runner.py`

**Step 1: Create experiment runner**

Create `packages/arena-api/app/services/experiment_runner.py`:

```python
"""Experiment runner — orchestrates TTS generation and scoring for all trials."""
import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.experiment import Experiment, Trial
from app.models.voice_model import VoiceModel
from app.services.scoring import compute_trial_metrics, aggregate_experiment_results
from app.services.tts_service import generate_tts

logger = logging.getLogger("arena.experiment_runner")


async def run_experiment(experiment_id: str) -> None:
    """Run all trials for an experiment, score, aggregate, and store results.

    This is meant to be called via asyncio.create_task().
    """
    try:
        await _execute_experiment(experiment_id)
    except Exception as e:
        logger.error("Experiment %s failed: %s", experiment_id, e)
        async with async_session() as db:
            result = await db.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )
            exp = result.scalar_one()
            exp.status = "failed"
            exp.error_message = str(e)
            await db.commit()


async def _execute_experiment(experiment_id: str) -> None:
    """Core experiment execution logic."""
    async with async_session() as db:
        result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        exp = result.scalar_one()

        # Resolve model specs to actual voice_id / model_id from DB
        model_specs = []
        for spec in exp.models_json:
            provider = spec["provider"]
            voice_id = spec.get("voice_id")

            if voice_id:
                # Use specified voice
                vm_result = await db.execute(
                    select(VoiceModel).where(
                        VoiceModel.provider == provider,
                        VoiceModel.config_json["voice_id"].astext == voice_id,
                    )
                )
                vm = vm_result.scalar_one_or_none()
            else:
                # Pick first available voice for provider
                vm_result = await db.execute(
                    select(VoiceModel).where(
                        VoiceModel.provider == provider,
                        VoiceModel.config_json.isnot(None),
                    ).limit(1)
                )
                vm = vm_result.scalar_one_or_none()

            if not vm:
                raise ValueError(f"No voice found for provider '{provider}'" +
                                 (f" with voice_id '{voice_id}'" if voice_id else ""))

            model_specs.append({
                "provider": provider,
                "voice_id": vm.config_json.get("voice_id"),
                "model_id": vm.config_json.get("model_id", ""),
            })

        # Create trial records
        prompts = exp.prompts_json
        trials = []
        for pi, prompt_text in enumerate(prompts):
            for ms in model_specs:
                trial = Trial(
                    experiment_id=experiment_id,
                    prompt_index=pi,
                    prompt_text=prompt_text,
                    provider=ms["provider"],
                    voice_id=ms["voice_id"],
                    model_id=ms["model_id"],
                    status="pending",
                )
                db.add(trial)
                trials.append(trial)

        exp.total_trials = len(trials)
        exp.status = "running"
        await db.commit()

        # Refresh to get IDs
        for t in trials:
            await db.refresh(t)

    # Run TTS generation for all trials in parallel (batched)
    loop = asyncio.get_event_loop()
    batch_size = 8  # Limit concurrent TTS calls

    for i in range(0, len(trials), batch_size):
        batch = trials[i:i + batch_size]
        tasks = []
        for trial in batch:
            tasks.append(
                loop.run_in_executor(
                    None, generate_tts, trial.prompt_text,
                    trial.provider, trial.voice_id, trial.model_id,
                )
            )
        results = await asyncio.gather(*tasks, return_exceptions=True)

        async with async_session() as db:
            for trial, tts_result in zip(batch, results):
                result = await db.execute(
                    select(Trial).where(Trial.id == trial.id)
                )
                t = result.scalar_one()

                if isinstance(tts_result, Exception):
                    t.status = "failed"
                    t.error_message = str(tts_result)
                    logger.error("Trial %s failed: %s", t.id, tts_result)
                else:
                    t.audio_path = tts_result["audio_path"]
                    t.audio_filename = tts_result["filename"]
                    t.duration_seconds = tts_result["duration_seconds"]
                    t.ttfb_ms = tts_result["ttfb_ms"]
                    t.generation_time_ms = tts_result["generation_time_ms"]

                    # Compute additional metrics
                    metrics = compute_trial_metrics(tts_result)
                    t.silence_ratio = metrics["silence_ratio"]
                    t.status = "completed"

            # Update experiment progress
            exp_result = await db.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )
            exp = exp_result.scalar_one()
            trial_results = await db.execute(
                select(Trial).where(Trial.experiment_id == experiment_id)
            )
            all_trials = trial_results.scalars().all()
            exp.completed_trials = sum(
                1 for t in all_trials if t.status in ("completed", "failed")
            )
            await db.commit()

    # Aggregate results
    async with async_session() as db:
        trial_results = await db.execute(
            select(Trial).where(Trial.experiment_id == experiment_id)
        )
        all_trials = trial_results.scalars().all()

        trial_dicts = [
            {
                "provider": t.provider,
                "voice_id": t.voice_id,
                "model_id": t.model_id,
                "prompt_index": t.prompt_index,
                "ttfb_ms": t.ttfb_ms,
                "generation_time_ms": t.generation_time_ms,
                "duration_seconds": t.duration_seconds,
                "silence_ratio": t.silence_ratio,
                "status": t.status,
            }
            for t in all_trials
        ]

        results = aggregate_experiment_results(trial_dicts)

        exp_result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        exp = exp_result.scalar_one()
        exp.results_json = results
        exp.status = "completed"
        exp.completed_trials = exp.total_trials
        await db.commit()

    logger.info("Experiment %s completed: winner=%s confidence=%s",
                experiment_id, results.get("winner"), results.get("confidence"))

    # Fire webhook if configured
    async with async_session() as db:
        exp_result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        exp = exp_result.scalar_one()
        if exp.webhook_url:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        exp.webhook_url,
                        json={
                            "experiment_id": exp.id,
                            "status": "completed",
                            "results": results,
                        },
                        timeout=10,
                    )
                logger.info("Webhook sent for experiment %s", experiment_id)
            except Exception as e:
                logger.warning("Webhook failed for experiment %s: %s", experiment_id, e)
```

**Step 2: Commit**

```
git add packages/arena-api/app/services/experiment_runner.py
git commit -m "feat: experiment runner service (TTS generation + scoring + webhook)"
```

---

### Task 8: Experiment Router (6 endpoints)

**Files:**
- Create: `packages/arena-api/app/routers/experiments.py`
- Modify: `packages/arena-api/app/main.py`

**Step 1: Create router**

Create `packages/arena-api/app/routers/experiments.py`:

```python
"""Experiment endpoints — programmatic voice AI A/B testing."""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.api_auth import get_current_developer
from app.models.developer import Developer
from app.models.experiment import Experiment, Trial
from app.schemas.experiment import (
    ExperimentCreate,
    ExperimentResponse,
    ExperimentListResponse,
    ExperimentResultsResponse,
    TrialResponse,
)

logger = logging.getLogger("arena.experiments")

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])

VALID_SCENARIOS = {
    "general", "customer_support", "medical", "financial",
    "technical_support", "adversarial", "multilingual",
}

VALID_PROVIDERS = {"cartesia", "elevenlabs", "smallestai", "deepgram"}

VALID_EVAL_MODES = {"automated"}  # v1 only supports automated


@router.post("", response_model=ExperimentResponse, status_code=201)
async def create_experiment(
    body: ExperimentCreate,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Create a new experiment."""
    # Validate scenario
    if body.scenario not in VALID_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario '{body.scenario}'. Must be one of: {sorted(VALID_SCENARIOS)}",
        )

    # Validate eval_mode
    if body.eval_mode not in VALID_EVAL_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid eval_mode '{body.eval_mode}'. Must be one of: {sorted(VALID_EVAL_MODES)}",
        )

    # Validate providers
    for ms in body.models:
        if ms.provider not in VALID_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid provider '{ms.provider}'. Must be one of: {sorted(VALID_PROVIDERS)}",
            )

    # Validate prompts are non-empty strings
    for i, p in enumerate(body.prompts):
        if not p.strip():
            raise HTTPException(status_code=400, detail=f"Prompt at index {i} is empty")

    experiment = Experiment(
        developer_id=developer.id,
        name=body.name,
        scenario=body.scenario,
        eval_mode=body.eval_mode,
        models_json=[ms.model_dump() for ms in body.models],
        prompts_json=body.prompts,
        webhook_url=body.webhook_url,
    )
    db.add(experiment)
    await db.commit()
    await db.refresh(experiment)

    logger.info("Experiment created: %s by developer %s", experiment.id, developer.id)
    return experiment


@router.post("/{experiment_id}/run", response_model=ExperimentResponse)
async def run_experiment(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Start running an experiment (kicks off background TTS + scoring)."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != "created":
        raise HTTPException(
            status_code=409,
            detail=f"Experiment is already '{exp.status}'. Only 'created' experiments can be run.",
        )

    # Launch background task
    from app.services.experiment_runner import run_experiment as execute_experiment
    asyncio.create_task(execute_experiment(experiment_id))

    # Mark as running so immediate GET shows status
    exp.status = "running"
    await db.commit()
    await db.refresh(exp)

    logger.info("Experiment %s started", experiment_id)
    return exp


@router.get("", response_model=list[ExperimentListResponse])
async def list_experiments(
    status: str | None = None,
    scenario: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """List experiments for the authenticated developer."""
    stmt = (
        select(Experiment)
        .where(Experiment.developer_id == developer.id)
        .order_by(Experiment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        stmt = stmt.where(Experiment.status == status)
    if scenario:
        stmt = stmt.where(Experiment.scenario == scenario)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Get experiment details and status."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.get("/{experiment_id}/results", response_model=ExperimentResultsResponse)
async def get_experiment_results(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated results for a completed experiment."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Experiment is '{exp.status}'. Results are only available when status is 'completed'.",
        )

    results = exp.results_json
    return ExperimentResultsResponse(
        experiment_id=exp.id,
        status=exp.status,
        rankings=results.get("rankings", []),
        head_to_head=results.get("head_to_head", []),
        winner=results.get("winner"),
        confidence=results.get("confidence", "inconclusive"),
    )


@router.get("/{experiment_id}/trials", response_model=list[TrialResponse])
async def get_experiment_trials(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Get individual trial details for an experiment."""
    # Verify experiment belongs to developer
    exp_result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    if not exp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Experiment not found")

    result = await db.execute(
        select(Trial)
        .where(Trial.experiment_id == experiment_id)
        .order_by(Trial.prompt_index, Trial.provider)
    )
    trials = result.scalars().all()

    return [
        TrialResponse(
            id=t.id,
            experiment_id=t.experiment_id,
            prompt_index=t.prompt_index,
            prompt_text=t.prompt_text,
            provider=t.provider,
            voice_id=t.voice_id,
            model_id=t.model_id,
            status=t.status,
            audio_url=f"/api/v1/audio/{t.audio_filename}" if t.audio_filename else None,
            duration_seconds=t.duration_seconds,
            ttfb_ms=t.ttfb_ms,
            generation_time_ms=t.generation_time_ms,
            silence_ratio=t.silence_ratio,
            error_message=t.error_message,
            created_at=t.created_at,
        )
        for t in trials
    ]
```

**Step 2: Register router in main.py**

Add to `packages/arena-api/app/main.py`:

```python
from app.routers import ..., experiments
app.include_router(experiments.router)
```

**Step 3: Commit**

```
git add packages/arena-api/app/routers/experiments.py packages/arena-api/app/main.py
git commit -m "feat: experiments API router with 6 endpoints"
```

---

### Task 9: Add httpx Dependency

**Files:**
- Modify: `packages/arena-api/pyproject.toml`

**Step 1: Add httpx for webhook calls**

Add `"httpx>=0.27.0"` to the `dependencies` list in `packages/arena-api/pyproject.toml`.

**Step 2: Commit**

```
git add packages/arena-api/pyproject.toml
git commit -m "feat: add httpx dependency for experiment webhook calls"
```

---

### Task 10: Deploy + Verify

**Step 1: Deploy to Railway**

```bash
cd packages/arena-api && railway up
```

Wait for deployment. The migration will run automatically (`alembic upgrade head` in Dockerfile CMD).

**Step 2: Verify health**

```bash
curl -s https://arena-api-production-964b.up.railway.app/api/v1/health
```

Expected: `{"status":"ok"}`

**Step 3: Register a test developer**

```bash
curl -s -X POST https://arena-api-production-964b.up.railway.app/api/v1/developers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Dev","email":"test@dev.com"}'
```

Expected: JSON with `id`, `name`, `email`, `api_key` (save the api_key).

**Step 4: Create a test experiment**

```bash
curl -s -X POST https://arena-api-production-964b.up.railway.app/api/v1/experiments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api_key>" \
  -d '{
    "name": "Test experiment",
    "scenario": "general",
    "eval_mode": "automated",
    "models": [
      {"provider": "cartesia"},
      {"provider": "deepgram"}
    ],
    "prompts": ["Hello, how can I help you today?"]
  }'
```

Expected: JSON with experiment ID and status `created`.

**Step 5: Run the experiment**

```bash
curl -s -X POST https://arena-api-production-964b.up.railway.app/api/v1/experiments/<experiment_id>/run \
  -H "Authorization: Bearer <api_key>"
```

Expected: status changes to `running`.

**Step 6: Poll for completion**

```bash
curl -s https://arena-api-production-964b.up.railway.app/api/v1/experiments/<experiment_id> \
  -H "Authorization: Bearer <api_key>"
```

Poll until `status` is `completed`.

**Step 7: Get results**

```bash
curl -s https://arena-api-production-964b.up.railway.app/api/v1/experiments/<experiment_id>/results \
  -H "Authorization: Bearer <api_key>"
```

Expected: JSON with `rankings`, `head_to_head`, `winner`, `confidence`.

**Step 8: Push to main**

```bash
git push origin main
```

**Step 9: Commit**

No code to commit — this is a verification step.
