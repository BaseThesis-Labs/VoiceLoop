# Agent Battle Mode Design — Phase 1

**Date:** 2026-02-21
**Status:** Approved
**Branch:** `feat/multi-mode-battles`
**Reference:** `docs/agents-battle-design.md` (full architecture taxonomy & vision)

## Overview

Agent battles let users have sequential voice conversations with two AI agents on the same task scenario, then vote on which handled it better. Phase 1 focuses on two managed cascade providers (Vapi and Retell) with outcome-based battles, WebSocket proxy architecture, and 10 seed scenarios across 3 categories.

This is fundamentally different from TTS/STT/S2S modes: real-time bidirectional audio streaming, multi-turn conversations, and scenario-driven evaluation.

---

## Scope — Phase 1

- **Providers:** Vapi, Retell (both managed cascade agents)
- **Battle formulation:** Architecture-blind outcome battles only
- **Connection:** WebSocket proxy (Arena API between browser and provider)
- **Audio capture:** MediaRecorder + WebSocket from browser
- **Conversation flow:** Sequential (talk to A, then B, then vote)
- **End mechanism:** Manual "End Conversation" button + auto-timeout safety net
- **System prompt:** Same prompt for both agents per scenario (fair comparison)
- **Scenarios:** 10 across booking, customer support, info retrieval
- **Agent configs:** 6 seeded (3 Vapi variants, 3 Retell variants)

**Out of scope for Phase 1:** LiveKit SFU, S2S agents (OpenAI Realtime, Ultravox), architecture-specific battles, component isolation battles, UTMOS/prosody scoring, real tool integrations.

---

## Architecture & Data Flow

### Battle Lifecycle

```
1. User visits /battle, selects Agent mode
2. Frontend calls POST /battles/generate {battle_type: "agent"}
3. Backend picks a scenario + 2 agent configs (one Vapi, one Retell)
4. Returns scenario description, agent labels (A/B), battle ID
5. User clicks "Talk to Agent A"
6. Frontend opens WebSocket: ws://arena-api/battles/{id}/agent-stream?agent=a
7. Backend opens WebSocket to Vapi, proxies audio bidirectionally
8. User talks, agent responds in real-time. Backend records both sides.
9. User clicks "End Conversation" → WebSocket closes, backend saves conversation
10. User clicks "Talk to Agent B" → same flow with Retell
11. Both done → vote buttons appear (overall + sub-dimensions)
12. POST /battles/{id}/vote → triggers async automated eval pipeline
13. Reveal: provider names, architecture type, latency, task success
```

### WebSocket Proxy

```
Browser ←→ Arena API WebSocket ←→ Provider WebSocket
  (mic audio chunks →)    (→ forwarded to Vapi/Retell)
  (← agent audio chunks)  (← forwarded from provider)
```

**Arena API WebSocket endpoint:** `WS /battles/{id}/agent-stream?agent=a|b`

On connect:
1. Load battle, verify agent slot is available
2. Load agent config + scenario
3. Open outbound WebSocket to provider (Vapi or Retell)
4. Send session config (system prompt, tools, voice settings)
5. Start bidirectional proxy: browser audio → provider, provider audio → browser
6. Record both audio streams to disk
7. Track per-turn latency (speech onset/offset detection)

On disconnect:
1. Close provider WebSocket gracefully
2. Finalize audio recordings
3. Save conversation record (turns, duration, latency metrics)
4. Transcribe user+agent audio with Whisper for consistent transcripts

### Provider Adapters

Two concrete implementations following a common `AgentAdapter` interface:

- **VapiAdapter** — Connects to Vapi WebSocket API, sends system prompt + scenario tools, handles Vapi event format (audio chunks, transcript events, tool call events)
- **RetellAdapter** — Connects to Retell WebSocket API, handles Retell's event format

Each adapter normalizes provider-specific events into common internal types: `AudioChunk`, `TranscriptUpdate`, `ToolCallEvent`, `SessionEnd`.

---

## Database Schema

### `scenarios` table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| name | Text | "Restaurant booking with dietary restriction" |
| category | Text | booking / support / info_retrieval |
| difficulty | Text | easy / medium / hard |
| description_for_user | Text | What the user sees as their task |
| system_prompt | Text | Shared prompt given to both agents |
| required_slots | JSONB | For automated JGA scoring |
| success_criteria | Text | For LLM-as-judge evaluation |
| tools_available | JSONB | Tool definitions agents can call |
| max_turns | Int | Safety limit (default 10) |
| max_duration_seconds | Int | Auto-timeout (default 120) |
| adversarial_turns | JSONB | Optional mid-conversation twists |
| created_at | Timestamptz | |

### `agent_configurations` table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| name | Text | "Vapi + GPT-4.1 + ElevenLabs" |
| architecture_type | Text | cascade / half_cascade / s2s / orchestrator / hybrid |
| provider | Text | vapi / retell |
| components_json | JSONB | {"stt": "deepgram_nova3", "llm": "gpt-4.1", "tts": "elevenlabs"} |
| config_json | JSONB | Provider-specific settings (voice ID, model params) |
| elo_rating | Float | Cross-architecture ELO (default 1500) |
| elo_within_type | Float | Within-type ELO (default 1500) |
| total_battles | Int | Default 0 |
| win_rate | Float | Default 0.0 |
| created_at | Timestamptz | |

### `agent_conversations` table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| battle_id | UUID FK → battles | |
| agent_config_id | UUID FK → agent_configurations | |
| scenario_id | UUID FK → scenarios | |
| agent_label | Text | "a" or "b" |
| turns_json | JSONB | [{role, text, audio_path, start_ms, end_ms, latency_ms}] |
| total_turns | Int | |
| duration_seconds | Float | |
| user_audio_path | Text | Full user recording |
| agent_audio_path | Text | Full agent recording |
| transcript_full | Text | Whisper-normalized |
| avg_response_latency_ms | Float | |
| p50_latency_ms | Float | |
| p95_latency_ms | Float | |
| ttfb_avg_ms | Float | |
| task_success | Boolean | LLM-as-judge result |
| joint_goal_accuracy | Float | Slot-filling accuracy |
| containment | Boolean | Resolved without escalation |
| turns_to_completion | Int | |
| created_at | Timestamptz | |

### Relationship to existing `battles` table

Reuse the existing `battles` table with `battle_type = "agent"`. A lightweight `agent_battles` join table links the battle to its scenario, agent configs, and conversations:

| Column | Type |
|--------|------|
| id | UUID PK |
| battle_id | UUID FK → battles |
| formulation | Text | "outcome" for Phase 1 |
| scenario_id | UUID FK → scenarios |
| config_a_id | UUID FK → agent_configurations |
| config_b_id | UUID FK → agent_configurations |
| conversation_a_id | UUID FK → agent_conversations (nullable until conversation happens) |
| conversation_b_id | UUID FK → agent_conversations (nullable) |
| sub_votes_json | JSONB | {naturalness: "a", speed: "b", ...} |
| automated_eval_json | JSONB | Full LLM-as-judge results |

---

## Frontend

### State Machine

```
idle → briefing → conversing_a → transition → conversing_b → voting → revealed
```

| State | What's shown |
|-------|-------------|
| `idle` | Loading, battle setup in progress |
| `briefing` | Scenario card with task description. "Talk to Agent A" button |
| `conversing_a` | Live conversation UI — waveform, live transcript, timer, "End Conversation" button |
| `transition` | "Agent A complete. Ready for Agent B?" Summary of conversation A |
| `conversing_b` | Same conversation UI for Agent B |
| `voting` | Both conversations summarized. Overall vote (A/B/Tie) + sub-dimension votes |
| `revealed` | Provider names, architecture, latency comparison, task success (progressive) |

### New Components

- **`AgentBattlePage`** — Main page component with state machine. Rendered when `battleMode === 'agent'` in BattlePage.
- **`AgentConversation`** — Core real-time conversation component (reused for A and B). Opens WebSocket, streams mic audio, plays agent audio, shows live transcript, waveform visualizer, timer, end button.
- **`ScenarioCard`** — Displays task description, category badge, difficulty level.
- **`ConversationSummary`** — Post-conversation card: turn count, duration.
- **`SubDimensionVoter`** — Naturalness / speed / understanding / helpfulness (A ←→ B quick-tap).

### Audio Playback

Agent audio arrives as chunks over WebSocket. Use `AudioContext` with a buffer queue for low-latency playback:
1. Receive audio chunk from WebSocket
2. Decode to AudioBuffer
3. Queue in a playback buffer
4. Schedule with `AudioBufferSourceNode` for gapless playback

---

## Post-Vote Evaluation Pipeline

### Instant (on vote submit)
- Save vote + sub-dimension votes
- Update ELO ratings for both agent configs
- Return provider names, architecture types, component stacks

### Async (background tasks)
1. **Whisper transcription** — Normalize both conversations to consistent transcripts
2. **Latency computation** — p50, p95, average from per-turn data captured during proxy
3. **LLM-as-judge** — Send transcript + scenario to GPT-4.1:
   - Task success (boolean)
   - Coherence score (0-1)
   - Instruction following (0-1)
   - Hallucination count
4. **Joint Goal Accuracy** — Deterministic slot extraction vs `required_slots`

### Progressive Reveal
Frontend polls `GET /battles/{id}/agent-metrics` at 1s intervals:
- `"computing"` → spinner
- `"partial"` → latency stats (available first)
- `"complete"` → task success, coherence, JGA, hallucination count

---

## Seed Data

### 10 Scenarios

**Booking (4):**
1. Haircut appointment (easy) — single-slot task
2. Restaurant with dietary needs (medium) — multi-slot + constraint
3. Hotel with preferences (medium) — multiple preferences to negotiate
4. Flight rebooking (hard) — multi-step reasoning with constraints

**Customer Support (3):**
5. Order status check (easy) — simple lookup
6. Return with missing receipt (medium) — alternative verification
7. Billing dispute (hard) — frustrated tone, needs escalation + credit

**Information Retrieval (3):**
8. Store hours and directions (easy) — simple FAQ
9. Product comparison (medium) — compare plans, follow-ups
10. Troubleshooting guide (hard) — step-by-step walkthrough

Tools are simulated (canned responses) for Phase 1.

### 6 Agent Configurations

| Name | Provider | STT | LLM | TTS |
|------|----------|-----|-----|-----|
| Vapi Default | Vapi | Deepgram Nova-3 | GPT-4.1-mini | ElevenLabs |
| Vapi Quality | Vapi | Deepgram Nova-3 | GPT-4.1 | ElevenLabs |
| Vapi Claude | Vapi | Deepgram Nova-3 | Claude Sonnet 4.5 | ElevenLabs |
| Retell Default | Retell | Deepgram Nova-3 | GPT-4.1-mini | ElevenLabs |
| Retell Quality | Retell | Deepgram Nova-3 | GPT-4.1 | ElevenLabs |
| Retell Claude | Retell | Deepgram Nova-3 | Claude Sonnet 4.5 | ElevenLabs |
