# VoiceLoop Frontend Redesign

**Date:** 2026-02-16
**Status:** Draft
**Scope:** Complete redesign of the VoiceLoop landing page frontend

---

## 1. Context

The current VoiceLoop landing page uses a generic SaaS template aesthetic — small feature cards in a 2-column grid with toy-like SVG diagrams, a pixel-art particle wave animation, gradient-filled CTAs, and cramped layouts. It communicates "dev tool starter kit" rather than "serious infrastructure platform."

VoiceLoop is a harness for voice AI applications with genuinely novel capabilities: an Intent API that computes 18-dimensional intent vectors, a Sidecar that reasons over strategy catalogs in real-time, a Voice Evals Arena, and Text-to-Agent. The frontend needs to communicate this sophistication.

**Design reference:** Cartesia.ai — enterprise-grade, atmospheric, confident. Full-width immersive sections, organic gradient visuals, massive typography, annotated product demos.

---

## 2. Design System

### 2.1 Typography

| Role | Current | New |
|------|---------|-----|
| Display/Headlines | DM Serif Display | Instrument Serif |
| Body/UI | DM Sans | Inter or Geist Sans |
| Mono/Code | JetBrains Mono | JetBrains Mono (keep) |

- Hero headline: 72-80px desktop, 44-48px mobile
- Feature section headlines: 48-56px desktop, 32-36px mobile
- Body text: 16-18px, relaxed line-height
- Mono labels: 11-12px, uppercase, wide tracking

### 2.2 Color Palette

```css
/* Backgrounds */
--color-bg-primary: #08090D;       /* near-black, unchanged */
--color-bg-surface: #0F1118;       /* card/surface background */
--color-bg-surface-header: #0B0D14;
--color-bg-hover: #161822;

/* Borders */
--color-border-default: #1C1E2E;
--color-border-strong: #282A3A;

/* Text — 3 levels */
--color-text-primary: #EEEEF3;     /* headings, primary content */
--color-text-body: #888899;        /* body paragraphs */
--color-text-faint: #4E4E5E;       /* labels, metadata */

/* Accent — refined teal (slightly warmer) */
--color-accent: #2DD4A8;           /* was #14b8a6 */
--color-accent-secondary: #34d399; /* emerald complement */

/* Code */
--color-code-keyword: #5eead4;
--color-code-string: #34d399;
```

Key change: accent shifts from `#14b8a6` to `#2DD4A8` — slightly brighter, warmer, less "default Tailwind teal."

### 2.3 CTAs & Buttons

- **Primary CTA:** Solid accent background, white text, rounded-lg. No gradients.
- **Secondary CTA:** Ghost/outlined — transparent background, subtle border, accent or white text.
- **Hover states:** Subtle glow (`box-shadow`) rather than color shifts.

### 2.4 Layout & Spacing

- Max-width expands to **1280px** for feature sections.
- Text blocks constrained to **560px** max for readability within wider sections.
- Section vertical padding: **120-160px**.
- Feature sections use **split layouts**: ~40% text, ~60% visual, alternating sides.

### 2.5 Texture & Atmosphere

- **Noise overlay:** Keep but reduce opacity to ~0.02 (barely perceptible).
- **Dot-grid:** Used sparingly as decorative card borders (top edges), not full backgrounds.
- **Aurora gradients:** Layered CSS radial-gradients with teal/emerald/cyan blending. Used behind hero and feature visuals. Optionally animated with a very slow CSS shimmer (opacity oscillation or subtle translate).
- **Section dividers:** Gradient line `from-transparent via-border-default to-transparent` with a soft blur halo behind.

---

## 3. Page Structure

```
Announcement Bar
Navbar
Hero (centered headline + subtitle + CTAs + aurora gradient)
Interactive Demo Card (turn simulation with intent vectors)
Feature 1: Intent API
Feature 2: Decision Intelligence (Sidecar)
Feature 3: Voice Evals Arena
Feature 4: Text-to-Agent
Social Proof Bar
Code Section
CTA Card
Footer
```

---

## 4. Section-by-Section Design

### 4.1 Announcement Bar

A slim bar above the navbar, full-width, with a dark green-to-transparent gradient background.

- Height: ~36-40px
- Text: "Introducing VoiceLoop v1 — the complete harness for voice AI agents" + "Learn more >" link in accent
- Font: mono, 12-13px
- Background: `linear-gradient(90deg, transparent, rgba(45, 212, 168, 0.08), transparent)`
- Dismissible (X button on right, optional)

### 4.2 Navbar

Clean horizontal bar. Fixed on scroll with backdrop-blur.

**Left:** VoiceLoop logo + wordmark
**Center:** Nav links — Product, Solutions, Resources, Pricing, Blog
**Right:** "Contact Sales" (text link) + "Sign in" (subtle bordered button) + "Start for Free" (bordered/filled button)

- Height: 64px
- Background: transparent, transitions to `bg-bg-primary/80 backdrop-blur-xl` on scroll
- Links: 13-14px, Inter/Geist, medium weight, `text-text-body` with `hover:text-text-primary`
- "Start for Free" button: bordered, rounded-full or rounded-lg, 13px font, no gradient

### 4.3 Hero

Centered layout. Text dominates the viewport.

**Structure (top to bottom):**

1. **Category label:** `THE VOICE AI PLATFORM` — 11px mono, uppercase, accent color, wide tracking (0.15em)
2. **Headline:** "Voice agents that think before they speak" — 72-80px Instrument Serif, `text-text-primary`, tight tracking (-0.01em), line-height 1.1
3. **Subtitle:** "VoiceLoop is the harness for production voice agents. It measures intent as a mathematical function, reasons over strategy in real-time, and reconfigures your agent every turn." — 18px Inter, `text-text-body`, max-width 600px, centered
4. **CTAs:** Two buttons side by side, centered:
   - "Start for Free" — solid accent bg, white text, rounded
   - "Contact Sales" — ghost/outlined, rounded
5. **Aurora gradient field:** Below the CTAs, spanning full width. A large atmospheric visual (300-400px tall) with layered radial gradients:
   - Teal center bloom
   - Emerald offset right
   - Cyan offset left
   - Organic undulation shape (achieved via ellipse sizing and positioning) suggesting a waveform silhouette
   - Optional: very slow CSS animation (opacity pulse or gentle vertical translate)

**Animations:**
- Staggered fade-in from top: label → headline → subtitle → CTAs (using Framer Motion, 0.15s delays)
- Aurora fades in last with scale-up from 0.95

### 4.4 Interactive Demo Card

Positioned below the hero aurora. A large dark card (~80% max-width, centered) that demonstrates the product in action.

**Card structure:**

- Rounded-2xl, `bg-bg-surface`, `border border-border-default`
- Dot-grid decorative pattern along top edge (2px height, like Cartesia's accuracy section)
- Padding: 40-48px

**Inside the card:**

1. **User utterance:** Large text (20-22px) in a slightly elevated container:
   ```
   "I guess we could try Bali... if that's not too expensive?"
   ```
   Key phrases highlighted/annotated — "I guess" tagged as [hedge], "if that's not too expensive" tagged as [price_concern]. Highlights use subtle accent background.

2. **Intent vector visualization:** Below the utterance, a horizontal bar visualization showing the 18-dimension vector (or a subset of 6-8 most relevant dimensions):
   ```
   hedging        ████████████████████████░░░░  0.72
   requesting     ██████████████████████████░░  0.82
   frustrated     ██████████████░░░░░░░░░░░░░░  0.45
   exploring      █████████░░░░░░░░░░░░░░░░░░░  0.35
   committed      ███░░░░░░░░░░░░░░░░░░░░░░░░░  0.12
   excited        ████████████░░░░░░░░░░░░░░░░  0.40
   ```
   Bars animate in on scroll (staggered). Color intensity increases with value. Labels in mono 11px.

   Below bars: `dominant_signals` annotation: "F0 slope: 0.38, hedge word density: 0.31" in `text-text-faint` mono.

3. **Sidecar reasoning output:** A subtle card-within-card (slightly darker bg) showing the decision:
   ```
   Strategy: exploratory_guidance → empathetic_acknowledgment
   Activated: apply_discount (retention lever)
   Reasoning: "Frustration rising over 3 turns (0.20 → 0.35 → 0.45).
              Switching to empathetic. Activating discount."
   ```
   Strategy change shown with a green arrow. Reasoning in italic/lighter weight.

4. **Domain tabs** along the bottom of the card:
   - **Travel Booking** (active) / **Customer Support** / **Healthcare** / **Financial Services**
   - Each tab icon + label, pill-shaped, the active tab has accent border/bg
   - Switching tabs would change the utterance, intent vector, and reasoning (can be static content per tab, not truly interactive)

**Animations:**
- Card fades in on scroll
- Inside: utterance appears first, then intent bars stagger in (0.05s delay each), then sidecar reasoning fades in last
- Tab switching: crossfade content (Framer AnimatePresence)

### 4.5 Feature 1: Intent API — "Intent as a Function"

**Layout:** Text left (~40%), visual right (~60%). Full-width section with 140px vertical padding.

**Text side:**
- Small mono label: `INTENT API` in accent, uppercase, tracked
- Headline: "Intent is not a label. It's a measurement." — 48-56px Instrument Serif
- Body (16px Inter, text-text-body, max-width 440px): "Traditional voice AI classifies intent into buckets — booking, complaint, inquiry. VoiceLoop computes a graded 18-dimensional intent vector from prosody, semantics, user history, and context. Every dimension scored 0.0 to 1.0. Every score explainable."
- Small detail list (optional):
  - "18 intent dimensions across 4 clusters"
  - "Explainable attention weights"
  - "2-5M parameter composition engine"

**Visual side:**
- A radar/spider chart or parallel-coordinates visualization showing the 18-dimensional vector
- The 4 clusters (pragmatic, commitment, emotional, conversational) color-coded
- Animated: dimensions pulse/grow on scroll-in
- Below the chart: a small annotation box showing dominant signals with attention weight contributions
- Aurora gradient glow behind the visual (teal, subtle)

**Background:** Subtle radial-gradient atmosphere, no dot-grid on this section.

### 4.6 Feature 2: Decision Intelligence — "The Sidecar"

**Layout:** Text right (~40%), visual left (~60%). Alternating from Feature 1.

**Text side:**
- Mono label: `DECISION INTELLIGENCE`
- Headline: "From automation to decision intelligence" — 48-56px
- Body: "The Sidecar consumes intent vectors every turn, reads frustration trends over the last 3 turns, reasons over domain-specific strategy and tool catalogs, and reconfigures your voice agent's behavior, tools, and personality in real-time. Not if-then rules. Reasoning."
- Detail bullets:
  - "Per-turn strategy reconfiguration"
  - "Dynamic tool activation/deactivation"
  - "Anti-flapping built in"

**Visual side:**
- The turn loop as an elegant vertical flow:
  ```
  User speaks
       ↓
  Intent Vector [compact bar viz]
       ↓
  Session History [sparkline showing 3-turn frustration trend]
       ↓
  Sidecar Reasons [strategy shift card]
       ↓
  Agent Reconfigured [tool list with on/off toggles]
  ```
- Each step is a small dark card connected by gradient lines
- The strategy shift is highlighted: `exploratory_guidance → empathetic_acknowledgment` with a green badge
- Tools show as pills: `search_flights` (on), `apply_discount` (newly activated, green pulse), `create_booking` (off, dimmed)
- Animated: each step fades in top-to-bottom on scroll (staggered 0.1s)

### 4.7 Feature 3: Voice Evals Arena

**Layout:** Text left, visual right.

**Text side:**
- Mono label: `VOICE EVALS ARENA`
- Headline: "Pit your agents against each other" — 48-56px
- Body: "Run head-to-head evaluations of different agent configurations, strategies, and prompt versions. See which one handles edge cases, maintains composure under frustration, and drives outcomes. An arena for voice agent quality."
- Detail bullets:
  - "Side-by-side agent comparison"
  - "Scenario-based stress testing"
  - "Statistical significance scoring"

**Visual side:**
- Arena-style comparison UI mockup — a dark card showing two agent configs side by side:
  ```
  Agent A: v3.1                    Agent B: v3.2 (challenger)
  ─────────────────────            ─────────────────────
  Empathy score:  0.72             Empathy score:  0.89  ✓
  Resolution:     0.85             Resolution:     0.91  ✓
  Avg latency:    340ms            Avg latency:    285ms ✓
  Frustration ↑:  3 calls          Frustration ↑:  1 call ✓
  ─────────────────────            ─────────────────────
  Overall: 78.2                    Overall: 91.4 ★
  ```
- The winning scores highlighted in accent green
- A "Champion" badge on the winning agent
- Aurora gradient glow behind

### 4.8 Feature 4: Text-to-Agent

**Layout:** Text right, visual left.

**Text side:**
- Mono label: `TEXT-TO-AGENT`
- Headline: "Describe it. Deploy it." — 48-56px
- Body: "Write a natural language description of the voice agent you need. VoiceLoop generates the strategy catalog, tool configuration, intent dimensions, and system prompts. Go from idea to production agent in minutes."

**Visual side:**
- A two-panel transformation visual:
  - **Left panel (input):** A text input/prompt area showing:
    ```
    "A travel booking agent that handles flight and hotel
    searches, is empathetic when users are frustrated,
    offers discounts to retain hesitant customers, and
    escalates to human support after sustained frustration."
    ```
  - **Arrow/transformation indicator** in the middle (animated gradient arrow)
  - **Right panel (output):** A compact generated config showing:
    ```
    Domain: travel_booking
    Strategies: 5 generated
    Tools: 6 configured
    Intent dimensions: 18 calibrated
    Status: Ready to deploy ✓
    ```
- Subtle particle/shimmer animation on the transformation arrow
- Aurora gradient glow behind

### 4.9 Social Proof Bar

Centered section, generous vertical padding (100px).

- Label: "Built for the voice AI stack" — 11px mono, uppercase, `text-text-faint`, tracked
- Below: provider names in a horizontal row, generously spaced (gap-12+)
  - ElevenLabs, Vapi, Cartesia, Deepgram, OpenAI, Ultravox
  - Styled as text with distinct font weight (semibold, 16px) in `text-text-faint/60`
  - If actual logos available, use those at ~20px height, grayscale/muted
- No cards, no borders — just floating names/logos

### 4.10 Code Section

**Headline:** "A few lines to production" — centered, 44px Instrument Serif
**Subtitle:** "Integrate VoiceLoop in minutes with our SDKs." — 16px, `text-text-body`

**Code card:**
- Single large code block, centered, max-width ~720px
- Rounded-2xl, `bg-bg-surface`, `border border-border-default`
- Dot-grid decorative border along the top edge (2px)
- Tabs above code: **Python** / **TypeScript** / **cURL**
- Copy button top-right

**Python example:**
```python
from voiceloop import VoiceLoop

client = VoiceLoop(api_key="vl_...")

# Post a turn — get a decision
directive = client.turns.create(
    call_id="call_abc123",
    intent_vector=intent_api.compute(audio, transcript),
    transcript="I guess we could try Bali..."
)

print(directive.strategy)      # "empathetic_acknowledgment"
print(directive.active_tools)  # ["search_flights", "apply_discount"]
print(directive.reasoning)     # "Frustration rising..."
```

**Below the code card:** 3 small stat callouts in a horizontal row, centered:
- "< 5 min setup" / "3 SDKs" / "99.9% uptime"
- Mono, 12px, `text-text-faint`, separated by dot dividers

### 4.11 CTA Card

Full-width section with centered card (matching current structure but elevated).

- Card: rounded-2xl, border, with aurora gradient background inside (layered radial-gradients)
- Headline: "Start building intelligent voice agents" — 36-40px Instrument Serif
- Subtitle: "Free to start. Scale as you grow." — 16px, `text-text-body`
- Two CTAs: "Start for Free" (solid accent) + "Talk to Sales" (ghost)
- Generous padding: 80-100px vertical

### 4.12 Footer

Clean, minimal footer.

**Top row:** 4-column grid
- **Column 1 (brand):** "VoiceLoop" text wordmark + one-line description + GitHub/Twitter icons + email newsletter input (email field + arrow submit button)
- **Column 2 (Product):** Features, Pricing, Changelog, Roadmap
- **Column 3 (Developers):** Documentation, API Reference, SDKs, Status
- **Column 4 (Company):** About, Blog, Careers, Contact

**Bottom row:** Copyright left, Privacy/Terms links right. Separated by `border-t`.

---

## 5. Component Architecture

### New components to create:
- `AnnouncementBar.tsx` — dismissible top bar
- `InteractiveDemo.tsx` — the turn simulation demo card with tabs
- `IntentApiSection.tsx` — Feature 1
- `DecisionIntelligenceSection.tsx` — Feature 2
- `EvalsArenaSection.tsx` — Feature 3
- `TextToAgentSection.tsx` — Feature 4
- `SocialProof.tsx` — provider logos/names bar
- `AuroraGradient.tsx` — reusable atmospheric gradient component

### Components to heavily modify:
- `Navbar.tsx` — new link structure, button styles, announcement bar integration
- `Hero.tsx` — completely rewritten: centered layout, new copy, aurora visual
- `CodeSection.tsx` — simplified to single panel, new code examples, stat callouts
- `Footer.tsx` — newsletter input, updated copy
- `index.css` — updated theme variables (accent color, new fonts), new utility classes

### Components to remove:
- `ParticleWaveField.tsx` — replaced by aurora gradient
- `Features.tsx` — replaced by 4 individual feature section components

### External dependencies:
- Google Fonts: add Instrument Serif, add Inter (or Geist if self-hosted)
- No new npm packages needed (Framer Motion + Tailwind handles everything)

---

## 6. Animation Strategy

All animations use Framer Motion with `whileInView` for scroll-triggered reveals.

| Element | Animation | Duration | Delay |
|---------|-----------|----------|-------|
| Section headings | fade-up (y: 16 → 0, opacity) | 0.5s | 0s |
| Body text | fade-up | 0.5s | 0.1s |
| Feature visuals | fade-up + scale (0.96 → 1) | 0.6s | 0.2s |
| Intent vector bars | width grow (0 → full) | 0.5s | staggered 0.05s each |
| Demo card content | sequential fade-in (utterance → bars → reasoning) | 0.4s each | staggered 0.15s |
| Aurora gradient | fade-in + scale (0.95 → 1) | 0.8s | 0.4s |
| Tab content switch | crossfade (AnimatePresence) | 0.3s | 0s |

No continuous animations except the aurora's optional slow opacity pulse (CSS, 8-12s cycle).

---

## 7. Responsive Strategy

| Breakpoint | Layout changes |
|------------|---------------|
| Desktop (1024px+) | Full split layouts (40/60), 72-80px headlines, 1280px max-width |
| Tablet (768-1023px) | Stacked layouts (text above visual), 48px headlines, full-width sections |
| Mobile (<768px) | Single column, 36-44px headlines, demo card scrolls horizontally for intent bars, hamburger nav |

Feature sections stack to: mono label → headline → body → visual (below text).
Demo card: intent bars may need horizontal scroll or show fewer dimensions on mobile.

---

## 8. Implementation Order

1. **Design system foundations** — Update `index.css` theme vars, fonts in `index.html`, button/CTA utility classes
2. **Navbar + Announcement Bar** — New nav structure with updated links and styles
3. **Hero** — Centered layout, new copy, aurora gradient component
4. **Interactive Demo Card** — The turn simulation with intent vectors and domain tabs
5. **Feature sections (1-4)** — One at a time, each as its own component
6. **Social Proof** — Simple centered section
7. **Code Section** — Simplified single panel with new API examples
8. **CTA + Footer** — Updated styling and content
9. **Remove old components** — Delete ParticleWaveField.tsx, Features.tsx
10. **Polish** — Responsive testing, animation timing, final spacing adjustments
