# STT (Speech-to-Text) Battle Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add STT battle mode — users provide audio (record or pick a curated clip), 4 STT models transcribe it in parallel, user reads transcripts and votes on the most accurate, then sees diff + WER metrics.

**Architecture:** Two-step flow mirroring S2S. Step 1: `POST /battles/generate` selects STT models. Step 2: `POST /battles/{id}/input-audio` uploads user audio, fans out to 4 providers (OpenAI Whisper, Deepgram Nova-2, AssemblyAI, Google Cloud STT) via REST APIs, returns transcripts. Frontend has a separate `STTBattlePage` with state machine (idle → loading → listening → voting → revealed). Post-vote reveals diff highlighting and WER/CER when ground truth is available.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL, React 19, TypeScript, Tailwind CSS 4, Framer Motion, httpx (REST API calls)

**Design doc:** `docs/plans/2026-02-21-stt-battle-mode-design.md`

---

## Context

S2S battle mode is complete on the `feat/multi-mode-battles` branch. The `battle_type`, `model_type`, `sub_votes`, `input_audio_path`, and `transcript_output` columns exist. The ModeSelector component has STT disabled. The battles router rejects STT with a 501 (line 39-40 of `packages/arena-api/app/routers/battles.py`). This plan implements the actual STT battle functionality.

---

## Task 1: Add STT Provider API Keys to Settings

**Files:**
- Modify: `packages/arena-api/app/config.py:5-24`

Add API keys for Deepgram (already exists), AssemblyAI, and Google Cloud STT to the `Settings` class. OpenAI key already exists. Deepgram key already exists but is used for TTS — we reuse it for STT too.

Add after line 13 (`hume_api_key`):

```python
assemblyai_api_key: str = ""
google_cloud_api_key: str = ""
stt_timeout_seconds: int = 30
```

**Commit:** `feat: add AssemblyAI and Google Cloud API keys to settings`

---

## Task 2: Create STT Service — Provider Integration

**Files:**
- Create: `packages/arena-api/app/services/stt_service.py`

Create an async STT service following the structural pattern of `s2s_service.py` (async functions, latency tracking, error handling). Key difference: all providers use REST APIs (no WebSockets), making this simpler.

**Public entry point:**
```python
async def transcribe_with_provider(
    audio_path: str,
    provider: str,
    model_id: str,
    config: dict,
) -> dict:
    """Returns: transcript, word_count, ttfb_ms, e2e_latency_ms"""
```

**Provider functions:**

```python
"""STT service supporting multiple providers (OpenAI Whisper, Deepgram, AssemblyAI, Google Cloud)."""
import logging
import os
import time

import httpx

from app.config import settings

logger = logging.getLogger("arena.stt_service")


class STTProviderError(Exception):
    """Raised when an STT provider fails."""
    pass


async def transcribe_with_provider(
    audio_path: str,
    provider: str,
    model_id: str,
    config: dict,
) -> dict:
    """Transcribe audio using the specified STT provider.

    Returns:
        dict with: transcript, word_count, ttfb_ms, e2e_latency_ms
    """
    try:
        if provider == "openai":
            return await _transcribe_openai(audio_path, model_id, config)
        elif provider == "deepgram":
            return await _transcribe_deepgram(audio_path, model_id, config)
        elif provider == "assemblyai":
            return await _transcribe_assemblyai(audio_path, model_id, config)
        elif provider == "google":
            return await _transcribe_google(audio_path, model_id, config)
        else:
            raise STTProviderError(f"Unknown STT provider: {provider}")
    except STTProviderError:
        raise
    except Exception as e:
        raise STTProviderError(f"{provider} transcription failed: {e}") from e


async def _transcribe_openai(audio_path: str, model_id: str, config: dict) -> dict:
    """OpenAI Whisper API — POST multipart to /v1/audio/transcriptions."""
    start = time.perf_counter()
    ttfb_ms = 0.0

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f, "audio/webm")}
            data = {"model": model_id or "whisper-1"}
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files=files,
                data=data,
            )
        ttfb_ms = (time.perf_counter() - start) * 1000

    if resp.status_code != 200:
        raise STTProviderError(f"OpenAI Whisper error {resp.status_code}: {resp.text}")

    transcript = resp.json().get("text", "")
    e2e_ms = (time.perf_counter() - start) * 1000

    return {
        "transcript": transcript,
        "word_count": len(transcript.split()),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_ms, 1),
    }


async def _transcribe_deepgram(audio_path: str, model_id: str, config: dict) -> dict:
    """Deepgram Nova-2 — POST binary audio to /v1/listen."""
    start = time.perf_counter()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    # Determine content type from extension
    ext = os.path.splitext(audio_path)[1].lower()
    content_types = {".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg"}
    content_type = content_types.get(ext, "audio/webm")

    params = {"model": model_id or "nova-2", "smart_format": "true"}

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": content_type,
            },
            params=params,
            content=audio_data,
        )
    ttfb_ms = (time.perf_counter() - start) * 1000

    if resp.status_code != 200:
        raise STTProviderError(f"Deepgram error {resp.status_code}: {resp.text}")

    result = resp.json()
    transcript = ""
    try:
        transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError):
        pass

    e2e_ms = (time.perf_counter() - start) * 1000

    return {
        "transcript": transcript,
        "word_count": len(transcript.split()),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_ms, 1),
    }


async def _transcribe_assemblyai(audio_path: str, model_id: str, config: dict) -> dict:
    """AssemblyAI — upload audio, create transcript, poll until complete."""
    import asyncio
    start = time.perf_counter()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    headers = {"Authorization": settings.assemblyai_api_key}

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        # Step 1: Upload audio
        upload_resp = await client.post(
            "https://api.assemblyai.com/v2/upload",
            headers={**headers, "Content-Type": "application/octet-stream"},
            content=audio_data,
        )
        if upload_resp.status_code != 200:
            raise STTProviderError(f"AssemblyAI upload error {upload_resp.status_code}: {upload_resp.text}")
        upload_url = upload_resp.json()["upload_url"]

        ttfb_ms = (time.perf_counter() - start) * 1000

        # Step 2: Create transcript request
        transcript_resp = await client.post(
            "https://api.assemblyai.com/v2/transcript",
            headers=headers,
            json={"audio_url": upload_url},
        )
        if transcript_resp.status_code != 200:
            raise STTProviderError(f"AssemblyAI transcript error {transcript_resp.status_code}")
        transcript_id = transcript_resp.json()["id"]

        # Step 3: Poll until complete
        poll_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
        for _ in range(60):  # max 60 polls at 0.5s = 30s
            poll_resp = await client.get(poll_url, headers=headers)
            data = poll_resp.json()
            status = data.get("status")
            if status == "completed":
                transcript = data.get("text", "")
                e2e_ms = (time.perf_counter() - start) * 1000
                return {
                    "transcript": transcript,
                    "word_count": len(transcript.split()),
                    "ttfb_ms": round(ttfb_ms, 1),
                    "e2e_latency_ms": round(e2e_ms, 1),
                }
            elif status == "error":
                raise STTProviderError(f"AssemblyAI error: {data.get('error', 'unknown')}")
            await asyncio.sleep(0.5)

    raise STTProviderError("AssemblyAI transcription timed out")


async def _transcribe_google(audio_path: str, model_id: str, config: dict) -> dict:
    """Google Cloud STT v2 — REST API (no client library needed)."""
    start = time.perf_counter()
    import base64

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    ext = os.path.splitext(audio_path)[1].lower()
    encoding_map = {".webm": "WEBM_OPUS", ".wav": "LINEAR16", ".mp3": "MP3"}
    encoding = encoding_map.get(ext, "WEBM_OPUS")

    body = {
        "config": {
            "encoding": encoding,
            "languageCode": "en-US",
            "model": model_id or "latest_long",
            "enableAutomaticPunctuation": True,
        },
        "audio": {"content": base64.b64encode(audio_data).decode()},
    }

    async with httpx.AsyncClient(timeout=settings.stt_timeout_seconds) as client:
        resp = await client.post(
            f"https://speech.googleapis.com/v1/speech:recognize?key={settings.google_cloud_api_key}",
            json=body,
        )
    ttfb_ms = (time.perf_counter() - start) * 1000

    if resp.status_code != 200:
        raise STTProviderError(f"Google STT error {resp.status_code}: {resp.text}")

    result = resp.json()
    transcript = ""
    try:
        for r in result.get("results", []):
            transcript += r["alternatives"][0]["transcript"] + " "
        transcript = transcript.strip()
    except (KeyError, IndexError):
        pass

    e2e_ms = (time.perf_counter() - start) * 1000

    return {
        "transcript": transcript,
        "word_count": len(transcript.split()),
        "ttfb_ms": round(ttfb_ms, 1),
        "e2e_latency_ms": round(e2e_ms, 1),
    }
```

**Commit:** `feat: STT service with OpenAI Whisper, Deepgram, AssemblyAI, Google providers`

---

## Task 3: Create STT Metrics Service — WER, CER, Word Diff

**Files:**
- Create: `packages/arena-api/app/services/stt_metrics.py`

Pure Python implementation of WER, CER, and word-level diff. No external dependencies needed — uses dynamic programming.

```python
"""STT metrics: WER, CER, and word-level diff computation."""


def compute_wer(reference: str, hypothesis: str) -> float:
    """Compute Word Error Rate using Levenshtein distance at word level.

    WER = (Substitutions + Deletions + Insertions) / Reference_Length
    Returns 0.0 for perfect match, >1.0 is possible if hypothesis is much longer.
    """
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()

    if not ref_words:
        return 0.0 if not hyp_words else 1.0

    # DP matrix
    n = len(ref_words)
    m = len(hyp_words)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # deletion
                    dp[i][j - 1],      # insertion
                    dp[i - 1][j - 1],  # substitution
                )

    return dp[n][m] / n


def compute_cer(reference: str, hypothesis: str) -> float:
    """Compute Character Error Rate using Levenshtein distance at character level."""
    ref_chars = list(reference.lower())
    hyp_chars = list(hypothesis.lower())

    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0

    n = len(ref_chars)
    m = len(hyp_chars)

    # Use two rows to save memory
    prev = list(range(m + 1))
    curr = [0] * (m + 1)

    for i in range(1, n + 1):
        curr[0] = i
        for j in range(1, m + 1):
            if ref_chars[i - 1] == hyp_chars[j - 1]:
                curr[j] = prev[j - 1]
            else:
                curr[j] = 1 + min(prev[j], curr[j - 1], prev[j - 1])
        prev, curr = curr, [0] * (m + 1)

    return prev[m] / n


def compute_word_diff(reference: str, hypothesis: str) -> list[dict]:
    """Compute word-level alignment diff between reference and hypothesis.

    Returns list of diff operations:
      - {"word": "hello", "type": "correct"}
      - {"word": "world", "ref_word": "word", "type": "substitution"}
      - {"word": "extra", "type": "insertion"}
      - {"ref_word": "missing", "type": "deletion"}
    """
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()

    n = len(ref_words)
    m = len(hyp_words)

    # Build DP table with backtracking
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    ops = [[""] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
        if i > 0:
            ops[i][0] = "delete"
    for j in range(m + 1):
        dp[0][j] = j
        if j > 0:
            ops[0][j] = "insert"

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
                ops[i][j] = "match"
            else:
                costs = [
                    (dp[i - 1][j - 1] + 1, "substitute"),
                    (dp[i - 1][j] + 1, "delete"),
                    (dp[i][j - 1] + 1, "insert"),
                ]
                dp[i][j], ops[i][j] = min(costs, key=lambda x: x[0])

    # Backtrace to build diff
    diff = []
    i, j = n, m
    while i > 0 or j > 0:
        op = ops[i][j]
        if op == "match":
            diff.append({"word": hyp_words[j - 1], "type": "correct"})
            i -= 1
            j -= 1
        elif op == "substitute":
            diff.append({"word": hyp_words[j - 1], "ref_word": ref_words[i - 1], "type": "substitution"})
            i -= 1
            j -= 1
        elif op == "delete":
            diff.append({"ref_word": ref_words[i - 1], "type": "deletion"})
            i -= 1
        elif op == "insert":
            diff.append({"word": hyp_words[j - 1], "type": "insertion"})
            j -= 1
        else:
            break

    diff.reverse()
    return diff
```

**Commit:** `feat: STT metrics service with WER, CER, and word diff`

---

## Task 4: Create STT Pydantic Schemas

**Files:**
- Create: `packages/arena-api/app/schemas/stt.py`

```python
"""Pydantic schemas for the STT battle flow."""
from pydantic import BaseModel


class AudioClipItem(BaseModel):
    id: str
    text: str
    category: str
    difficulty: str
    audio_url: str
    duration_seconds: float | None = None


class STTBattleSetupResponse(BaseModel):
    """Step 1 response: battle created, models selected, no transcripts yet."""
    id: str
    battle_type: str = "stt"
    model_count: int
    curated_clips: list[AudioClipItem] | None = None


class STTTranscriptItem(BaseModel):
    """One model's transcription result."""
    model_id: str
    transcript: str
    word_count: int
    e2e_latency_ms: float
    ttfb_ms: float


class STTBattleResponse(BaseModel):
    """Step 2 response: after input audio transcribed by all models."""
    id: str
    battle_type: str = "stt"
    input_audio_url: str
    ground_truth: str | None = None
    transcripts: list[STTTranscriptItem]


class STTDiffItem(BaseModel):
    word: str | None = None
    ref_word: str | None = None
    type: str  # "correct" | "insertion" | "deletion" | "substitution"


class STTModelMetrics(BaseModel):
    transcript: str
    wer: float | None = None
    cer: float | None = None
    diff: list[STTDiffItem] | None = None
    e2e_latency_ms: float
    ttfb_ms: float
    word_count: int


class STTMetricsResponse(BaseModel):
    """Post-vote metrics with diff highlighting."""
    status: str  # "computing" | "complete"
    model_names: dict[str, str] | None = None
    providers: dict[str, str] | None = None
    ground_truth: str | None = None
    metrics: dict[str, STTModelMetrics] | None = None
```

**Commit:** `feat: STT battle Pydantic schemas`

---

## Task 5: Database Migration — Create audio_clips Table

**Files:**
- Create: `packages/arena-api/alembic/versions/g7h8i9j0k1l2_add_audio_clips_table.py`
- Create: `packages/arena-api/app/models/audio_clip.py`
- Modify: `packages/arena-api/app/models/__init__.py:1-13`

**Migration** (revises `f6a7b8c9d0e1`, current head):

```python
"""Add audio_clips table for STT curated library.

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audio_clips",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="medium"),
        sa.Column("ground_truth", sa.Text(), nullable=False),
        sa.Column("audio_path", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audio_clips")
```

**ORM Model** (`audio_clip.py`):

```python
from sqlalchemy import String, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, generate_uuid
import datetime


class AudioClip(Base):
    __tablename__ = "audio_clips"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    ground_truth: Mapped[str] = mapped_column(Text, nullable=False)
    audio_path: Mapped[str] = mapped_column(Text, nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
```

**Update `__init__.py`** — add `AudioClip` to imports and `__all__`:

Add import: `from app.models.audio_clip import AudioClip`
Add to `__all__`: `"AudioClip"`

**Commit:** `feat: audio_clips table and ORM model for STT curated library`

---

## Task 6: Extend Battle Generation for STT (Step 1)

**Files:**
- Modify: `packages/arena-api/app/routers/battles.py:16,25,39-44`

**Changes:**

1. Add STT schema import (line 16):
```python
from app.schemas.stt import AudioClipItem, STTBattleSetupResponse, STTBattleResponse, STTTranscriptItem, STTMetricsResponse, STTModelMetrics, STTDiffItem
```

2. Add STT providers constant (after line 25):
```python
STT_PROVIDERS = ["openai", "deepgram", "assemblyai", "google"]
```

3. Update the 501 rejection (line 39-40) to only reject `agent`:
```python
    if battle_type not in ("tts", "s2s", "stt"):
        raise HTTPException(status_code=501, detail=f"{battle_type} battles are not yet implemented")
```

4. Add STT routing (after line 44, before the TTS code):
```python
    # --- STT: Step 1 — select models, return setup response ---
    if battle_type == "stt":
        return await _generate_stt_battle(db)
```

5. Add the `_generate_stt_battle` helper function (before the S2S helpers section at line 331):

```python
# ---------------------------------------------------------------------------
# STT helpers and endpoints
# ---------------------------------------------------------------------------

async def _generate_stt_battle(db: AsyncSession) -> STTBattleSetupResponse:
    """Step 1: Select STT models, create battle, return setup response."""
    from app.models.audio_clip import AudioClip

    # Query STT models
    all_models_result = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.config_json.isnot(None))
        .where(VoiceModel.model_type == "stt")
    )
    all_models = all_models_result.scalars().all()

    # Group by provider, pick one random model per provider
    by_provider: dict[str, list] = {}
    for m in all_models:
        by_provider.setdefault(m.provider, []).append(m)

    selected = []
    for provider in STT_PROVIDERS:
        models = by_provider.get(provider, [])
        if models:
            selected.append(random.choice(models))

    if len(selected) < 2:
        raise HTTPException(status_code=500, detail="Need STT models from at least 2 providers. Run seed.py first.")

    # Shuffle so position doesn't reveal provider
    random.shuffle(selected)
    # Take up to 4 models
    selected = selected[:4]

    # Create Battle record (no evals yet — they come in step 2)
    from app.models.scenario import Scenario
    scenario_result = await db.execute(select(Scenario.id).limit(1))
    scenario_id = scenario_result.scalar_one_or_none()
    if not scenario_id:
        raise HTTPException(status_code=500, detail="No scenarios in database. Run seed.py first.")

    battle = Battle(
        scenario_id=scenario_id,
        battle_type="stt",
        model_a_id=selected[0].id,
        model_b_id=selected[1].id,
        model_c_id=selected[2].id if len(selected) > 2 else None,
        model_d_id=selected[3].id if len(selected) > 3 else None,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)

    # Fetch curated audio clips
    clips_result = await db.execute(select(AudioClip))
    clips = clips_result.scalars().all()
    curated_items = [
        AudioClipItem(
            id=c.id,
            text=c.ground_truth,
            category=c.category,
            difficulty=c.difficulty,
            audio_url=f"/api/v1/audio/{c.audio_path.split('/')[-1]}" if c.audio_path else "",
            duration_seconds=c.duration_seconds,
        )
        for c in clips
    ] if clips else None

    return STTBattleSetupResponse(
        id=battle.id,
        battle_type="stt",
        model_count=len(selected),
        curated_clips=curated_items,
    )
```

**Note:** The `response_model=BattleGenerateResponse` on the `/generate` endpoint will need to be loosened. Change line 30 to accept a union or remove response_model validation (since we already return the correct Pydantic model). The simplest approach: remove `response_model` from the decorator and let FastAPI serialize whatever Pydantic model is returned:

```python
@router.post("/generate")
```

**Commit:** `feat: STT battle generation endpoint (step 1 — model selection)`

---

## Task 7: Create STT Input-Audio Upload Endpoint (Step 2)

**Files:**
- Modify: `packages/arena-api/app/routers/battles.py` (add new endpoint after STT helpers)

Add new endpoint that reuses the existing `/input-audio` endpoint pattern but handles STT differently:

```python
@router.post("/{battle_id}/stt-transcribe", response_model=STTBattleResponse)
async def submit_stt_input_audio(
    battle_id: str,
    audio: UploadFile | None = File(None),
    curated_clip_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Submit input audio for an STT battle, fan out to providers."""
    from app.services.stt_service import transcribe_with_provider, STTProviderError
    from app.models.audio_clip import AudioClip
    import os
    import uuid as _uuid

    # 1. Load battle
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.battle_type != "stt":
        raise HTTPException(status_code=400, detail="Battle is not STT type")
    if battle.input_audio_path is not None:
        raise HTTPException(status_code=400, detail="Input audio already submitted")

    # 2. Determine input source and ground truth
    ground_truth = None
    if audio:
        os.makedirs(settings.audio_storage_path, exist_ok=True)
        input_filename = f"{_uuid.uuid4()}.webm"
        input_path = os.path.join(settings.audio_storage_path, input_filename)
        content = await audio.read()
        with open(input_path, "wb") as f:
            f.write(content)
    elif curated_clip_id:
        clip_result = await db.execute(
            select(AudioClip).where(AudioClip.id == curated_clip_id)
        )
        clip = clip_result.scalar_one_or_none()
        if not clip or not clip.audio_path:
            raise HTTPException(status_code=404, detail="Curated clip not found")
        input_path = clip.audio_path
        input_filename = input_path.split("/")[-1]
        ground_truth = clip.ground_truth
    else:
        raise HTTPException(status_code=400, detail="Must provide either audio file or curated_clip_id")

    # Store input audio path
    battle.input_audio_path = input_path
    await db.flush()

    # 3. Load selected models
    model_ids = [battle.model_a_id, battle.model_b_id]
    if battle.model_c_id:
        model_ids.append(battle.model_c_id)
    if battle.model_d_id:
        model_ids.append(battle.model_d_id)

    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}
    models_ordered = [models_map[mid] for mid in model_ids]

    # 4. Fan out to all STT providers in parallel
    stt_tasks = [
        transcribe_with_provider(
            input_path,
            model.provider,
            model.config_json.get("model_id", model.name),
            model.config_json or {},
        )
        for model in models_ordered
    ]
    all_results = await asyncio.gather(*stt_tasks, return_exceptions=True)

    # 5. Filter out failed models (need >= 2 successful)
    ok_models = []
    ok_results = []
    for model, res in zip(models_ordered, all_results):
        if isinstance(res, Exception):
            logger.error("STT failed for %s/%s: %s", model.provider, model.name, res)
            continue
        ok_models.append(model)
        ok_results.append(res)

    if len(ok_models) < 2:
        raise HTTPException(status_code=500, detail="STT transcription failed for too many providers")

    # 6. Create Evaluation records with transcript
    evals = []
    for i, model in enumerate(ok_models):
        ev = Evaluation(
            model_id=model.id,
            status="completed",  # STT evals are instant
            audio_path=input_path,
            transcript_output=ok_results[i]["transcript"],
            transcript_ref=ground_truth,
        )
        db.add(ev)
        evals.append(ev)
    await db.flush()

    # 7. Update Battle with eval IDs and potentially reduced model set
    battle.model_a_id = ok_models[0].id
    battle.model_b_id = ok_models[1].id
    battle.model_c_id = ok_models[2].id if len(ok_models) > 2 else None
    battle.model_d_id = ok_models[3].id if len(ok_models) > 3 else None
    battle.eval_a_id = evals[0].id
    battle.eval_b_id = evals[1].id
    battle.eval_c_id = evals[2].id if len(evals) > 2 else None
    battle.eval_d_id = evals[3].id if len(evals) > 3 else None

    await db.commit()
    await db.refresh(battle)

    # 8. Build response with transcript items
    transcripts = []
    labels = ["a", "b", "c", "d"]
    for i, (model, result_data) in enumerate(zip(ok_models, ok_results)):
        transcripts.append(STTTranscriptItem(
            model_id=labels[i],
            transcript=result_data["transcript"],
            word_count=result_data["word_count"],
            e2e_latency_ms=result_data["e2e_latency_ms"],
            ttfb_ms=result_data["ttfb_ms"],
        ))

    return STTBattleResponse(
        id=battle.id,
        battle_type="stt",
        input_audio_url=f"/api/v1/audio/{input_filename}",
        ground_truth=None,  # Don't reveal ground truth before voting
        transcripts=transcripts,
    )
```

**Commit:** `feat: STT input-audio upload endpoint with provider fanout`

---

## Task 8: Create STT Post-Vote Metrics Endpoint

**Files:**
- Modify: `packages/arena-api/app/routers/battles.py` (add new endpoint after STT transcribe)

```python
@router.get("/{battle_id}/stt-metrics", response_model=STTMetricsResponse)
async def get_stt_metrics(battle_id: str, db: AsyncSession = Depends(get_db)):
    """Post-vote metrics for STT battles with diff highlighting and WER/CER."""
    from app.services.stt_metrics import compute_wer, compute_cer, compute_word_diff
    from app.models.audio_clip import AudioClip

    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.battle_type != "stt":
        raise HTTPException(status_code=400, detail="Battle is not STT type")
    if battle.winner is None:
        raise HTTPException(status_code=400, detail="Battle has not been voted on yet")

    # Load evaluations
    eval_ids = [battle.eval_a_id, battle.eval_b_id, battle.eval_c_id, battle.eval_d_id]
    eval_ids = [eid for eid in eval_ids if eid]
    evals_result = await db.execute(
        select(Evaluation).where(Evaluation.id.in_(eval_ids))
    )
    evals_map = {e.id: e for e in evals_result.scalars().all()}

    # Load model names
    model_ids = [battle.model_a_id, battle.model_b_id, battle.model_c_id, battle.model_d_id]
    model_ids = [mid for mid in model_ids if mid]
    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}

    # Determine ground truth
    ground_truth = None
    if battle.input_audio_path:
        # Check if this was a curated clip
        clip_result = await db.execute(
            select(AudioClip).where(AudioClip.audio_path == battle.input_audio_path)
        )
        clip = clip_result.scalar_one_or_none()
        if clip:
            ground_truth = clip.ground_truth

    # Build metrics
    labels = ["a", "b", "c", "d"]
    eval_id_map = {"a": battle.eval_a_id, "b": battle.eval_b_id, "c": battle.eval_c_id, "d": battle.eval_d_id}
    model_id_map = {"a": battle.model_a_id, "b": battle.model_b_id, "c": battle.model_c_id, "d": battle.model_d_id}

    active_labels = [l for l in labels if model_id_map.get(l)]

    model_names = {}
    providers = {}
    metrics = {}

    for label in active_labels:
        mid = model_id_map.get(label)
        if mid and mid in models_map:
            model_names[label] = models_map[mid].name
            providers[label] = models_map[mid].provider

        eid = eval_id_map.get(label)
        if eid and eid in evals_map:
            ev = evals_map[eid]
            transcript = ev.transcript_output or ""

            m = STTModelMetrics(
                transcript=transcript,
                e2e_latency_ms=0,  # Stored in results, not in eval
                ttfb_ms=0,
                word_count=len(transcript.split()),
            )

            if ground_truth:
                m.wer = round(compute_wer(ground_truth, transcript), 4)
                m.cer = round(compute_cer(ground_truth, transcript), 4)
                diff_data = compute_word_diff(ground_truth, transcript)
                m.diff = [STTDiffItem(**d) for d in diff_data]

            metrics[label] = m

    return STTMetricsResponse(
        status="complete",
        model_names=model_names or None,
        providers=providers or None,
        ground_truth=ground_truth,
        metrics=metrics or None,
    )
```

**Commit:** `feat: STT post-vote metrics endpoint with WER/CER and diff`

---

## Task 9: Seed STT Models and Curated Audio Clips

**Files:**
- Modify: `packages/arena-api/scripts/seed.py:5,427-460,612-655`

**Changes:**

1. Add AudioClip import (line 5):
```python
from app.models import Base, VoiceModel, Scenario, Prompt
```
becomes:
```python
from app.models import Base, VoiceModel, Scenario, Prompt, AudioClip
```

2. Add STT models to the MODELS list (after the Hume EVI 2 entry, before line 461 closing bracket):

```python
    # --- STT Models ---
    {
        "name": "Whisper Large V3",
        "provider": "openai",
        "version": "whisper-1",
        "model_type": "stt",
        "config_json": {
            "model_id": "whisper-1",
            "description": "OpenAI Whisper large-v3 speech recognition",
        },
    },
    {
        "name": "Deepgram Nova-2",
        "provider": "deepgram",
        "version": "nova-2",
        "model_type": "stt",
        "config_json": {
            "model_id": "nova-2",
            "description": "Deepgram Nova-2 high-accuracy speech recognition",
        },
    },
    {
        "name": "AssemblyAI Universal",
        "provider": "assemblyai",
        "version": "universal",
        "model_type": "stt",
        "config_json": {
            "model_id": "best",
            "description": "AssemblyAI Universal speech-to-text model",
        },
    },
    {
        "name": "Google Cloud STT",
        "provider": "google",
        "version": "latest_long",
        "model_type": "stt",
        "config_json": {
            "model_id": "latest_long",
            "description": "Google Cloud Speech-to-Text v1",
        },
    },
```

3. Add STT_CLIPS list (after the S2S_PROMPTS list, before the `async def seed()` function):

```python
# Curated audio clips for STT battles (ground truth = source text for TTS generation)
STT_CLIPS = [
    {
        "ground_truth": "Thank you for calling customer support. My name is Sarah and I'll be happy to help you today. Could you please provide me with your account number?",
        "category": "clean_speech",
        "difficulty": "easy",
        "audio_path": "./uploads/clips/clean_support_greeting.wav",
        "duration_seconds": 8.5,
        "tags": {"gender": "female", "accent": "american"},
    },
    {
        "ground_truth": "I'm sorry to hear that your package arrived damaged. Let me file a replacement order for you right away. The new item should arrive within three to five business days.",
        "category": "clean_speech",
        "difficulty": "easy",
        "audio_path": "./uploads/clips/clean_replacement_order.wav",
        "duration_seconds": 9.0,
        "tags": {"gender": "male", "accent": "american"},
    },
    {
        "ground_truth": "Your total comes to forty seven dollars and ninety three cents. That includes tax. Would you like to pay with the Visa ending in four two one eight or use a different method?",
        "category": "numbers_entities",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/numbers_payment.wav",
        "duration_seconds": 9.5,
        "tags": {"type": "financial"},
    },
    {
        "ground_truth": "The prescription for amoxicillin five hundred milligrams should be taken three times daily for ten days. Please contact Doctor Patel at extension seven four two if symptoms persist.",
        "category": "domain_jargon",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/medical_prescription.wav",
        "duration_seconds": 10.0,
        "tags": {"domain": "medical"},
    },
    {
        "ground_truth": "Please navigate to one twenty three Main Street, Suite four hundred B, Springfield, Illinois, six two seven zero four. The building is on the corner of Main and Fifth Avenue.",
        "category": "numbers_entities",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/numbers_address.wav",
        "duration_seconds": 10.5,
        "tags": {"type": "address"},
    },
    {
        "ground_truth": "So basically what happened was like I went to the store right and they told me that my warranty had expired which is totally ridiculous because I just bought it like three months ago.",
        "category": "fast_speech",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/fast_warranty_complaint.wav",
        "duration_seconds": 8.0,
        "tags": {"style": "conversational"},
    },
    {
        "ground_truth": "The API endpoint at slash v two slash users requires an OAuth two bearer token in the authorization header. Make sure to include the content type application slash JSON.",
        "category": "domain_jargon",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/technical_api.wav",
        "duration_seconds": 9.5,
        "tags": {"domain": "technology"},
    },
    {
        "ground_truth": "Good morning! I'd like to check in for my flight to New York. My confirmation code is bravo romeo seven four kilo papa. The flight departs at two fifteen PM.",
        "category": "clean_speech",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/clean_flight_checkin.wav",
        "duration_seconds": 9.0,
        "tags": {"type": "travel"},
    },
    {
        "ground_truth": "We need to schedule a follow-up appointment. I have availability next Tuesday at ten thirty AM or Wednesday at two PM. Which works better for you?",
        "category": "clean_speech",
        "difficulty": "easy",
        "audio_path": "./uploads/clips/clean_appointment.wav",
        "duration_seconds": 7.5,
        "tags": {"type": "scheduling"},
    },
    {
        "ground_truth": "The quarterly revenue report shows a twelve point five percent increase year over year. Net income was fourteen point three million dollars compared to eleven point eight million in the prior quarter.",
        "category": "numbers_entities",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/numbers_financial.wav",
        "duration_seconds": 11.0,
        "tags": {"domain": "finance"},
    },
    {
        "ground_truth": "Hi yes I was wondering if you could help me I purchased a laptop last week the model number is XPS fifteen ninety five twenty and the screen has some dead pixels.",
        "category": "fast_speech",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/fast_laptop_issue.wav",
        "duration_seconds": 8.5,
        "tags": {"style": "conversational"},
    },
    {
        "ground_truth": "For this recipe you'll need two cups of all-purpose flour, one and a half teaspoons of baking powder, half a teaspoon of salt, and three quarters cup of unsalted butter.",
        "category": "numbers_entities",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/numbers_recipe.wav",
        "duration_seconds": 9.0,
        "tags": {"type": "cooking"},
    },
]
```

4. Add audio clip seeding to the `seed()` function (after the S2S prompts section, before `await db.commit()`):

```python
        clips_added = 0
        for c in STT_CLIPS:
            existing = await db.execute(
                select(AudioClip).where(AudioClip.ground_truth == c["ground_truth"]).limit(1)
            )
            if existing.scalars().first() is None:
                db.add(AudioClip(**c))
                clips_added += 1
```

5. Update the print statement to include clip count.

**Commit:** `feat: seed STT models and curated audio clips`

---

## Task 10: Frontend — API Client STT Types and Methods

**Files:**
- Modify: `packages/arena/src/api/client.ts:130-284`

Add STT interfaces after the S2S types (after line 180) and STT API methods (after line 284).

**Interfaces to add:**

```typescript
// STT types
export interface AudioClip {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  audio_url: string;
  duration_seconds: number | null;
}

export interface STTBattleSetup {
  id: string;
  battle_type: string;
  model_count: number;
  curated_clips: AudioClip[] | null;
}

export interface STTTranscriptItem {
  model_id: string;
  transcript: string;
  word_count: number;
  e2e_latency_ms: number;
  ttfb_ms: number;
}

export interface STTBattleResult {
  id: string;
  battle_type: string;
  input_audio_url: string;
  ground_truth: string | null;
  transcripts: STTTranscriptItem[];
}

export interface STTDiffItem {
  word: string | null;
  ref_word: string | null;
  type: 'correct' | 'insertion' | 'deletion' | 'substitution';
}

export interface STTModelMetrics {
  transcript: string;
  wer: number | null;
  cer: number | null;
  diff: STTDiffItem[] | null;
  e2e_latency_ms: number;
  ttfb_ms: number;
  word_count: number;
}

export interface STTMetrics {
  status: string;
  model_names: Record<string, string> | null;
  providers: Record<string, string> | null;
  ground_truth: string | null;
  metrics: Record<string, STTModelMetrics> | null;
}
```

**API methods to add** (after the `s2s` namespace, before `tts`):

```typescript
  stt: {
    setup: () =>
      request<STTBattleSetup>('/battles/generate', {
        method: 'POST',
        body: JSON.stringify({ battle_type: 'stt' }),
      }),
    submitAudio: async (
      battleId: string,
      audio: Blob | null,
      curatedClipId?: string,
    ): Promise<STTBattleResult> => {
      const form = new FormData();
      if (audio) form.append('audio', audio, 'recording.webm');
      if (curatedClipId) form.append('curated_clip_id', curatedClipId);
      const res = await fetch(`${API_BASE}/battles/${battleId}/stt-transcribe`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<STTBattleResult>;
    },
    getMetrics: (battleId: string) =>
      request<STTMetrics>(`/battles/${battleId}/stt-metrics`),
  },
```

**Commit:** `feat: API client STT types and methods`

---

## Task 11: Frontend — TranscriptCard Component

**Files:**
- Create: `packages/arena/src/components/TranscriptCard.tsx`

The core comparison card for STT battles. Shows monospaced transcript text with optional diff highlighting.

```typescript
import { motion } from 'framer-motion'

interface DiffItem {
  word: string | null
  ref_word: string | null
  type: 'correct' | 'insertion' | 'deletion' | 'substitution'
}

interface TranscriptCardProps {
  label: string
  color: string
  transcript: string
  wordCount: number
  latencyMs: number
  revealed: boolean
  provider?: string
  modelName?: string
  wer?: number | null
  cer?: number | null
  diff?: DiffItem[] | null
}

export default function TranscriptCard({
  label,
  color,
  transcript,
  wordCount,
  latencyMs,
  revealed,
  provider,
  modelName,
  wer,
  cer,
  diff,
}: TranscriptCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border-default bg-bg-secondary p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-text-primary">
            {label}
          </span>
          {revealed && modelName && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-text-body"
            >
              {modelName}
            </motion.span>
          )}
        </div>
        {revealed && provider && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider bg-bg-tertiary px-2 py-0.5 rounded"
          >
            {provider}
          </motion.span>
        )}
      </div>

      {/* Transcript text */}
      <div className="min-h-[100px] max-h-[200px] overflow-y-auto mb-3 scrollbar-thin">
        {revealed && diff ? (
          <p className="font-[family-name:var(--font-mono)] text-sm leading-relaxed text-text-body">
            {diff.map((item, i) => {
              if (item.type === 'correct') {
                return <span key={i}>{item.word} </span>
              }
              if (item.type === 'insertion') {
                return (
                  <span key={i} className="bg-emerald-500/20 text-emerald-400 rounded px-0.5">
                    {item.word}{' '}
                  </span>
                )
              }
              if (item.type === 'deletion') {
                return (
                  <span key={i} className="bg-red-500/20 text-red-400 line-through rounded px-0.5">
                    {item.ref_word}{' '}
                  </span>
                )
              }
              if (item.type === 'substitution') {
                return (
                  <span key={i} className="bg-amber-500/20 text-amber-400 rounded px-0.5" title={`Expected: ${item.ref_word}`}>
                    {item.word}{' '}
                  </span>
                )
              }
              return null
            })}
          </p>
        ) : (
          <p className="font-[family-name:var(--font-mono)] text-sm leading-relaxed text-text-body">
            {transcript}
          </p>
        )}
      </div>

      {/* Metrics footer */}
      <div className="flex items-center gap-3 text-[10px] font-[family-name:var(--font-mono)] text-text-faint">
        <span>{wordCount} words</span>
        <span>{(latencyMs / 1000).toFixed(1)}s</span>
        {revealed && wer != null && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`px-1.5 py-0.5 rounded ${wer < 0.05 ? 'bg-emerald-500/20 text-emerald-400' : wer < 0.15 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}
          >
            WER: {(wer * 100).toFixed(1)}%
          </motion.span>
        )}
        {revealed && cer != null && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-text-faint"
          >
            CER: {(cer * 100).toFixed(1)}%
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}
```

**Commit:** `feat: TranscriptCard component with diff highlighting`

---

## Task 12: Frontend — AudioClipPlayer Component

**Files:**
- Create: `packages/arena/src/components/AudioClipPlayer.tsx`

Persistent audio player with playback speed and loop controls.

```typescript
import { useState, useRef, useEffect } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import WaveformVisualizer from './WaveformVisualizer'

interface AudioClipPlayerProps {
  audioUrl: string
  color?: string
}

export default function AudioClipPlayer({ audioUrl, color = '#2DD4A8' }: AudioClipPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [loop, setLoop] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
    }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => {
      if (!loop) setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [loop])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
  }

  function cycleSpeed() {
    const speeds = [0.5, 1, 1.5]
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length]
    setPlaybackRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <audio ref={audioRef} src={audioUrl} preload="auto" loop={loop} />
      <div className="flex items-center gap-3">
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-colors"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        {/* Waveform / progress */}
        <div className="flex-1">
          <WaveformVisualizer playing={isPlaying} color={color} height={32} bars={32} />
          <div
            className="h-1 bg-border-default rounded-full mt-1 cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Time */}
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint min-w-[60px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint hover:text-text-body px-1.5 py-0.5 rounded border border-border-default"
        >
          {playbackRate}x
        </button>

        {/* Loop */}
        <button
          onClick={() => setLoop(!loop)}
          className={`p-1 rounded ${loop ? 'text-accent' : 'text-text-faint hover:text-text-body'}`}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )
}
```

**Commit:** `feat: AudioClipPlayer component with speed and loop controls`

---

## Task 13: Frontend — STTInputPanel Component

**Files:**
- Create: `packages/arena/src/components/STTInputPanel.tsx`

Two-tab input panel following the `S2SInputPanel` pattern but adapted for STT curated clips (with difficulty badges and category grouping).

```typescript
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Check } from 'lucide-react'
import AudioRecorder from './AudioRecorder'

export interface AudioClip {
  id: string
  text: string
  category: string
  difficulty: string
  audio_url: string
  duration_seconds: number | null
}

interface STTInputPanelProps {
  curatedClips: AudioClip[]
  onSubmitAudio: (audio: Blob | null, curatedClipId: string | null) => void
  disabled?: boolean
}

type InputTab = 'record' | 'curated'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400',
  medium: 'bg-amber-500/20 text-amber-400',
  hard: 'bg-red-500/20 text-red-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  clean_speech: 'Clean Speech',
  noisy: 'Noisy Environment',
  accented: 'Accented Speech',
  fast_speech: 'Fast Speech',
  domain_jargon: 'Domain Jargon',
  numbers_entities: 'Numbers & Entities',
}

export default function STTInputPanel({
  curatedClips,
  onSubmitAudio,
  disabled = false,
}: STTInputPanelProps) {
  const [activeTab, setActiveTab] = useState<InputTab>('curated')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null)

  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordedUrlRef = useRef<string | null>(null)
  const [recordingPlaying, setRecordingPlaying] = useState(false)

  function handleRecordingComplete(blob: Blob, durationMs: number) {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current)
    }
    setRecordedBlob(blob)
    setRecordedDuration(durationMs)
    const url = URL.createObjectURL(blob)
    recordedUrlRef.current = url
  }

  function handleSubmitRecording() {
    if (recordedBlob) {
      onSubmitAudio(recordedBlob, null)
    }
  }

  function handleSubmitClip() {
    if (selectedClipId) {
      onSubmitAudio(null, selectedClipId)
    }
  }

  function togglePreview(clipId: string, audioUrl: string) {
    const audio = previewAudioRef.current
    if (!audio) return
    if (previewPlaying === clipId) {
      audio.pause()
      setPreviewPlaying(null)
    } else {
      audio.src = audioUrl
      audio.play()
      setPreviewPlaying(clipId)
    }
  }

  // Group clips by category
  const grouped = curatedClips.reduce<Record<string, AudioClip[]>>((acc, clip) => {
    acc[clip.category] = acc[clip.category] || []
    acc[clip.category].push(clip)
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <audio ref={previewAudioRef} onEnded={() => setPreviewPlaying(null)} />

      {/* Tabs */}
      <div className="flex border-b border-border-default">
        {(['curated', 'record'] as InputTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-[family-name:var(--font-mono)] transition-colors relative ${
              activeTab === tab
                ? 'text-accent'
                : 'text-text-faint hover:text-text-body'
            }`}
          >
            {tab === 'curated' ? 'Use a curated clip' : 'Record your own'}
            {activeTab === tab && (
              <motion.div
                layoutId="stt-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'record' ? (
          <div className="space-y-4">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              maxDurationMs={15000}
              disabled={disabled}
            />
            {recordedBlob && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!recordedAudioRef.current) {
                      recordedAudioRef.current = new Audio(recordedUrlRef.current!)
                      recordedAudioRef.current.onended = () => setRecordingPlaying(false)
                    }
                    if (recordingPlaying) {
                      recordedAudioRef.current.pause()
                      setRecordingPlaying(false)
                    } else {
                      recordedAudioRef.current.play()
                      setRecordingPlaying(true)
                    }
                  }}
                  className="text-text-faint hover:text-text-body"
                >
                  {recordingPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <span className="text-xs font-[family-name:var(--font-mono)] text-text-faint">
                  {(recordedDuration / 1000).toFixed(1)}s recorded
                </span>
                <button
                  onClick={handleSubmitRecording}
                  disabled={disabled}
                  className="ml-auto px-4 py-2 bg-accent text-bg-primary rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  Transcribe this
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin">
            {Object.entries(grouped).map(([category, clips]) => (
              <div key={category}>
                <h4 className="text-xs font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <div className="space-y-2">
                  {clips.map((clip) => {
                    const isSelected = selectedClipId === clip.id
                    return (
                      <button
                        key={clip.id}
                        onClick={() => setSelectedClipId(clip.id)}
                        disabled={disabled}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-accent/30 bg-accent/5'
                            : 'border-border-default hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-text-body leading-relaxed line-clamp-2">
                            {clip.text}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-[family-name:var(--font-mono)] px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[clip.difficulty] || ''}`}>
                              {clip.difficulty}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePreview(clip.id, clip.audio_url)
                              }}
                              className="text-text-faint hover:text-text-body"
                            >
                              {previewPlaying === clip.id ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                          </div>
                        </div>
                        {clip.duration_seconds && (
                          <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint mt-1 block">
                            {clip.duration_seconds.toFixed(1)}s
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {selectedClipId && (
              <div className="sticky bottom-0 pt-3 bg-bg-secondary">
                <button
                  onClick={handleSubmitClip}
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-accent text-bg-primary rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Check size={14} className="inline mr-2" />
                  Transcribe this clip
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Commit:** `feat: STTInputPanel component with curated clips and recording`

---

## Task 14: Frontend — STTBattlePage Component

**Files:**
- Create: `packages/arena/src/pages/STTBattlePage.tsx`
- Modify: `packages/arena/src/pages/BattlePage.tsx:16,197-200`

**STTBattlePage** — Full STT battle page with state machine. Follow the `S2SBattlePage` pattern closely (same imports structure, same state machine approach, same UI patterns).

State machine: `idle → loading → listening → voting → revealed`

| State | What's shown |
|-------|-------------|
| `idle` | STTInputPanel. Battle pre-created via `api.stt.setup()` |
| `loading` | GatedLoadingState. Audio submitted to `api.stt.submitAudio()`. Timer counting up |
| `listening` | AudioClipPlayer at top. 4 TranscriptCard components below in grid |
| `voting` | VoteButton row (A, B, C, D, All Bad) |
| `revealed` | Model names unmasked. Diff highlighting activated. WER/CER shown. |

The component structure follows S2SBattlePage (lines 1-649) closely:
- Same state management pattern (useState for each state piece)
- Same processing timer pattern
- Same metrics polling pattern (adapted for STT metrics endpoint)
- Same vote submission flow (uses existing `api.battles.vote()`)
- Same "Next Battle" / sharing pattern

**BattlePage.tsx changes** — Add STT routing:

1. Add import (after line 16):
```typescript
import STTBattlePage from './STTBattlePage'
```

2. Add STT routing (after line 199, following the S2S pattern):
```typescript
  // Route to STT battle page when in STT mode
  if (battleMode === 'stt') {
    return <STTBattlePage onModeChange={handleModeChange} battleCount={battleCount} />
  }
```

**Commit:** `feat: STTBattlePage with full battle flow`

---

## Task 15: Enable STT in ModeSelector

**Files:**
- Modify: `packages/arena/src/components/ModeSelector.tsx:35`

Change STT mode from `enabled: false` to `enabled: true`:

```typescript
  {
    key: 'stt',
    label: 'STT',
    icon: <Mic size={14} />,
    subtitle: 'Compare how different models transcribe the same audio',
    enabled: true,
  },
```

**Commit:** `feat: enable STT mode in ModeSelector`

---

## Task 16: End-to-End Verification

**Backend:**
- Run `alembic upgrade head` — new migration applies cleanly
- Run `python scripts/seed.py` — STT models and audio clips seeded
- `POST /api/v1/battles/generate` with `{"battle_type": "stt"}` returns `STTBattleSetupResponse`
- `POST /api/v1/battles/{id}/stt-transcribe` with test audio returns `STTBattleResponse` with 4 transcripts
- `POST /api/v1/battles/{id}/vote` works for STT battles
- `GET /api/v1/battles/{id}/stt-metrics` returns WER/CER/diff after voting
- TTS and S2S battles still work unchanged

**Frontend:**
- `npx tsc --noEmit` passes (or `npx tsc -b`)
- `npm run build` succeeds
- Navigate to `/battle`, switch to STT mode
- Test "Use a curated clip" flow end-to-end
- Test "Record your own" flow
- Verify transcript cards display correctly
- Verify diff highlighting appears after voting
- Verify WER/CER badges with correct color coding
- Switch back to TTS and S2S — still work

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Settings: AssemblyAI/Google API keys | 1 modified |
| 2 | STT service: 4 provider integrations | 1 created |
| 3 | STT metrics: WER, CER, word diff | 1 created |
| 4 | STT Pydantic schemas | 1 created |
| 5 | Migration: audio_clips table + ORM | 1 migration, 1 model, 1 modified |
| 6 | Battle generation for STT (step 1) | 1 modified |
| 7 | Input-audio upload endpoint (step 2) | 1 modified |
| 8 | Post-vote metrics endpoint | 1 modified |
| 9 | Seed STT models + curated clips | 1 modified |
| 10 | API client STT types/methods | 1 modified |
| 11 | TranscriptCard component | 1 created |
| 12 | AudioClipPlayer component | 1 created |
| 13 | STTInputPanel component | 1 created |
| 14 | STTBattlePage + BattlePage routing | 1 created, 1 modified |
| 15 | Enable STT in ModeSelector | 1 modified |
| 16 | E2E verification | — |

**No new dependencies needed** — all STT providers use REST APIs via `httpx` (already in deps).

**Total: ~7 new files, ~6 modified files, 15 commits.**
