# Arena Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a FastAPI backend that wraps the voice_evals Python pipeline, stores results in PostgreSQL, and serves the Arena frontend with real evaluation data.

**Architecture:** FastAPI (port 8000) wraps voice_evals via editable install. Async eval jobs run in ProcessPoolExecutor with WebSocket progress. PostgreSQL stores models, evaluations, battles, scenarios, leaderboard snapshots. Arena frontend proxies `/api` to the backend.

**Tech Stack:** FastAPI, SQLAlchemy (async), asyncpg, Alembic, pydantic-settings, ProcessPoolExecutor, WebSocket, PostgreSQL

**Design Doc:** `docs/plans/2026-02-16-arena-backend-design.md`

---

## Task 1: Make voice_evals installable as a package

The `evals/voice_evals/` module has no `pyproject.toml` or `setup.py` — it can't be pip-installed. We need to add one so the API can `pip install -e ../../evals`.

**Files:**
- Create: `evals/pyproject.toml`

**Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "voice-evals"
version = "2.0.0"
description = "Voice AI evaluation framework"
requires-python = ">=3.10"
dependencies = [
    "librosa>=0.10.0",
    "numpy>=1.24.0",
    "scipy>=1.11.0",
    "soundfile>=0.12.0",
    "torch>=2.0.0",
    "torchaudio>=2.0.0",
    "transformers>=4.30.0",
    "openai-whisper>=20231117",
    "sentence-transformers>=2.2.0",
    "tiktoken>=0.5.0",
]

[project.optional-dependencies]
diarization = ["pyannote.audio>=3.1.0"]
emotion = ["funasr>=1.0.0"]
all = ["pyannote.audio>=3.1.0", "funasr>=1.0.0"]

[tool.setuptools.packages.find]
include = ["voice_evals*"]
```

**Step 2: Verify editable install works**

Run: `cd /Users/sidgraph/VoiceLoop/evals && pip install -e . --dry-run`
Expected: Shows what would be installed without errors.

**Step 3: Commit**

```bash
git add evals/pyproject.toml
git commit -m "feat(evals): add pyproject.toml for editable install"
```

---

## Task 2: Scaffold arena-api package

Create the FastAPI project skeleton with config, database setup, and a health endpoint.

**Files:**
- Create: `packages/arena-api/pyproject.toml`
- Create: `packages/arena-api/requirements.txt`
- Create: `packages/arena-api/app/__init__.py`
- Create: `packages/arena-api/app/main.py`
- Create: `packages/arena-api/app/config.py`
- Create: `packages/arena-api/app/database.py`
- Create: `packages/arena-api/.env.example`
- Create: `packages/arena-api/.gitignore`

**Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "arena-api"
version = "0.1.0"
description = "VoiceLoop Arena API"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pydantic-settings>=2.7.0",
    "python-multipart>=0.0.20",
    "websockets>=14.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24.0", "httpx>=0.28.0"]
```

**Step 2: Create requirements.txt**

```
-e ../../evals
-e .[dev]
```

**Step 3: Create app/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voiceloop_arena"
    hf_token: str = ""
    enable_diarization: bool = True
    default_num_speakers: int = 2
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    max_eval_workers: int = 2
    max_upload_size_mb: int = 50
    elo_k_factor: int = 32
    human_vote_weight: float = 1.5
    audio_storage_path: str = "./uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 4: Create app/database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session
```

**Step 5: Create app/main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create upload dir
    import os
    os.makedirs(settings.audio_storage_path, exist_ok=True)
    yield
    # Shutdown: nothing to clean up yet


app = FastAPI(title="VoiceLoop Arena API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
```

**Step 6: Create .env.example and .gitignore**

`.env.example`:
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/voiceloop_arena
HF_TOKEN=
AUDIO_STORAGE_PATH=./uploads
```

`.gitignore`:
```
__pycache__/
*.pyc
.env
uploads/
*.egg-info/
```

**Step 7: Create empty `app/__init__.py`**

Empty file.

**Step 8: Verify server starts**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && pip install -e ".[dev]" && uvicorn app.main:app --port 8000 &`
Run: `curl http://localhost:8000/api/v1/health`
Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
git add packages/arena-api/
git commit -m "feat(arena-api): scaffold FastAPI project with config and health endpoint"
```

---

## Task 3: SQLAlchemy ORM models

Define all 6 database tables as SQLAlchemy models.

**Files:**
- Create: `packages/arena-api/app/models/__init__.py`
- Create: `packages/arena-api/app/models/base.py`
- Create: `packages/arena-api/app/models/voice_model.py`
- Create: `packages/arena-api/app/models/scenario.py`
- Create: `packages/arena-api/app/models/evaluation.py`
- Create: `packages/arena-api/app/models/battle.py`
- Create: `packages/arena-api/app/models/leaderboard.py`
- Create: `packages/arena-api/app/models/user.py`

**Step 1: Create base.py with shared Base**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


def generate_uuid() -> str:
    return str(uuid.uuid4())
```

**Step 2: Create voice_model.py**

```python
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class VoiceModel(Base, TimestampMixin):
    __tablename__ = "models"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, default="")
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    elo_rating: Mapped[float] = mapped_column(Float, default=1500.0)
    total_battles: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Step 3: Create scenario.py**

```python
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Scenario(Base, TimestampMixin):
    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String, default="medium")
    ground_truth_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Step 4: Create evaluation.py**

```python
from sqlalchemy import String, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Evaluation(Base, TimestampMixin):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    scenario_id: Mapped[str | None] = mapped_column(String, ForeignKey("scenarios.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    audio_path: Mapped[str] = mapped_column(String, nullable=False)
    transcript_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    diarization_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Step 5: Create battle.py**

```python
from sqlalchemy import String, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Battle(Base, TimestampMixin):
    __tablename__ = "battles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id"), nullable=False)
    model_a_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    model_b_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    eval_a_id: Mapped[str | None] = mapped_column(String, ForeignKey("evaluations.id"), nullable=True)
    eval_b_id: Mapped[str | None] = mapped_column(String, ForeignKey("evaluations.id"), nullable=True)
    winner: Mapped[str | None] = mapped_column(String, nullable=True)
    vote_source: Mapped[str | None] = mapped_column(String, nullable=True)
    elo_delta: Mapped[float | None] = mapped_column(Float, nullable=True)
```

**Step 6: Create leaderboard.py**

```python
from datetime import date
from sqlalchemy import String, Float, Integer, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, generate_uuid


class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    elo_rating: Mapped[float] = mapped_column(Float, nullable=False)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    total_battles: Mapped[int] = mapped_column(Integer, default=0)
    avg_wer: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_semascore: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_prosody: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_quality: Mapped[float | None] = mapped_column(Float, nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
```

**Step 7: Create user.py**

```python
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    session_token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    votes_cast: Mapped[int] = mapped_column(Integer, default=0)
```

**Step 8: Create models/__init__.py that exports all models**

```python
from app.models.base import Base
from app.models.voice_model import VoiceModel
from app.models.scenario import Scenario
from app.models.evaluation import Evaluation
from app.models.battle import Battle
from app.models.leaderboard import LeaderboardSnapshot
from app.models.user import User

__all__ = ["Base", "VoiceModel", "Scenario", "Evaluation", "Battle", "LeaderboardSnapshot", "User"]
```

**Step 9: Verify models import cleanly**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && python -c "from app.models import Base, VoiceModel, Scenario, Evaluation, Battle, LeaderboardSnapshot, User; print('All models loaded:', len(Base.metadata.tables), 'tables')"`
Expected: `All models loaded: 6 tables`

**Step 10: Commit**

```bash
git add packages/arena-api/app/models/
git commit -m "feat(arena-api): add SQLAlchemy ORM models for all 6 tables"
```

---

## Task 4: Alembic migrations setup + initial migration

Set up Alembic for database migrations and create the initial schema.

**Files:**
- Create: `packages/arena-api/alembic.ini`
- Create: `packages/arena-api/alembic/env.py`
- Create: `packages/arena-api/alembic/script.py.mako`
- Create: `packages/arena-api/alembic/versions/` (directory)

**Step 1: Initialize Alembic**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && alembic init alembic`

**Step 2: Edit alembic.ini — set sqlalchemy.url**

Set `sqlalchemy.url` to empty string (we'll override in env.py):
```ini
sqlalchemy.url =
```

**Step 3: Edit alembic/env.py to use async engine and our models**

Replace the generated `env.py` with:

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.config import settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 4: Create the Postgres database**

Run: `createdb voiceloop_arena`
Expected: No output (success) or "already exists" if re-running.

**Step 5: Generate initial migration**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && alembic revision --autogenerate -m "initial schema"`
Expected: Creates a file in `alembic/versions/` with all 6 tables.

**Step 6: Run the migration**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && alembic upgrade head`
Expected: `INFO [alembic.runtime.migration] Running upgrade -> <revision>, initial schema`

**Step 7: Verify tables exist**

Run: `psql voiceloop_arena -c "\dt"`
Expected: Lists `models`, `evaluations`, `scenarios`, `battles`, `leaderboard_snapshots`, `users`, `alembic_version`

**Step 8: Commit**

```bash
git add packages/arena-api/alembic.ini packages/arena-api/alembic/
git commit -m "feat(arena-api): add Alembic migrations with initial schema (6 tables)"
```

---

## Task 5: Pydantic request/response schemas

Define typed schemas for all API request and response bodies.

**Files:**
- Create: `packages/arena-api/app/schemas/__init__.py`
- Create: `packages/arena-api/app/schemas/model.py`
- Create: `packages/arena-api/app/schemas/scenario.py`
- Create: `packages/arena-api/app/schemas/evaluation.py`
- Create: `packages/arena-api/app/schemas/battle.py`
- Create: `packages/arena-api/app/schemas/leaderboard.py`

**Step 1: Create model schemas**

```python
# app/schemas/model.py
from pydantic import BaseModel


class ModelCreate(BaseModel):
    name: str
    provider: str
    version: str = ""
    config_json: dict | None = None


class ModelUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    version: str | None = None
    config_json: dict | None = None


class ModelResponse(BaseModel):
    id: str
    name: str
    provider: str
    version: str
    config_json: dict | None
    elo_rating: float
    total_battles: int
    win_rate: float
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
```

**Step 2: Create scenario schemas**

```python
# app/schemas/scenario.py
from pydantic import BaseModel


class ScenarioCreate(BaseModel):
    name: str
    category: str
    description: str = ""
    difficulty: str = "medium"
    ground_truth_transcript: str | None = None


class ScenarioResponse(BaseModel):
    id: str
    name: str
    category: str
    description: str
    difficulty: str
    ground_truth_transcript: str | None
    created_at: str

    model_config = {"from_attributes": True}
```

**Step 3: Create evaluation schemas**

```python
# app/schemas/evaluation.py
from pydantic import BaseModel


class EvaluationCreate(BaseModel):
    model_id: str
    scenario_id: str | None = None
    transcript_ref: str | None = None


class EvaluationResponse(BaseModel):
    id: str
    model_id: str
    scenario_id: str | None
    status: str
    audio_path: str
    metrics_json: dict | None
    diarization_json: dict | None
    duration_seconds: float | None
    error_message: str | None
    created_at: str

    model_config = {"from_attributes": True}


class EvaluationProgress(BaseModel):
    eval_id: str
    step: int
    total_steps: int
    stage: str
    message: str
```

**Step 4: Create battle schemas**

```python
# app/schemas/battle.py
from pydantic import BaseModel


class BattleCreate(BaseModel):
    scenario_id: str
    model_a_id: str
    model_b_id: str


class BattleVote(BaseModel):
    winner: str  # "a", "b", or "tie"


class BattleResponse(BaseModel):
    id: str
    scenario_id: str
    model_a_id: str
    model_b_id: str
    eval_a_id: str | None
    eval_b_id: str | None
    winner: str | None
    vote_source: str | None
    elo_delta: float | None
    created_at: str

    model_config = {"from_attributes": True}
```

**Step 5: Create leaderboard schemas**

```python
# app/schemas/leaderboard.py
from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    model_id: str
    model_name: str
    provider: str
    elo_rating: float
    win_rate: float
    total_battles: int
    avg_wer: float | None
    avg_semascore: float | None
    avg_prosody: float | None
    avg_quality: float | None
    rank: int


class LeaderboardHistoryEntry(BaseModel):
    model_id: str
    model_name: str
    elo_rating: float
    snapshot_date: str
```

**Step 6: Create schemas/__init__.py**

```python
from app.schemas.model import ModelCreate, ModelUpdate, ModelResponse
from app.schemas.scenario import ScenarioCreate, ScenarioResponse
from app.schemas.evaluation import EvaluationCreate, EvaluationResponse, EvaluationProgress
from app.schemas.battle import BattleCreate, BattleVote, BattleResponse
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardHistoryEntry
```

**Step 7: Verify schemas**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && python -c "from app.schemas import *; print('All schemas loaded')"`
Expected: `All schemas loaded`

**Step 8: Commit**

```bash
git add packages/arena-api/app/schemas/
git commit -m "feat(arena-api): add Pydantic request/response schemas"
```

---

## Task 6: Models router (CRUD)

Implement POST/GET/PATCH for voice models.

**Files:**
- Create: `packages/arena-api/app/routers/__init__.py`
- Create: `packages/arena-api/app/routers/models.py`
- Modify: `packages/arena-api/app/main.py` (register router)
- Create: `packages/arena-api/tests/__init__.py`
- Create: `packages/arena-api/tests/test_models.py`

**Step 1: Write tests for models CRUD**

```python
# tests/test_models.py
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_create_model(client):
    resp = await client.post("/api/v1/models", json={
        "name": "Test Model",
        "provider": "openai",
        "version": "v1",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Model"
    assert data["elo_rating"] == 1500.0


@pytest.mark.asyncio
async def test_list_models(client):
    resp = await client.get("/api/v1/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

Note: These tests require a test database. For initial development, test manually with curl. Integration tests can use SQLite or a test Postgres database later.

**Step 2: Create models router**

```python
# app/routers/models.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.schemas.model import ModelCreate, ModelUpdate, ModelResponse

router = APIRouter(prefix="/api/v1/models", tags=["models"])


@router.post("", response_model=ModelResponse, status_code=201)
async def create_model(body: ModelCreate, db: AsyncSession = Depends(get_db)):
    model = VoiceModel(**body.model_dump())
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


@router.get("", response_model=list[ModelResponse])
async def list_models(
    provider: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(VoiceModel).order_by(VoiceModel.elo_rating.desc())
    if provider:
        stmt = stmt.where(VoiceModel.provider == provider)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.patch("/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str, body: ModelUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(model, field, value)
    await db.commit()
    await db.refresh(model)
    return model
```

**Step 3: Create empty routers/__init__.py**

Empty file.

**Step 4: Register router in main.py**

Add to `app/main.py` after CORS middleware:

```python
from app.routers import models

app.include_router(models.router)
```

**Step 5: Test manually**

Run: `curl -X POST http://localhost:8000/api/v1/models -H "Content-Type: application/json" -d '{"name":"GPT-4o Realtime","provider":"openai","version":"v1"}'`
Expected: JSON with id, name, elo_rating=1500, etc.

Run: `curl http://localhost:8000/api/v1/models`
Expected: Array with the created model.

**Step 6: Commit**

```bash
git add packages/arena-api/app/routers/ packages/arena-api/tests/
git commit -m "feat(arena-api): add models CRUD router"
```

---

## Task 7: Scenarios router (CRUD)

**Files:**
- Create: `packages/arena-api/app/routers/scenarios.py`
- Modify: `packages/arena-api/app/main.py` (register router)

**Step 1: Create scenarios router**

```python
# app/routers/scenarios.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.scenario import Scenario
from app.schemas.scenario import ScenarioCreate, ScenarioResponse

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("", response_model=ScenarioResponse, status_code=201)
async def create_scenario(body: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    scenario = Scenario(**body.model_dump())
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.get("", response_model=list[ScenarioResponse])
async def list_scenarios(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Scenario).order_by(Scenario.created_at.desc())
    if category:
        stmt = stmt.where(Scenario.category == category)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario
```

**Step 2: Register in main.py**

```python
from app.routers import models, scenarios

app.include_router(models.router)
app.include_router(scenarios.router)
```

**Step 3: Test manually**

Run: `curl -X POST http://localhost:8000/api/v1/scenarios -H "Content-Type: application/json" -d '{"name":"Angry customer refund","category":"customer_service","difficulty":"hard"}'`

**Step 4: Commit**

```bash
git add packages/arena-api/app/routers/scenarios.py packages/arena-api/app/main.py
git commit -m "feat(arena-api): add scenarios CRUD router"
```

---

## Task 8: Eval worker with ProcessPoolExecutor

Wrap voice_evals pipeline in an async worker that runs evals in a separate process.

**Files:**
- Create: `packages/arena-api/app/workers/__init__.py`
- Create: `packages/arena-api/app/workers/eval_worker.py`
- Create: `packages/arena-api/app/services/__init__.py`
- Create: `packages/arena-api/app/services/eval_service.py`
- Modify: `packages/arena-api/app/main.py` (add executor to lifespan)

**Step 1: Create eval_worker.py — runs in subprocess**

```python
# app/workers/eval_worker.py
import dataclasses
from voice_evals import VoiceEvaluationPipeline


def run_evaluation(
    audio_path: str,
    transcript_path: str | None,
    hf_token: str,
    enable_diarization: bool,
    num_speakers: int | None,
) -> dict:
    """Runs VoiceEvaluationPipeline in a worker process. Returns serializable dict."""
    pipeline = VoiceEvaluationPipeline(
        audio_path=audio_path,
        transcript_path=transcript_path,
        hf_token=hf_token or None,
        enable_diarization=enable_diarization,
        num_speakers=num_speakers,
    )
    metrics = pipeline.evaluate()
    return dataclasses.asdict(metrics)
```

**Step 2: Create eval_service.py — orchestrates eval lifecycle**

```python
# app/services/eval_service.py
import asyncio
from concurrent.futures import ProcessPoolExecutor
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.evaluation import Evaluation
from app.workers.eval_worker import run_evaluation

# Module-level executor, initialized in lifespan
executor: ProcessPoolExecutor | None = None


def init_executor():
    global executor
    executor = ProcessPoolExecutor(max_workers=settings.max_eval_workers)


def shutdown_executor():
    global executor
    if executor:
        executor.shutdown(wait=False)
        executor = None


async def submit_evaluation(eval_id: str, db_url: str) -> None:
    """Submit an evaluation job to the process pool."""
    if not executor:
        raise RuntimeError("Executor not initialized")

    loop = asyncio.get_event_loop()

    # Read eval record to get audio_path and config
    from app.database import async_session

    async with async_session() as db:
        result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
        eval_record = result.scalar_one()

        # Mark as running
        eval_record.status = "running"
        await db.commit()

        audio_path = eval_record.audio_path
        transcript_ref = eval_record.transcript_ref

    # Run in process pool
    try:
        metrics_dict = await loop.run_in_executor(
            executor,
            run_evaluation,
            audio_path,
            transcript_ref,
            settings.hf_token,
            settings.enable_diarization,
            settings.default_num_speakers,
        )

        # Save results
        async with async_session() as db:
            result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
            eval_record = result.scalar_one()
            eval_record.status = "completed"
            eval_record.metrics_json = metrics_dict.get("overall_metrics")
            eval_record.diarization_json = {
                "num_speakers": metrics_dict.get("num_speakers"),
                "speaker_metrics": metrics_dict.get("speaker_metrics"),
                "timeline": metrics_dict.get("diarization_timeline"),
            }
            eval_record.duration_seconds = (
                metrics_dict.get("overall_metrics", {}).get("total_duration_seconds")
            )
            await db.commit()

    except Exception as e:
        async with async_session() as db:
            result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
            eval_record = result.scalar_one()
            eval_record.status = "failed"
            eval_record.error_message = str(e)
            await db.commit()
```

**Step 3: Update main.py lifespan to manage executor**

```python
from app.services.eval_service import init_executor, shutdown_executor


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    os.makedirs(settings.audio_storage_path, exist_ok=True)
    init_executor()
    yield
    shutdown_executor()
```

**Step 4: Verify worker imports**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && python -c "from app.workers.eval_worker import run_evaluation; print('Worker OK')"`
Expected: `Worker OK`

**Step 5: Commit**

```bash
git add packages/arena-api/app/workers/ packages/arena-api/app/services/ packages/arena-api/app/main.py
git commit -m "feat(arena-api): add eval worker with ProcessPoolExecutor"
```

---

## Task 9: Evaluations router (submit + retrieve + WebSocket)

**Files:**
- Create: `packages/arena-api/app/routers/evaluations.py`
- Modify: `packages/arena-api/app/main.py` (register router)

**Step 1: Create evaluations router**

```python
# app/routers/evaluations.py
import os
import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models.evaluation import Evaluation
from app.schemas.evaluation import EvaluationResponse

router = APIRouter(prefix="/api/v1/evaluations", tags=["evaluations"])


@router.post("", status_code=201)
async def create_evaluation(
    audio: UploadFile = File(...),
    model_id: str = Form(...),
    scenario_id: str | None = Form(None),
    transcript_ref: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # Save uploaded audio
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    audio_path = os.path.join(settings.audio_storage_path, f"{file_id}{ext}")
    content = await audio.read()
    with open(audio_path, "wb") as f:
        f.write(content)

    # Create evaluation record
    evaluation = Evaluation(
        model_id=model_id,
        scenario_id=scenario_id,
        status="pending",
        audio_path=audio_path,
        transcript_ref=transcript_ref,
    )
    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)

    # Fire and forget the eval job
    from app.services.eval_service import submit_evaluation
    asyncio.create_task(submit_evaluation(evaluation.id, settings.database_url))

    return {"id": evaluation.id, "status": "pending"}


@router.get("", response_model=list[EvaluationResponse])
async def list_evaluations(
    model_id: str | None = None,
    scenario_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Evaluation).order_by(Evaluation.created_at.desc()).limit(limit)
    if model_id:
        stmt = stmt.where(Evaluation.model_id == model_id)
    if scenario_id:
        stmt = stmt.where(Evaluation.scenario_id == scenario_id)
    if status:
        stmt = stmt.where(Evaluation.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{eval_id}", response_model=EvaluationResponse)
async def get_evaluation(eval_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation


@router.websocket("/{eval_id}/stream")
async def eval_stream(websocket: WebSocket, eval_id: str):
    await websocket.accept()
    try:
        # Poll for status changes
        from app.database import async_session

        while True:
            async with async_session() as db:
                result = await db.execute(
                    select(Evaluation).where(Evaluation.id == eval_id)
                )
                evaluation = result.scalar_one_or_none()
                if not evaluation:
                    await websocket.send_json({"error": "Evaluation not found"})
                    break
                await websocket.send_json({
                    "eval_id": eval_id,
                    "status": evaluation.status,
                })
                if evaluation.status in ("completed", "failed"):
                    break
            await asyncio.sleep(1)
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
```

**Step 2: Register in main.py**

```python
from app.routers import models, scenarios, evaluations

app.include_router(evaluations.router)
```

**Step 3: Test manually**

Run: `curl -X POST http://localhost:8000/api/v1/evaluations -F "audio=@/path/to/test.wav" -F "model_id=<model-id-from-task-6>"`
Expected: `{"id": "...", "status": "pending"}`

**Step 4: Commit**

```bash
git add packages/arena-api/app/routers/evaluations.py packages/arena-api/app/main.py
git commit -m "feat(arena-api): add evaluations router with file upload and WebSocket"
```

---

## Task 10: ELO service

**Files:**
- Create: `packages/arena-api/app/services/elo.py`

**Step 1: Create ELO calculation service**

```python
# app/services/elo.py
from app.config import settings


def compute_composite_score(metrics: dict) -> float:
    """Compute weighted composite from eval metrics. Higher is better."""
    semascore = metrics.get("semascore", 0)
    if semascore < 0:
        semascore = 0
    wer = metrics.get("wer_score", 1)
    prosody = metrics.get("overall_prosody_score", 0)
    quality = metrics.get("speech_quality_score", 0)
    latency = metrics.get("average_latency_ms", 1000)
    norm_latency = min(latency / 1000, 1.0)

    return (
        0.30 * semascore
        + 0.25 * (1 - wer)
        + 0.20 * prosody
        + 0.15 * quality
        + 0.10 * (1 - norm_latency)
    )


def determine_auto_winner(
    metrics_a: dict, metrics_b: dict, tie_threshold: float = 0.02
) -> str:
    """Returns 'a', 'b', or 'tie' based on composite scores."""
    score_a = compute_composite_score(metrics_a)
    score_b = compute_composite_score(metrics_b)
    diff = score_a - score_b
    if abs(diff) < tie_threshold:
        return "tie"
    return "a" if diff > 0 else "b"


def update_elo(
    rating_a: float, rating_b: float, outcome: str
) -> tuple[float, float, float]:
    """
    Update ELO ratings.
    outcome: 'a' (A wins), 'b' (B wins), or 'tie'
    Returns: (new_rating_a, new_rating_b, delta)
    """
    k = settings.elo_k_factor
    score_a = 1.0 if outcome == "a" else (0.0 if outcome == "b" else 0.5)

    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    delta = k * (score_a - expected_a)

    return rating_a + delta, rating_b - delta, delta
```

**Step 2: Verify**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && python -c "
from app.services.elo import update_elo, compute_composite_score
a, b, d = update_elo(1500, 1500, 'a')
print(f'A wins: A={a:.1f} B={b:.1f} delta={d:.1f}')
a, b, d = update_elo(1500, 1500, 'tie')
print(f'Tie: A={a:.1f} B={b:.1f} delta={d:.1f}')
"`
Expected: `A wins: A=1516.0 B=1484.0 delta=16.0` and `Tie: A=1500.0 B=1500.0 delta=0.0`

**Step 3: Commit**

```bash
git add packages/arena-api/app/services/elo.py
git commit -m "feat(arena-api): add ELO rating service with composite scoring"
```

---

## Task 11: Battles router (create + vote + auto-resolve)

**Files:**
- Create: `packages/arena-api/app/routers/battles.py`
- Modify: `packages/arena-api/app/main.py` (register router)

**Step 1: Create battles router**

```python
# app/routers/battles.py
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.battle import Battle
from app.models.evaluation import Evaluation
from app.models.voice_model import VoiceModel
from app.schemas.battle import BattleCreate, BattleVote, BattleResponse
from app.services.elo import update_elo, determine_auto_winner

router = APIRouter(prefix="/api/v1/battles", tags=["battles"])


@router.post("", response_model=BattleResponse, status_code=201)
async def create_battle(body: BattleCreate, db: AsyncSession = Depends(get_db)):
    battle = Battle(
        scenario_id=body.scenario_id,
        model_a_id=body.model_a_id,
        model_b_id=body.model_b_id,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)
    return battle


@router.get("", response_model=list[BattleResponse])
async def list_battles(
    scenario_id: str | None = None,
    model_id: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Battle).order_by(Battle.created_at.desc()).limit(limit)
    if scenario_id:
        stmt = stmt.where(Battle.scenario_id == scenario_id)
    if model_id:
        stmt = stmt.where(
            (Battle.model_a_id == model_id) | (Battle.model_b_id == model_id)
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{battle_id}", response_model=BattleResponse)
async def get_battle(battle_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    return battle


@router.post("/{battle_id}/vote", response_model=BattleResponse)
async def vote_battle(
    battle_id: str, body: BattleVote, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.winner is not None:
        raise HTTPException(status_code=400, detail="Battle already resolved")
    if body.winner not in ("a", "b", "tie"):
        raise HTTPException(status_code=400, detail="winner must be 'a', 'b', or 'tie'")

    # Get both models
    model_a = (await db.execute(select(VoiceModel).where(VoiceModel.id == battle.model_a_id))).scalar_one()
    model_b = (await db.execute(select(VoiceModel).where(VoiceModel.id == battle.model_b_id))).scalar_one()

    # Update ELO
    new_a, new_b, delta = update_elo(model_a.elo_rating, model_b.elo_rating, body.winner)
    model_a.elo_rating = new_a
    model_a.total_battles += 1
    model_b.elo_rating = new_b
    model_b.total_battles += 1

    # Update win rates
    if body.winner == "a":
        total_wins_a = round(model_a.win_rate * (model_a.total_battles - 1)) + 1
        model_a.win_rate = total_wins_a / model_a.total_battles
        model_b.win_rate = round(model_b.win_rate * (model_b.total_battles - 1)) / model_b.total_battles
    elif body.winner == "b":
        model_a.win_rate = round(model_a.win_rate * (model_a.total_battles - 1)) / model_a.total_battles
        total_wins_b = round(model_b.win_rate * (model_b.total_battles - 1)) + 1
        model_b.win_rate = total_wins_b / model_b.total_battles

    battle.winner = body.winner
    battle.vote_source = "human"
    battle.elo_delta = delta

    await db.commit()
    await db.refresh(battle)
    return battle
```

**Step 2: Register in main.py**

```python
from app.routers import models, scenarios, evaluations, battles

app.include_router(battles.router)
```

**Step 3: Commit**

```bash
git add packages/arena-api/app/routers/battles.py packages/arena-api/app/main.py
git commit -m "feat(arena-api): add battles router with voting and ELO updates"
```

---

## Task 12: Leaderboard + Analytics routers

**Files:**
- Create: `packages/arena-api/app/routers/leaderboard.py`
- Create: `packages/arena-api/app/routers/analytics.py`
- Modify: `packages/arena-api/app/main.py` (register routers)

**Step 1: Create leaderboard router**

```python
# app/routers/leaderboard.py
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.leaderboard import LeaderboardSnapshot

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard(
    sort_by: str = "elo_rating",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VoiceModel).order_by(VoiceModel.elo_rating.desc())
    )
    models = result.scalars().all()

    entries = []
    for rank, model in enumerate(models, 1):
        # Get average metrics from completed evaluations
        avg_result = await db.execute(
            select(
                func.avg(Evaluation.metrics_json["wer_score"].as_float()).label("avg_wer"),
                func.avg(Evaluation.metrics_json["semascore"].as_float()).label("avg_semascore"),
                func.avg(Evaluation.metrics_json["overall_prosody_score"].as_float()).label("avg_prosody"),
                func.avg(Evaluation.metrics_json["speech_quality_score"].as_float()).label("avg_quality"),
            ).where(
                Evaluation.model_id == model.id,
                Evaluation.status == "completed",
            )
        )
        avgs = avg_result.one()

        entries.append({
            "model_id": model.id,
            "model_name": model.name,
            "provider": model.provider,
            "elo_rating": model.elo_rating,
            "win_rate": model.win_rate,
            "total_battles": model.total_battles,
            "avg_wer": avgs.avg_wer,
            "avg_semascore": avgs.avg_semascore,
            "avg_prosody": avgs.avg_prosody,
            "avg_quality": avgs.avg_quality,
            "rank": rank,
        })

    return entries


@router.get("/history")
async def get_leaderboard_history(
    model_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LeaderboardSnapshot).order_by(LeaderboardSnapshot.snapshot_date.asc())
    if model_id:
        stmt = stmt.where(LeaderboardSnapshot.model_id == model_id)
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    # Join model names
    entries = []
    for s in snapshots:
        model_result = await db.execute(select(VoiceModel.name).where(VoiceModel.id == s.model_id))
        model_name = model_result.scalar_one_or_none() or "Unknown"
        entries.append({
            "model_id": s.model_id,
            "model_name": model_name,
            "elo_rating": s.elo_rating,
            "snapshot_date": s.snapshot_date.isoformat(),
        })

    return entries
```

**Step 2: Create analytics router**

```python
# app/routers/analytics.py
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.battle import Battle
from app.models.scenario import Scenario

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_models = (await db.execute(select(func.count(VoiceModel.id)))).scalar() or 0
    total_evals = (await db.execute(select(func.count(Evaluation.id)))).scalar() or 0
    total_battles = (await db.execute(select(func.count(Battle.id)))).scalar() or 0
    total_scenarios = (await db.execute(select(func.count(Scenario.id)))).scalar() or 0
    completed_evals = (
        await db.execute(
            select(func.count(Evaluation.id)).where(Evaluation.status == "completed")
        )
    ).scalar() or 0

    return {
        "total_models": total_models,
        "total_evaluations": total_evals,
        "completed_evaluations": completed_evals,
        "total_battles": total_battles,
        "total_scenarios": total_scenarios,
    }


@router.get("/correlations")
async def get_correlations(db: AsyncSession = Depends(get_db)):
    # Return metric pairs from completed evaluations for scatter plots
    result = await db.execute(
        select(Evaluation.metrics_json).where(
            Evaluation.status == "completed",
            Evaluation.metrics_json.isnot(None),
        ).limit(500)
    )
    metrics_list = [row[0] for row in result.all()]

    return {
        "count": len(metrics_list),
        "metrics": metrics_list,
    }
```

**Step 3: Register both in main.py**

```python
from app.routers import models, scenarios, evaluations, battles, leaderboard, analytics

app.include_router(leaderboard.router)
app.include_router(analytics.router)
```

**Step 4: Test manually**

Run: `curl http://localhost:8000/api/v1/leaderboard`
Run: `curl http://localhost:8000/api/v1/analytics/summary`

**Step 5: Commit**

```bash
git add packages/arena-api/app/routers/leaderboard.py packages/arena-api/app/routers/analytics.py packages/arena-api/app/main.py
git commit -m "feat(arena-api): add leaderboard and analytics routers"
```

---

## Task 13: Frontend proxy + API client

Wire the Arena frontend to the backend API.

**Files:**
- Modify: `packages/arena/vite.config.ts` (add `/api` proxy)
- Create: `packages/arena/src/api/client.ts`

**Step 1: Add API proxy to arena vite config**

Add to the `server` config in `packages/arena/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/arena/',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**Step 2: Create typed API client**

```typescript
// packages/arena/src/api/client.ts
const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  version: string;
  config_json: Record<string, unknown> | null;
  elo_rating: number;
  total_battles: number;
  win_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: string;
  ground_truth_transcript: string | null;
  created_at: string;
}

export interface EvalResult {
  id: string;
  model_id: string;
  scenario_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  audio_path: string;
  metrics_json: Record<string, unknown> | null;
  diarization_json: Record<string, unknown> | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
}

export interface Battle {
  id: string;
  scenario_id: string;
  model_a_id: string;
  model_b_id: string;
  eval_a_id: string | null;
  eval_b_id: string | null;
  winner: string | null;
  vote_source: string | null;
  elo_delta: number | null;
  created_at: string;
}

export interface LeaderboardEntry {
  model_id: string;
  model_name: string;
  provider: string;
  elo_rating: number;
  win_rate: number;
  total_battles: number;
  avg_wer: number | null;
  avg_semascore: number | null;
  avg_prosody: number | null;
  avg_quality: number | null;
  rank: number;
}

export interface AnalyticsSummary {
  total_models: number;
  total_evaluations: number;
  completed_evaluations: number;
  total_battles: number;
  total_scenarios: number;
}

export const api = {
  models: {
    list: (provider?: string) =>
      request<Model[]>(`/models${provider ? `?provider=${provider}` : ''}`),
    get: (id: string) => request<Model>(`/models/${id}`),
    create: (data: { name: string; provider: string; version?: string }) =>
      request<Model>('/models', { method: 'POST', body: JSON.stringify(data) }),
  },

  scenarios: {
    list: (category?: string) =>
      request<Scenario[]>(`/scenarios${category ? `?category=${category}` : ''}`),
    get: (id: string) => request<Scenario>(`/scenarios/${id}`),
  },

  evaluations: {
    get: (id: string) => request<EvalResult>(`/evaluations/${id}`),
    list: (params?: { model_id?: string; scenario_id?: string; status?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v) as [string, string][]
      ).toString();
      return request<EvalResult[]>(`/evaluations${qs ? `?${qs}` : ''}`);
    },
    submit: async (audio: File, modelId: string, scenarioId?: string) => {
      const form = new FormData();
      form.append('audio', audio);
      form.append('model_id', modelId);
      if (scenarioId) form.append('scenario_id', scenarioId);
      const res = await fetch(`${API_BASE}/evaluations`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },
    stream: (evalId: string) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return new WebSocket(`${protocol}//${window.location.host}${API_BASE}/evaluations/${evalId}/stream`);
    },
  },

  battles: {
    list: (params?: { scenario_id?: string; model_id?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v) as [string, string][]
      ).toString();
      return request<Battle[]>(`/battles${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<Battle>(`/battles/${id}`),
    create: (data: { scenario_id: string; model_a_id: string; model_b_id: string }) =>
      request<Battle>('/battles', { method: 'POST', body: JSON.stringify(data) }),
    vote: (battleId: string, winner: 'a' | 'b' | 'tie') =>
      request<Battle>(`/battles/${battleId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ winner }),
      }),
  },

  leaderboard: {
    current: () => request<LeaderboardEntry[]>('/leaderboard'),
    history: (modelId?: string) =>
      request<{ model_id: string; model_name: string; elo_rating: number; snapshot_date: string }[]>(
        `/leaderboard/history${modelId ? `?model_id=${modelId}` : ''}`
      ),
  },

  analytics: {
    summary: () => request<AnalyticsSummary>('/analytics/summary'),
    correlations: () => request<{ count: number; metrics: Record<string, unknown>[] }>('/analytics/correlations'),
  },
};

// Health check — returns true if backend is reachable
export async function isBackendAvailable(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/health`);
    return true;
  } catch {
    return false;
  }
}
```

**Step 3: Commit**

```bash
git add packages/arena/vite.config.ts packages/arena/src/api/client.ts
git commit -m "feat(arena): add API proxy config and typed API client"
```

---

## Task 14: Seed data script

Create a script that populates the database with initial models and scenarios for testing.

**Files:**
- Create: `packages/arena-api/scripts/seed.py`

**Step 1: Create seed script**

```python
# packages/arena-api/scripts/seed.py
"""Seed the database with initial models and scenarios."""
import asyncio
from app.database import engine, async_session
from app.models import Base, VoiceModel, Scenario


MODELS = [
    {"name": "GPT-4o Realtime", "provider": "openai", "version": "v1"},
    {"name": "Gemini 2.0 Flash Live", "provider": "google", "version": "v1"},
    {"name": "Claude Sonnet Voice", "provider": "anthropic", "version": "v1"},
    {"name": "ElevenLabs Conversational", "provider": "elevenlabs", "version": "v2"},
    {"name": "Hume EVI 2", "provider": "hume", "version": "v2"},
    {"name": "Bland AI", "provider": "bland", "version": "v1"},
    {"name": "Vapi Agent", "provider": "vapi", "version": "v1"},
    {"name": "Retell AI", "provider": "retell", "version": "v2"},
]

SCENARIOS = [
    {"name": "Angry customer refund request", "category": "customer_service", "difficulty": "hard"},
    {"name": "Technical support troubleshooting", "category": "support", "difficulty": "medium"},
    {"name": "Appointment scheduling", "category": "scheduling", "difficulty": "easy"},
    {"name": "Sales qualification call", "category": "sales", "difficulty": "medium"},
    {"name": "Complaint escalation", "category": "customer_service", "difficulty": "hard"},
    {"name": "FAQ and general inquiry", "category": "support", "difficulty": "easy"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        for m in MODELS:
            db.add(VoiceModel(**m))
        for s in SCENARIOS:
            db.add(Scenario(**s))
        await db.commit()
        print(f"Seeded {len(MODELS)} models and {len(SCENARIOS)} scenarios.")


if __name__ == "__main__":
    asyncio.run(seed())
```

**Step 2: Run seed**

Run: `cd /Users/sidgraph/VoiceLoop/packages/arena-api && python -m scripts.seed`
Expected: `Seeded 8 models and 6 scenarios.`

**Step 3: Verify via API**

Run: `curl http://localhost:8000/api/v1/models | python -m json.tool | head -20`
Expected: List of 8 models with ELO 1500.

**Step 4: Commit**

```bash
git add packages/arena-api/scripts/
git commit -m "feat(arena-api): add database seed script with initial models and scenarios"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Make voice_evals installable | None |
| 2 | Scaffold arena-api package | Task 1 |
| 3 | SQLAlchemy ORM models | Task 2 |
| 4 | Alembic migrations | Task 3 |
| 5 | Pydantic schemas | Task 2 |
| 6 | Models router | Tasks 3, 4, 5 |
| 7 | Scenarios router | Tasks 3, 4, 5 |
| 8 | Eval worker | Tasks 1, 2, 3 |
| 9 | Evaluations router | Tasks 5, 8 |
| 10 | ELO service | Task 2 |
| 11 | Battles router | Tasks 6, 7, 10 |
| 12 | Leaderboard + Analytics routers | Tasks 3, 5 |
| 13 | Frontend proxy + API client | Task 2 |
| 14 | Seed data | Tasks 3, 4 |

**Parallelizable groups:**
- Tasks 3 + 5 can run in parallel (models and schemas are independent)
- Tasks 6 + 7 can run in parallel (independent routers)
- Tasks 8 + 10 can run in parallel (worker and ELO are independent)
- Tasks 12 + 13 can run in parallel
