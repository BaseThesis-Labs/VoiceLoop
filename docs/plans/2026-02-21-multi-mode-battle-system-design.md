# KoeCode Arena: Multi-Mode Battle System Design

**Date:** 2026-02-21
**Author:** Siddhant Saxena · BaseThesis Labs
**Status:** Proposed
**Scope:** Extend the battle page from TTS-only to four battle modes: TTS, STT, Speech-to-Speech, and Voice Agents.

---

## 1. The Problem

KoeCode Arena currently supports a single battle type: **Text-to-Speech**. The flow is: system provides a text prompt → N TTS models generate audio → user listens blind → votes on best voice. This is the exact same paradigm as HuggingFace TTS Arena — a text-in, audio-out comparison.

But voice AI has four fundamentally different evaluation surfaces, each with different input modalities, output modalities, interaction patterns, and quality signals:

| Mode | Input | Output | Interaction | What the user judges |
|------|-------|--------|-------------|---------------------|
| **TTS** | Text prompt | Audio | Passive (listen) | Naturalness, prosody, clarity |
| **STT** | Audio clip | Text transcript | Passive (read) | Accuracy, formatting, handling of edge cases |
| **S2S** | Audio input | Audio response | Semi-active (speak, then listen) | Response quality, voice naturalness, latency, coherence |
| **Voice Agent** | Live conversation | Multi-turn dialogue | Active (real-time conversation) | Task completion, naturalness, latency, error recovery |

These are not variations of the same UI — they require fundamentally different battle interfaces, different input mechanisms, different judging criteria, and different backend orchestration. This document specifies how to extend the Arena to support all four while maintaining a unified battle identity.

---

## 2. Design Principles

### 2.1. One Arena, Four Modes — Not Four Arenas

LMArena splits into entirely separate arenas (Text, Vision, Code, Search) with separate URLs and leaderboards. This makes sense when the arenas serve different user populations. KoeCode Arena serves the *same* user population — voice AI engineers — who need to evaluate different layers of the same stack. The modes should feel like facets of one product, not four different products.

### 2.2. Mode Selection is a First-Class Navigation Decision

The user must choose their battle mode *before* entering the battle flow, not during. Mixing modes mid-battle creates confusion about what is being judged. The mode selector is permanent, visible, and changes the entire battle experience.

### 2.3. Each Mode Gets Its Own Optimal UI

Don't force all four modes into the same card grid. TTS battles are about passive listening and comparing audio quality. STT battles are about reading and comparing text accuracy. S2S battles require the user to speak first. Agent battles are real-time conversations. Each mode should feel purpose-built.

### 2.4. Separate ELO Pools, Unified Leaderboard

A TTS model's ELO should never be compared to an STT model's ELO. Each mode maintains its own rating pool. But the leaderboard page should show all modes with a mode filter/tab, so users can see the full picture of the voice AI landscape.

### 2.5. Progressive Complexity

TTS is the simplest mode (no user input beyond clicking "New Prompt"). S2S adds bidirectional audio. STT adds audio input and transcript comparison. Agent adds multi-turn state. Ship in this order. Design for all four now, implement incrementally.

---

## 3. Strategic Decisions

### 3.1. Priority Order

S2S is the #2 priority after TTS. The S2S space has the most market energy right now (OpenAI Realtime, Gemini Live, Hume EVI, Moshi) and no independent head-to-head benchmark exists. Engineers are choosing providers based on blog posts and vibes, not blind evaluation.

**Revised build order: TTS (done) → S2S → STT → Agent.**

STT moves to Phase 3 because:
- It gives time to build a curated audio clip library (a content curation effort, not an engineering one).
- The "reading transcripts" UX needs more design iteration to make it engaging.
- S2S delivers higher impact to the target audience sooner.

### 3.2. Distribution Strategy: Provider Partnerships with Tiered Access

S2S providers are in a unique position — they all claim to be fastest and most natural, but none have independent, head-to-head validation. The arena gives them third-party proof.

**Pitch to providers:** "Your model is already in our arena. Here's your profile page. Share it with your community and let the votes decide."

**Tiered access model:**

| Tier | What they get |
|------|---------------|
| **Free** | Leaderboard presence, public profile page, "Ranked #N on KoeCode Arena" badge |
| **Paid** | Win rate by scenario category, latency percentile distribution (p50/p95/p99), head-to-head record vs. each competitor, aggregated user feedback themes, exportable reports for marketing |

This aligns incentives: providers drive traffic (more battles = better rankings data), and KoeCode gets a revenue model tied to arena health.

**Credibility safeguard:** Providers can suggest scenarios/prompts and flag integration bugs, but have zero influence on ranking methodology or vote counting. Paid tier buys analytics, not influence.

---

## 4. Battle Mode Selection UI

### 4.1. Where It Lives

The mode selector replaces the current "VOICE MODEL BATTLE" header area. It sits above the prompt/input card and below the top navigation bar. It is persistent — always visible during the battle, showing which mode you're in, with the ability to switch.

### 4.2. Layout: Horizontal Pill Tabs

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚡ Battle #4                                                        │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐           │
│  │  🔊 TTS │  │  🔄 S2S │  │  🎤 STT │  │  🤖 Agent    │           │
│  │         │  │         │  │ (coming  │  │  (coming soon)│           │
│  │         │  │         │  │  soon)   │  │              │           │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘           │
│                                                                      │
│  Text-to-Speech: Compare how models speak the same text             │
└──────────────────────────────────────────────────────────────────────┘
```

**Specifications:**

- **Style:** Horizontal pill/tab strip, matching current design system (monospace labels, dark bg, accent border on active).
- **Active state:** Filled pill with green accent border, slightly brighter background (`bg-accent/10`).
- **Inactive state:** Ghost pill with subtle border (`border-border-default`), muted text.
- **Disabled state:** Ghost pill with `opacity-40`, "(coming soon)" sublabel, non-interactive.
- **Tab order:** Matches build priority — TTS, S2S, STT, Agent (not alphabetical).
- **Subtitle:** Below the tabs, a single-line description updates based on selected mode.
- **Persistence:** Selected mode persists across battles (localStorage). Switching mode triggers a new battle generation for that mode.

### 4.3. Mode Descriptions (subtitle text)

| Mode | Subtitle |
|------|----------|
| TTS | "Compare how different models speak the same text" |
| S2S | "Speak to models and compare their spoken responses" |
| STT | "Compare how different models transcribe the same audio" |
| Agent | "Have a conversation with two agents and judge who handles it better" |

### 4.4. Why Tabs Over Cards/Grid/Dropdown

- **Dropdown** hides the options — users won't discover modes they don't know about.
- **Large cards** (like a landing page) waste vertical space and add a click before every battle.
- **Tabs** show all options at a glance, require zero extra clicks if you're already in the right mode, and match the mental model of "I'm in TTS mode" as a persistent state.

---

## 5. TTS Battle (Current — Refinements Only)

### 5.1. Current Flow (Preserved)

```
System generates text prompt → 3-4 TTS models generate audio →
User listens to each → Votes for best → Models revealed with metrics
```

### 5.2. Refinements

- Add mode-specific metrics to the post-vote reveal: UTMOS, prosody score, TTFB, duration.
- Category tag (SUPPORT, SALES, etc.) remains in the prompt card.
- "New Prompt" button regenerates with same mode.
- No changes to the 2×2 AudioPlayerCard grid.

### 5.3. Voting Question

Current: "Which voice sounds best?"
Keep as-is. This is the right question for TTS.

---

## 6. Speech-to-Speech Battle (New — Priority #2)

### 6.1. Core Concept

The user provides a spoken input (a question, a request, a statement). Multiple S2S models each generate a spoken response. The user listens to all responses and votes on the best one. This evaluates the full loop: understanding the user's speech → generating a relevant response → synthesizing natural speech.

### 6.2. Battle Flow

```
1. User speaks OR selects a pre-recorded prompt (equally weighted options)
2. Audio is sent to backend, which fans out to 2-3 S2S providers via WebSocket
3. Backend collects all responses, stores audio
4. All model cards revealed simultaneously with randomized positions
5. User listens to each response
6. User votes on best response (required) + optional dimension ratings
7. Models revealed; metrics computed progressively after vote
```

### 6.3. UI Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  YOUR INPUT                                                          │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │  🎤 Speak your own   │  │  📝 Use a curated    │                 │
│  │                      │  │     prompt            │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  "What's the weather like in San Francisco today?"             │  │
│  │   ↑ live transcript of your input (Whisper)                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│          ─── Models are responding... (2.1s) ───                     │
│                                                                      │
│  (Cards hidden until ALL models finish, then revealed with          │
│   randomized positions to prevent primacy bias)                      │
│                                                                      │
│  ┌─── Model A ──────────────┐  ┌─── Model B ──────────────┐        │
│  │  ● Model A               │  │  ● Model B               │        │
│  │                          │  │                          │        │
│  │   ▶ Click to play        │  │   ▶ Click to play        │        │
│  │                          │  │                          │        │
│  │  ⏱ E2E: 1.8s  ⚡ TTFB:  │  │  ⏱ E2E: 2.4s  ⚡ TTFB:  │        │
│  │     320ms                │  │     890ms                │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│                                                                      │
│     [ A is best ]  [ B is best ]  [ Both bad ]  [ Tie ]            │
│                                                                      │
│  ▸ Help us rank better — rate two more dimensions                    │
│    ┌─────────────────────┬─────────────────────┐                    │
│    │ Better answer?      │ Better voice?        │                    │
│    │ [A] [B] [Tie]       │ [A] [B] [Tie]        │                    │
│    └─────────────────────┴─────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4. Key UI Decisions

#### 6.4.1. Input Mechanism — Equally Weighted Dual Mode

Two input modes presented as **equal options**, not primary/fallback:

- **"Speak your own"**: Large microphone button. User holds to record, releases to send. Live waveform animation during recording. A live transcript (via Whisper) appears below the waveform so the user can verify what was captured.
- **"Use a curated prompt"**: System provides pre-recorded audio prompts across categories. User clicks play to hear the prompt, then the system sends it to models.

Both buttons get equal visual weight in the UI. No toggle or switch — two side-by-side buttons. The curated prompt option is important for users without microphones, in noisy environments, or who want reproducible benchmarks.

#### 6.4.2. Gated Playback (Preventing Primacy Bias)

If models responded at different speeds and cards appeared as they arrived, users would systematically listen to faster models first — giving them a vote boost beyond their actual latency advantage (primacy effect).

**Solution:** Show a global loading state ("Models are responding... 2.1s") with a timer. Once ALL models have responded, reveal all cards simultaneously with randomized position assignment. Latency numbers are still displayed on each card, so speed isn't hidden — it just doesn't dictate listening order.

Per-model states during loading:
- If one model finishes early, do NOT reveal its card.
- If a model takes 8+ seconds, show a "Still generating..." state with a skip option.

#### 6.4.3. Voting Structure — One Required, One Optional

**Required vote:** "Which response was better overall?" — A / B / Both bad / Tie.

**Optional dimension ratings:** Collapsed by default under "Help us rank better — rate two more dimensions." Expands to show:
- "Better answer?" — A / B / Tie (content quality)
- "Better voice?" — A / B / Tie (voice naturalness)

Design as quick taps, not sliders. Six taps max. Feels like contribution, not homework. The optional votes feed richer signal into ranking models without taxing casual voters.

#### 6.4.4. Reduced Model Count

S2S battles use 2-3 models instead of 4. Rationale: S2S latency is higher (0.5s – 5s+), so more models = longer wait. Also, S2S models are fewer in the market — 4-way comparison will be hard to fill. 2-model comparison keeps it fast.

#### 6.4.5. Loading State

- Global timer counting up from audio dispatch: "Models are responding... (2.1s)"
- All cards hidden during loading (gated playback).
- Don't block indefinitely — if one model takes 8+ seconds, show skip option for that model.

### 6.5. Voting Question

"Which response was better overall?"

Sub-criteria available as optional dimension ratings (see 6.4.3).

### 6.6. Post-Vote Reveal — Progressive Metrics

Metrics are computed **after the vote** to minimize pre-vote wait time. The reveal screen fills in progressively:

| Timing | What appears |
|--------|-------------|
| **Instant (0s)** | Model names, provider logos, E2E latency, TTFB |
| **~2s** | Response transcripts (Whisper on response audio) |
| **~3-5s** | UTMOS, prosody score, response relevance (LLM-as-judge) |

Each metric slot shows a skeleton loader until it resolves. This creates an engaging "results coming in" feel rather than a static wall of numbers.

**Full metrics list:**

| Metric | Description |
|--------|-------------|
| E2E latency | Mouth-to-ear total time |
| TTFB | Time to first audio byte |
| Response transcript | What the model said (Whisper transcription) |
| Response relevance | LLM-as-judge score on answer quality |
| UTMOS | Voice quality of the response |
| Prosody score | Naturalness of speech patterns |
| Input transcript accuracy | How well the model understood the user's speech |

### 6.7. Backend Architecture — Full Proxy

The backend proxies all S2S provider connections. The frontend never connects directly to providers.

**Flow:**
1. Frontend POSTs user audio to `POST /api/v1/battles/{id}/input-audio`
2. Backend opens WebSocket connections to each S2S provider (OpenAI Realtime, Hume EVI, etc.)
3. Backend sends user audio to each provider, collects full response audio
4. Backend stores response audio files, closes WebSocket connections
5. Backend returns audio URLs + latency data to frontend
6. Frontend reveals all cards simultaneously with randomized positions

This adds some latency vs. direct frontend connections, but pairs well with gated playback (we're waiting for all models anyway). Keeps the frontend simple and avoids exposing provider-specific protocols to the client.

### 6.8. S2S-Specific Providers (Initial)

| Provider | Model | Notes |
|----------|-------|-------|
| OpenAI | GPT-4o Realtime | WebSocket API, ~320ms TTFB |
| Google | Gemini Live | Streaming bidirectional |
| Kyutai | Moshi | Open-source, 160ms theoretical min |
| Hume AI | EVI 2 | Emotion-aware S2S |
| Fixie AI | Ultravox | Open-source, tool-calling support |

---

## 7. STT Battle (New — Phase 3)

### 7.1. Core Concept

The inverse of TTS. Instead of "same text, different audio," it's "same audio, different transcripts." The user hears one audio clip and reads N transcript outputs from different STT models, then votes on which transcript is most accurate.

### 7.2. Battle Flow

```
1. System selects or user records an audio clip
2. Audio is sent to 3-4 STT models in parallel
3. User plays the audio clip (single player, prominent)
4. User reads the transcript outputs (side-by-side cards)
5. User votes on best transcript
6. Models revealed with WER, CER, SeMaScore, SAER, latency
```

### 7.3. UI Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  AUDIO CLIP                                           MEDICAL ▸     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▶  ━━━━━━━━━━●━━━━━━━━━━━━━━━  0:04 / 0:12                  │  │
│  │                                                                │  │
│  │  "Patient describes intermittent chest pain radiating to..."   │  │
│  │   ↑ ground truth (shown after vote)                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── Model A ──────────────┐  ┌─── Model B ──────────────┐        │
│  │                          │  │                          │        │
│  │  Patient describes       │  │  Patient describes       │        │
│  │  intermittent chest pain │  │  intermittent test pain  │        │
│  │  radiating to the left   │  │  rating to the left      │        │
│  │  arm, occurring mainly   │  │  arm, occurring mainly   │        │
│  │  during physical         │  │  during physical         │        │
│  │  exertion.               │  │  exertion.               │        │
│  │                          │  │                          │        │
│  │  ⏱ 340ms  📝 142 words   │  │  ⏱ 210ms  📝 142 words   │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│                                                                      │
│  ┌─── Model C ──────────────┐                                       │
│  │  ...                     │                                       │
│  └──────────────────────────┘                                       │
│                                                                      │
│        [ A is best ]  [ B is best ]  [ C is best ]  [ All bad ]     │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.4. Key UI Decisions

#### 7.4.1. Audio Source

Two input modes (toggled via a small switch in the audio card):

- **Curated clips** (default): System selects from a library of pre-recorded audio spanning scenarios: clean speech, noisy environments, accented speech, code-switching, medical terminology, financial jargon, fast speech, whispered speech. This ensures consistent evaluation and covers known STT failure modes.
- **Record your own** (optional): User records via browser microphone. Creates ecological validity — users test with their own voice, accent, environment. Recorded audio is saved for future battles (with consent).

#### 7.4.2. Transcript Display

- Monospaced font for transcripts (precision matters — users need to spot character-level differences).
- No diff highlighting before voting (that would bias the vote). After voting, show a diff against ground truth with insertions (green), deletions (red), substitutions (orange).
- Show word count and transcription latency below each transcript card.
- If transcript is long, cards scroll independently. Equal height enforced.

#### 7.4.3. Ground Truth Handling

- For curated clips: ground truth is known and stored. Shown after vote alongside diff.
- For user-recorded clips: no ground truth available. User votes on perceived accuracy only. Optional: user can type the intended text before recording, which becomes the ground truth.

#### 7.4.4. Audio Playback

Single audio player, prominently placed above the transcript cards. The user must be able to replay the audio while reading transcripts. The player should support: play/pause, scrub, playback speed (0.5x, 1x, 1.5x), and a loop button.

### 7.5. Voting Question

"Which transcription is most accurate?"

### 7.6. Post-Vote Reveal Metrics

| Metric | Description |
|--------|-------------|
| WER | Word Error Rate vs. ground truth |
| SeMaScore | Semantic similarity (did it preserve meaning?) |
| CER | Character Error Rate |
| SAER | Semantic-Aligned Error Rate (multilingual) |
| Transcription latency | Time to return full transcript |
| Diff view | Highlighted differences vs. ground truth |

### 7.7. Scenario Categories for STT

| Category | What it tests | Example |
|----------|--------------|---------|
| Clean speech | Baseline accuracy | Clear, studio-quality narration |
| Noisy environment | Noise robustness | Street sounds, cafe background, wind |
| Accented speech | Accent handling | Indian English, Scottish English, Nigerian English |
| Code-switching | Multilingual | Hindi-English mix, Spanglish |
| Domain jargon | Specialized vocabulary | Medical terms, legal language, financial tickers |
| Fast speech | Speed handling | Rapid dictation, auctioneer-style |
| Overlapping speakers | Diarization | Two people talking over each other |
| Numbers & entities | Entity recognition | Phone numbers, addresses, dollar amounts |

---

## 8. Voice Agent Battle (New — Phase 4)

### 8.1. Core Concept

This is the most complex mode. The user has a real-time, multi-turn conversation with two voice agents sequentially (not simultaneously). After the conversation ends, the user votes on which agent handled the interaction better. This evaluates the entire agent stack: STT → LLM → TTS → state management → error recovery.

### 8.2. Battle Flow

```
1. System presents a scenario/task (e.g., "Book a flight to NYC next Tuesday")
2. User has a live conversation with Agent A (30-90 seconds)
3. User has a live conversation with Agent B (30-90 seconds)
   (same scenario, same user intent, different underlying models)
4. User votes on which agent handled the task better
5. Agents revealed with full metrics
```

### 8.3. UI Layout — Conversation Phase

```
┌──────────────────────────────────────────────────────────────────────┐
│  SCENARIO                                            BOOKING ▸      │
│                                                                      │
│  You want to book a table for 4 at an Italian restaurant in         │
│  downtown Manhattan this Friday at 7pm. You have a nut allergy.     │
│                                                                      │
│  ┌─────────────────────── Agent A ───────────────────────────────┐  │
│  │                                                               │  │
│  │   Agent: "Hi, welcome to BookTable! How can I help you        │  │
│  │          today?"                                              │  │
│  │                                                               │  │
│  │   You:   "I'd like to book a table for four this Friday."     │  │
│  │                                                               │  │
│  │   Agent: "Of course! What cuisine are you in the mood for?"   │  │
│  │                                                               │  │
│  │                                                               │  │
│  │          ┌──────────────────┐                                 │  │
│  │          │  🎤 Speaking...  │       ⏱ 1:24 elapsed            │  │
│  │          └──────────────────┘                                 │  │
│  │                                                               │  │
│  │  Turns: 3/8 max  ·  Avg response: 1.2s                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│         [ End conversation & move to Agent B → ]                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.4. UI Layout — Voting Phase

```
┌──────────────────────────────────────────────────────────────────────┐
│  COMPARE AGENTS                                                      │
│                                                                      │
│  ┌─── Agent A ──────────────┐  ┌─── Agent B ──────────────┐        │
│  │                          │  │                          │        │
│  │  Turns: 5               │  │  Turns: 7               │        │
│  │  Duration: 1:24         │  │  Duration: 2:01         │        │
│  │  Task completed: ✓      │  │  Task completed: ✗      │        │
│  │  Avg response: 1.2s     │  │  Avg response: 1.8s     │        │
│  │                          │  │                          │        │
│  │  ▶ Replay conversation   │  │  ▶ Replay conversation   │        │
│  │  📝 Read transcript      │  │  📝 Read transcript      │        │
│  │                          │  │                          │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│                                                                      │
│  Which agent handled the task better?                                │
│                                                                      │
│     [ Agent A ]  [ Agent B ]  [ Both bad ]  [ Tie ]                 │
│                                                                      │
│  ▸ Help us rank better — rate specific dimensions                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐      │
│  │ Naturalness  │ Task done?   │ Speed        │ Error        │      │
│  │ [A] [B] [Tie]│ [A] [B] [Tie]│ [A] [B] [Tie]│ recovery     │      │
│  │              │              │              │ [A] [B] [Tie]│      │
│  └──────────────┴──────────────┴──────────────┴──────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.5. Key UI Decisions

#### 8.5.1. Sequential, Not Simultaneous

Users talk to Agent A first, then Agent B. Not both at once. Real-time voice conversation demands full attention. Splitting between two concurrent calls would degrade both interactions and make fair comparison impossible.

#### 8.5.2. Scenario Cards

Each battle has a scenario card that describes what the user should try to accomplish:

| Category | Difficulty | Scenario |
|----------|-----------|----------|
| Booking | Easy | "Book a table for 2 at any Italian restaurant tonight." |
| Support | Medium | "Your internet has been down for 3 hours. Call your ISP to get it fixed." |
| Sales | Hard | "You're interested in the premium plan but think it's too expensive. Negotiate a discount." |
| Medical | Hard | "Describe symptoms of intermittent chest pain to a triage nurse. Be vague initially." |
| Adversarial | Hard | "Deliberately give contradictory information. See how the agent handles confusion." |

#### 8.5.3. Conversation Limits

- **Max turns:** 8-10 turns per agent.
- **Max duration:** 90 seconds per agent (hard cutoff with warning at 60s).
- **Min turns:** 2 (user must actually interact).

#### 8.5.4. Live Transcript

During the conversation, show a running transcript beneath the waveform. Helps users track what was said and notice transcription errors in real-time.

#### 8.5.5. Replay Before Voting

After talking to both agents, the voting screen lets users replay either conversation's audio and read the full transcript. Users can't be expected to remember details from a 90-second conversation they had 2 minutes ago.

#### 8.5.6. Two Models Only

Agent battles are 2-model only. Having the user repeat the same conversation 3-4 times would destroy completion rates.

### 8.6. Voting Question

"Which agent handled the task better?"

Required: overall vote. Optional: naturalness, task completion, speed, error handling (same tap-based pattern as S2S).

### 8.7. Post-Vote Reveal Metrics

| Metric | Description |
|--------|-------------|
| Task Success | Did the agent accomplish the goal? (binary) |
| Turns to completion | Efficiency (fewer = better) |
| Avg response latency | Mean time between user finish and agent start |
| Containment | Resolved without escalation? |
| Intent accuracy | Did the agent understand what the user wanted? |
| JGA | Joint Goal Accuracy — all slots correctly filled? |
| Coherence | LLM-as-judge score on conversation quality |
| Error recovery | How did the agent handle misunderstandings? |
| Full transcript | Expandable transcript with timestamps |

---

## 9. Database Schema Changes

### 9.1. `models` Table — Add `model_type`

```sql
ALTER TABLE models ADD COLUMN model_type TEXT NOT NULL DEFAULT 'tts';
-- Allowed values: 'tts', 'stt', 's2s', 'agent'
-- A model can only belong to one type.
-- Providers like Deepgram appear multiple times (once as STT, once as TTS).

ALTER TABLE models ADD CONSTRAINT chk_model_type
  CHECK (model_type IN ('tts', 'stt', 's2s', 'agent'));
```

### 9.2. `battles` Table — Add `battle_type`

```sql
ALTER TABLE battles ADD COLUMN battle_type TEXT NOT NULL DEFAULT 'tts';

ALTER TABLE battles ADD CONSTRAINT chk_battle_type
  CHECK (battle_type IN ('tts', 'stt', 's2s', 'agent'));
```

### 9.3. Model-Battle Type Alignment (Database Constraint)

ELO integrity is too important to rely on application code alone. Enforce that all models in a battle share the same `model_type` matching `battle_type`:

```sql
-- Enforce via trigger: on INSERT to battle_models (or evaluations),
-- verify that the model's model_type matches the battle's battle_type.

CREATE OR REPLACE FUNCTION check_battle_model_type_match()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT model_type FROM models WHERE id = NEW.model_id) !=
       (SELECT battle_type FROM battles WHERE id = NEW.battle_id) THEN
        RAISE EXCEPTION 'Model type does not match battle type';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_battle_model_type
    BEFORE INSERT ON evaluations
    FOR EACH ROW
    EXECUTE FUNCTION check_battle_model_type_match();
```

### 9.4. `battles` Table — Add Input Audio (for STT/S2S)

```sql
ALTER TABLE battles ADD COLUMN input_audio_path TEXT;
-- For STT: the audio clip being transcribed
-- For S2S: the user's spoken input
-- For TTS: NULL (input is text, already stored as prompt)
```

### 9.5. `evaluations` Table — Add Transcript Output (for STT)

```sql
ALTER TABLE evaluations ADD COLUMN transcript_output TEXT;
-- For STT: the model's transcription result
-- For other modes: NULL
```

### 9.6. New Table: `agent_conversations`

```sql
CREATE TABLE agent_conversations (
    id UUID PRIMARY KEY,
    battle_id UUID REFERENCES battles(id),
    model_label TEXT NOT NULL,          -- 'a' or 'b'
    turns_json JSONB NOT NULL,          -- [{role, text, audio_path, timestamp_ms}]
    total_turns INT,
    duration_seconds FLOAT,
    avg_response_latency_ms FLOAT,
    task_success BOOLEAN,
    transcript_full TEXT,               -- concatenated transcript
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.7. New Table: `audio_clips` (for STT battle library)

```sql
CREATE TABLE audio_clips (
    id UUID PRIMARY KEY,
    category TEXT NOT NULL,             -- 'clean', 'noisy', 'accented', etc.
    difficulty TEXT NOT NULL,           -- 'easy', 'medium', 'hard'
    audio_path TEXT NOT NULL,
    ground_truth TEXT NOT NULL,         -- reference transcript
    duration_seconds FLOAT,
    language TEXT DEFAULT 'en',
    tags JSONB,                         -- ['medical', 'fast_speech', 'indian_accent']
    source TEXT,                        -- 'curated', 'user_recorded'
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.8. `leaderboard_snapshots` — Add `battle_type`

```sql
ALTER TABLE leaderboard_snapshots ADD COLUMN battle_type TEXT NOT NULL DEFAULT 'tts';
-- Each snapshot is now mode-specific. Queries filter by battle_type.
```

### 9.9. Provider Analytics Tables (for Tiered Access)

```sql
CREATE TABLE provider_analytics (
    id UUID PRIMARY KEY,
    model_id UUID REFERENCES models(id),
    battle_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_battles INT,
    win_rate FLOAT,
    win_rate_by_category JSONB,         -- {"medical": 0.72, "clean": 0.85}
    latency_p50_ms FLOAT,
    latency_p95_ms FLOAT,
    latency_p99_ms FLOAT,
    head_to_head JSONB,                 -- {"model_uuid": {"wins": 45, "losses": 32}}
    feedback_themes JSONB,              -- aggregated, anonymized user feedback
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, period_start, period_end)
);
```

---

## 10. API Changes

### 10.1. Battle Generation

```
POST /api/v1/battles/generate
Body: { "battle_type": "tts" | "stt" | "s2s" | "agent" }
```

The existing endpoint currently assumes TTS. Extend to accept `battle_type` and dispatch to mode-specific generation logic:

- **TTS:** Same as current (select prompt → generate audio via TTS providers → return audio URLs).
- **S2S:** Accept user audio input → send to N S2S providers via WebSocket → collect responses → return audio URLs + latency.
- **STT:** Select audio clip from library → send to N STT models → return transcript outputs.
- **Agent:** Return a scenario + WebSocket URLs for live agent connections.

### 10.2. S2S Battle Flow (Two-Step)

```
-- Step 1: Create battle
POST /api/v1/battles/generate
Body: { "battle_type": "s2s" }
Response: { "id": "battle-uuid", "battle_type": "s2s" }

-- Step 2: Upload user audio and trigger model generation
POST /api/v1/battles/{id}/input-audio
Body: multipart/form-data with audio file

Response (after all models respond): {
    "id": "battle-uuid",
    "battle_type": "s2s",
    "input_audio_url": "https://...",
    "input_transcript": "What's the weather...",
    "responses": {
        "a": { "audio_url": "https://...", "e2e_latency_ms": 1800, "ttfb_ms": 320 },
        "b": { "audio_url": "https://...", "e2e_latency_ms": 2400, "ttfb_ms": 890 }
    }
}
```

Note: Response is returned only after ALL models have responded (gated playback). Model-to-position assignment (a/b) is randomized server-side.

### 10.3. STT Battle Generation

```
POST /api/v1/battles/generate
Body: { "battle_type": "stt", "audio_clip_id": "optional-uuid" }

Response: {
    "id": "battle-uuid",
    "battle_type": "stt",
    "audio_clip_url": "https://...",
    "audio_clip_category": "medical",
    "ground_truth": null,              // hidden until after vote
    "transcripts": {
        "a": { "text": "Patient describes...", "latency_ms": 340, "word_count": 142 },
        "b": { "text": "Patient describes...", "latency_ms": 210, "word_count": 142 },
        "c": { "text": "Patient describe...",  "latency_ms": 520, "word_count": 141 }
    }
}
```

### 10.4. Agent Battle — WebSocket Protocol

Agent battles require real-time bidirectional audio streaming.

```
WS /api/v1/battles/{id}/agent/{label}

-- Client sends: audio chunks (binary frames)
-- Server sends: {
--     "type": "agent_audio" | "agent_transcript" | "turn_end" | "conversation_end",
--     "data": ...
-- }
```

The API server proxies between the user's WebSocket connection and the underlying agent provider's streaming API.

### 10.5. Post-Vote Metrics Endpoint

```
GET /api/v1/battles/{id}/metrics

Response: {
    "status": "computing" | "partial" | "complete",
    "metrics": {
        "a": {
            "transcript": "Right now in SF...",     // available at ~2s
            "utmos": 4.2,                            // available at ~3-5s
            "prosody_score": 0.87,                   // available at ~3-5s
            "relevance_score": 0.94                  // available at ~3-5s
        },
        "b": { ... }
    }
}
```

Frontend polls this endpoint after vote submission to progressively fill in the reveal screen.

### 10.6. Vote Endpoint (Unified)

```
POST /api/v1/battles/{id}/vote
Body: {
    "winner": "a" | "b" | "c" | "d" | "tie" | "all_bad",
    "sub_votes": {                          // optional, for S2S and agent mode
        "answer_quality": "a" | "b" | "tie",
        "voice_quality": "a" | "b" | "tie",
        "naturalness": "a" | "b" | "tie",      // agent only
        "task_completion": "a" | "b" | "tie",   // agent only
        "speed": "a" | "b" | "tie",             // agent only
        "error_handling": "a" | "b" | "tie"     // agent only
    }
}
```

### 10.7. Leaderboard — Add Mode Filter

```
GET /api/v1/leaderboard?battle_type=s2s
```

Returns rankings filtered by mode. Default: `tts` (backward compatible).

### 10.8. Provider Analytics Endpoint (Paid Tier)

```
GET /api/v1/analytics/model/{model_id}
Headers: X-API-Key: <provider-api-key>

Response: {
    "model": "...",
    "battle_type": "s2s",
    "period": "2026-02-01 to 2026-02-21",
    "total_battles": 342,
    "overall_win_rate": 0.68,
    "win_rate_by_category": { ... },
    "latency_percentiles": { "p50": 1200, "p95": 2800, "p99": 4100 },
    "head_to_head": { ... },
    "feedback_themes": [ ... ]
}
```

---

## 11. Leaderboard Page Changes

### 11.1. Mode Tabs on Leaderboard

The leaderboard page gets the same horizontal tab strip as the battle page:

```
[ 🔊 TTS ]  [ 🔄 S2S ]  [ 🎤 STT ]  [ 🤖 Agent ]
```

Tab order matches build priority (TTS, S2S, STT, Agent).

Each tab shows a separate leaderboard with mode-appropriate columns:

**TTS Leaderboard Columns:** Rank, Model, Provider, ELO, Win Rate, Battles, Avg UTMOS, Avg Prosody, Avg TTFB

**S2S Leaderboard Columns:** Rank, Model, Provider, ELO, Win Rate, Battles, Avg E2E Latency, Avg UTMOS, Avg Relevance

**STT Leaderboard Columns:** Rank, Model, Provider, ELO, Win Rate, Battles, Avg WER, Avg SeMaScore, Avg Latency

**Agent Leaderboard Columns:** Rank, Model/Platform, Provider, ELO, Win Rate, Battles, Task Success Rate, Avg Latency, Avg Turns

### 11.2. Cross-Mode Summary (Optional, V2)

A "Summary" tab showing a radar chart per provider across all modes they participate in. This answers: "Deepgram is great at STT, but how's their TTS?"

---

## 12. Shared Components

### 12.1. Components Reused Across Modes

| Component | TTS | S2S | STT | Agent |
|-----------|-----|-----|-----|-------|
| AudioPlayerCard | ✓ (output) | ✓ (output) | ✓ (input clip) | ✗ |
| VoteButton strip | ✓ | ✓ | ✓ | ✓ |
| DimensionVoter (optional) | ✗ | ✓ | ✗ | ✓ |
| Post-vote model reveal | ✓ | ✓ | ✓ | ✓ |
| WaveformVisualizer | ✓ | ✓ | ✓ | ✓ |
| MetricsTable | ✓ | ✓ | ✓ | ✓ |
| BattleHeader (mode tabs + counter) | ✓ | ✓ | ✓ | ✓ |
| Scenario/category badge | ✓ | ✗ | ✓ | ✓ |

### 12.2. New Components Needed

| Component | Used by | Description |
|-----------|---------|-------------|
| ModeSelector | All modes | Horizontal pill tabs with mode icons, tab order: TTS, S2S, STT, Agent |
| InputModeSelector | S2S | Two equally-weighted buttons: "Speak your own" / "Use curated prompt" |
| AudioRecorder | S2S, Agent | Push-to-talk button with live waveform + Whisper transcript |
| TranscriptCard | STT | Monospace text card with word count, diff overlay |
| ConversationThread | Agent | Chat-like transcript with turn-by-turn messages |
| ConversationPlayer | Agent | Audio replay of entire conversation |
| DimensionVoter | S2S, Agent | Quick-tap A/B/Tie pairwise voting for optional sub-dimensions |
| DiffOverlay | STT | Green/red/orange character-level diff visualization |
| GatedLoadingState | S2S | "Models are responding... (2.1s)" — hides cards until all models finish |
| ProgressiveReveal | S2S, STT | Skeleton-loader metric slots that fill in as post-vote metrics compute |

---

## 13. Implementation Phases

### Phase 1: Infrastructure + S2S Backend (2 weeks)

**Week 1: Schema + Multi-Mode Infrastructure**
- Add `battle_type` to battles table (migration) with CHECK constraint
- Add `model_type` to models table with CHECK constraint
- Add trigger to enforce model_type/battle_type alignment on evaluations
- Extend `POST /battles/generate` to accept `battle_type` param
- Build `POST /battles/{id}/input-audio` endpoint for S2S audio upload
- Implement S2S battle generation: accept audio → fan out to providers via WebSocket → collect responses → store audio → return URLs
- Implement gated response: wait for all models, randomize positions
- Integrate 2 S2S providers: OpenAI Realtime, Hume EVI

**Week 2: S2S Frontend + Post-Vote Pipeline**
- Build ModeSelector component (tabs: TTS active, S2S active, STT coming soon, Agent coming soon)
- Build InputModeSelector (two equal buttons: speak / curated)
- Build AudioRecorder component (browser MediaRecorder API + Whisper transcript)
- Build GatedLoadingState component
- Build S2S battle page layout
- Build post-vote metrics endpoint (`GET /battles/{id}/metrics`)
- Build ProgressiveReveal component for post-vote screen
- Add `battle_type` filter to leaderboard API and page
- Seed S2S models into database

### Phase 2: S2S Polish + STT (2 weeks)

**Week 3: S2S Polish + STT Backend**
- Integrate 1-2 more S2S providers (Moshi, Gemini Live)
- Build curated S2S prompt library (20+ prompts across categories)
- Build `audio_clips` table + seed with 50 curated clips across 8 STT categories
- Implement STT battle generation (select clip → call N STT APIs → return transcripts)
- Integrate 3 STT providers: Deepgram Nova-3, OpenAI Whisper API, Google Cloud STT

**Week 4: STT Frontend**
- Build TranscriptCard component with monospace display
- Build DiffOverlay component for post-vote ground truth comparison
- Build STT battle page layout (single audio player + transcript grid)
- Build STT post-vote reveal with diff + WER/SeMaScore
- Seed STT models into database

### Phase 3: Voice Agent (3-4 weeks)

**Week 5-6: Backend**
- Design WebSocket proxy architecture for real-time agent streaming
- Implement agent battle orchestration (scenario selection → WS connections → turn tracking)
- Integrate 2 agent providers: Vapi + Retell (or Bland)
- Build `agent_conversations` table + turn logging
- Implement conversation limits (max turns, max duration)

**Week 7-8: Frontend**
- Build ConversationThread component (live updating chat transcript)
- Build sequential agent flow (talk to A → transition screen → talk to B)
- Build agent voting page with conversation replay + DimensionVoter
- Build agent post-vote reveal with task success, JGA, coherence metrics
- Add Agent tab to leaderboard

### Phase 4: Provider Analytics + Polish (1-2 weeks)

- Build `provider_analytics` table + background job to compute periodic analytics
- Build provider analytics API endpoint (paid tier, API key authenticated)
- Audio clip recording for STT (user-contributed clips)
- Cross-mode provider summary on leaderboard
- Mobile optimization for all modes
- Error handling, loading states, edge cases
- Analytics: track battle completion rates per mode

---

## 14. Key Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| S2S provider API instability | High | Start with OpenAI Realtime (most stable). Fallback to cascaded STT+LLM+TTS if S2S fails. |
| S2S backend proxy latency | Medium | Gated playback absorbs proxy overhead. Monitor added latency and optimize connection pooling. |
| Agent battle WebSocket complexity | High | Use existing agent-as-a-service APIs (Vapi, Retell) which handle WS themselves. KoeCode proxies, doesn't build the agent runtime. |
| STT ground truth quality | Medium | Use professionally transcribed audio for curated clips. For user-recorded: accept that some battles won't have ground truth. |
| Low completion rates for Agent mode | Medium | Keep conversations short (60-90s). Show progress ("Turn 3 of 8"). Make the scenario card engaging. |
| Browser microphone permissions | Low | Equal-weight curated prompts as alternative. Show clear permission request UI. |
| ELO pool fragmentation | Low | Acceptable tradeoff. Each mode needs 100+ battles for meaningful rankings. Prioritize TTS+S2S volume first. |
| Provider partnership conflicts | Medium | Paid tier buys analytics, not influence. Ranking methodology is independent and transparent. |
| Primacy bias in S2S listening | Low | Solved by gated playback + randomized positions. |

---

## 15. Metrics for Success

| Metric | Target | Timeframe |
|--------|--------|-----------|
| S2S battles per day | 30+ | 2 weeks after launch |
| STT battles per day | 50+ | 2 weeks after STT launch |
| Agent battles per day | 20+ | 4 weeks after Agent launch |
| Battle completion rate (S2S) | >70% | Steady state |
| Battle completion rate (STT) | >80% | Steady state |
| Battle completion rate (Agent) | >60% | Steady state |
| Models per mode | 4+ TTS, 2+ S2S, 3+ STT, 2+ Agent | At each mode's launch |
| Leaderboard convergence | Stable top-3 ranking | 500 battles per mode |
| Optional dimension vote rate | >30% of voters | Steady state |
| Provider paid tier conversion | 2+ providers | 3 months after S2S launch |
