# SmallestAI TTS Integration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SmallestAI as a second TTS provider so Cartesia and SmallestAI voices compete in cross-provider blind A/B battles.

**Architecture:** Refactor the Cartesia-only TTS service into a multi-provider dispatcher. Add 9 SmallestAI English voices. Add engine variant selector to Playground UI.

**Tech Stack:** SmallestAI Python SDK (`smallestai`), FastAPI, React/TypeScript

---

### Task 1: Add SmallestAI config

**Files:**
- Modify: `packages/arena-api/app/config.py`
- Modify: `packages/arena-api/.env.example`

**Changes:**
- Add `smallest_api_key: str = ""` to Settings class
- Add `SMALLEST_API_KEY=` to `.env.example`

---

### Task 2: Refactor TTS service to multi-provider

**Files:**
- Modify: `packages/arena-api/app/services/tts_service.py`

**Changes:**

Update `generate_tts` signature:
```python
def generate_tts(text: str, provider: str, voice_id: str, model_id: str, sample_rate: int = 44100) -> dict:
```

Dispatch logic:
```python
if provider == "cartesia":
    return _generate_cartesia(text, voice_id, model_id)
elif provider == "smallestai":
    return _generate_smallestai(text, voice_id, model_id)
else:
    raise ValueError(f"Unknown provider: {provider}")
```

Extract current Cartesia code into `_generate_cartesia()`.

New `_generate_smallestai()`:
- Lazy-init `WavesClient` singleton with `settings.smallest_api_key`
- Call `client.synthesize(text=text, model=model_id, voice_id=voice_id, sample_rate=24000)`
- Returns raw bytes — write directly to WAV file
- Measure TTFB and generation time same as Cartesia
- Duration from file size: `data_size / (2 * 24000)` (16-bit mono at 24000 Hz)

Return same dict shape: `{audio_path, filename, duration_seconds, ttfb_ms, generation_time_ms}`

---

### Task 3: Update seed script

**Files:**
- Modify: `packages/arena-api/scripts/seed.py`

**Changes:**

Add 9 SmallestAI voices:
- emily, james, jasmine, george, arman, enola, judi, rebecca, karen
- All with `provider="smallestai"`, `version="lightning"`
- `config_json` includes: `voice_id`, `model_id: "lightning"`, `gender`, `accent`

Remove 8 placeholder models (GPT-4o Realtime, Gemini, Claude, ElevenLabs, Hume, Bland, Vapi, Retell).

Make idempotent: check if model with same name exists before inserting.

---

### Task 4: Update battle generation

**Files:**
- Modify: `packages/arena-api/app/routers/battles.py`
- Modify: `packages/arena-api/app/schemas/battle.py`

**Changes:**

In `generate_battle`:
- Read `provider` from each model record
- Pass `provider`, `voice_id`, and `model_id` from `config_json` to `generate_tts`

In `BattleGenerateResponse` schema:
- Add `provider_a: str` and `provider_b: str` fields

Return provider names in response.

---

### Task 5: Update TTS endpoint with engine override

**Files:**
- Modify: `packages/arena-api/app/routers/tts.py`
- Modify: `packages/arena-api/app/schemas/` (or inline in router)

**Changes:**

Add optional `engine` field to the TTS generate request body:
```python
class TTSGenerateBody(BaseModel):
    model_id: str
    text: str
    engine: str | None = None  # overrides config_json.model_id
```

When `engine` is provided, use it as `model_id` for the TTS call instead of the model's default.

---

### Task 6: Update frontend API client

**Files:**
- Modify: `packages/arena/src/api/client.ts`

**Changes:**

- Add optional `engine?: string` to `TTSGenerateRequest`
- Add `provider_a: string` and `provider_b: string` to `GeneratedBattle`
- Update `api.tts.generate()` to accept optional engine parameter

---

### Task 7: Add engine selector to Playground UI

**Files:**
- Modify: `packages/arena/src/pages/PlaygroundPage.tsx`

**Changes:**

- Add `engine` state (default: null = use model's default)
- When selected model's provider is "smallestai", show engine dropdown with options: lightning, lightning-large, lightning-v2
- When provider is "cartesia", hide dropdown
- Pass `engine` to `api.tts.generate()` call
- Show selected engine in live metrics panel

---

### Task 8: Add provider to Battle page reveal

**Files:**
- Modify: `packages/arena/src/pages/BattlePage.tsx`

**Changes:**

- Read `provider_a` and `provider_b` from battle response
- In post-vote reveal section, show provider badge next to model name (e.g., "Emily — SmallestAI" vs "Samantha — Cartesia")
- Style with capitalize + subtle badge

---

## Dependency Order

```
Task 1 (Config)          ─┐
Task 2 (TTS Service)     ─┼─→ Task 4 (Battle Gen) ─→ Task 8 (Battle UI)
Task 3 (Seed Script)     ─┘         │
Task 5 (TTS Endpoint)    ──→ Task 6 (API Client) ─→ Task 7 (Playground UI)
```

Tasks 1, 2, 3 can run in parallel. Tasks 5 and 6 can run in parallel.
