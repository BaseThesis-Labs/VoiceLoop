import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Tab data ─── */

interface IntentBar {
  label: string;
  value: number;
}

interface Annotation {
  phrase: string;
  tag: string;
}

interface SidecarData {
  oldStrategy: string;
  newStrategy: string;
  activated: string;
  reasoning: string;
}

interface TabData {
  name: string;
  utterance: string;
  annotations: Annotation[];
  intents: IntentBar[];
  dominantSignals: string;
  sidecar: SidecarData;
}

const tabData: TabData[] = [
  {
    name: 'Travel Booking',
    utterance:
      'I guess we could try Bali... if that\'s not too expensive?',
    annotations: [
      { phrase: 'I guess', tag: 'hedge' },
      { phrase: "if that's not too expensive", tag: 'price_concern' },
    ],
    intents: [
      { label: 'hedging', value: 0.72 },
      { label: 'requesting', value: 0.82 },
      { label: 'frustrated', value: 0.45 },
      { label: 'exploring', value: 0.35 },
      { label: 'committed', value: 0.12 },
      { label: 'excited', value: 0.40 },
    ],
    dominantSignals: 'dominant_signals: F0_slope: 0.38, hedge_word_density: 0.31',
    sidecar: {
      oldStrategy: 'exploratory_guidance',
      newStrategy: 'empathetic_acknowledgment',
      activated: 'apply_discount',
      reasoning:
        'Frustration rising over 3 turns (0.20 \u2192 0.35 \u2192 0.45). Switching to empathetic. Activating discount as retention lever.',
    },
  },
  {
    name: 'Customer Support',
    utterance:
      'I already explained this twice \u2014 the charge is wrong and I need it fixed now.',
    annotations: [
      { phrase: 'already explained this twice', tag: 'repetition' },
      { phrase: 'I need it fixed now', tag: 'urgency' },
    ],
    intents: [
      { label: 'frustrated', value: 0.88 },
      { label: 'requesting', value: 0.75 },
      { label: 'urgent', value: 0.65 },
      { label: 'confused', value: 0.52 },
      { label: 'confirming', value: 0.08 },
      { label: 'satisfied', value: 0.05 },
    ],
    dominantSignals: 'dominant_signals: pitch_variance: 0.52, repetition_rate: 0.44',
    sidecar: {
      oldStrategy: 'standard_support',
      newStrategy: 'de_escalation',
      activated: 'transfer_to_human',
      reasoning:
        'Frustration at 0.88 with urgency 0.65. Immediate de-escalation needed. Queueing human handoff.',
    },
  },
  {
    name: 'Healthcare',
    utterance:
      "I'm not sure about the procedure... is it really necessary? Maybe I should wait.",
    annotations: [
      { phrase: "I'm not sure", tag: 'hesitancy' },
      { phrase: 'Maybe I should wait', tag: 'avoidance' },
    ],
    intents: [
      { label: 'anxious', value: 0.78 },
      { label: 'requesting', value: 0.70 },
      { label: 'confirming', value: 0.42 },
      { label: 'hesitant', value: 0.55 },
      { label: 'urgent', value: 0.38 },
      { label: 'trusting', value: 0.22 },
    ],
    dominantSignals: 'dominant_signals: speech_rate_drop: 0.41, pause_frequency: 0.38',
    sidecar: {
      oldStrategy: 'informational',
      newStrategy: 'reassuring_guidance',
      activated: 'schedule_callback',
      reasoning:
        'Anxiety elevated (0.78) with hesitancy. Shifting to reassuring tone. Offering callback for comfort.',
    },
  },
  {
    name: 'Financial Services',
    utterance:
      "What are the fees exactly? I've heard mixed things about these types of accounts.",
    annotations: [
      { phrase: 'What are the fees exactly', tag: 'scrutiny' },
      { phrase: "I've heard mixed things", tag: 'skepticism' },
    ],
    intents: [
      { label: 'cautious', value: 0.82 },
      { label: 'requesting', value: 0.68 },
      { label: 'skeptical', value: 0.58 },
      { label: 'confirming', value: 0.35 },
      { label: 'committed', value: 0.15 },
      { label: 'frustrated', value: 0.28 },
    ],
    dominantSignals: 'dominant_signals: qualifier_density: 0.45, question_rising: 0.39',
    sidecar: {
      oldStrategy: 'transactional',
      newStrategy: 'trust_building',
      activated: 'compliance_check',
      reasoning:
        'High caution (0.82) with skepticism. Building trust before proceeding. Adding compliance verification.',
    },
  },
];

/* ─── Annotated utterance renderer ─── */

function AnnotatedUtterance({
  utterance,
  annotations,
}: {
  utterance: string;
  annotations: Annotation[];
}) {
  // Build segments: walk through the utterance and wrap annotated phrases
  const segments: React.ReactNode[] = [];
  let remaining = utterance;
  let key = 0;

  // Sort annotations by their position in the utterance so we process left-to-right
  const sorted = [...annotations].sort(
    (a, b) => utterance.indexOf(a.phrase) - utterance.indexOf(b.phrase),
  );

  for (const ann of sorted) {
    const idx = remaining.indexOf(ann.phrase);
    if (idx === -1) continue;

    // Text before the annotated phrase
    if (idx > 0) {
      segments.push(
        <span key={key++}>{remaining.slice(0, idx)}</span>,
      );
    }

    // The annotated phrase + inline tag
    segments.push(
      <span key={key++} className="relative">
        <span className="bg-accent/[0.08] rounded px-0.5 -mx-0.5">
          {ann.phrase}
        </span>
        <span className="ml-1.5 text-[10px] font-[family-name:var(--font-mono)] text-accent/70 align-top leading-none">
          [{ann.tag}]
        </span>
      </span>,
    );

    remaining = remaining.slice(idx + ann.phrase.length);
  }

  // Trailing text
  if (remaining) {
    segments.push(<span key={key++}>{remaining}</span>);
  }

  return <>{segments}</>;
}

/* ─── Intent bar row ─── */

function IntentBar({
  intent,
  index,
}: {
  intent: IntentBar;
  index: number;
}) {
  // Map value to opacity: min 0.3, max 0.9
  const fillOpacity = 0.3 + intent.value * 0.6;

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      {/* Label */}
      <span className="w-24 shrink-0 text-[11px] font-[family-name:var(--font-mono)] text-text-faint text-right">
        {intent.label}
      </span>

      {/* Bar track */}
      <div className="flex-1 h-2 rounded-full bg-border-default overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: `rgba(45, 212, 168, ${fillOpacity})`,
          }}
          initial={{ width: 0 }}
          whileInView={{ width: `${intent.value * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 + index * 0.06, ease: 'easeOut' }}
        />
      </div>

      {/* Value */}
      <span className="w-10 shrink-0 text-[12px] font-[family-name:var(--font-mono)] text-text-body tabular-nums text-right">
        {intent.value.toFixed(2)}
      </span>
    </motion.div>
  );
}

/* ─── Main component ─── */

export default function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const current = tabData[activeTab];

  return (
    <section className="relative py-16 sm:py-20">
      <div className="max-w-[1080px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="dot-border-top rounded-2xl bg-bg-surface border border-border-default p-8 sm:p-10 lg:p-12 hover:border-border-strong transition-colors duration-300"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* ─── 1. User Utterance ─── */}
              <div className="border-l-2 border-accent/40 pl-5 sm:pl-6">
                <p className="text-[18px] sm:text-[20px] text-text-primary leading-relaxed">
                  &ldquo;
                  <AnnotatedUtterance
                    utterance={current.utterance}
                    annotations={current.annotations}
                  />
                  &rdquo;
                </p>
              </div>

              {/* ─── 2. Intent Vector Visualization ─── */}
              <div className="mt-8 space-y-2.5">
                {current.intents.map((intent, i) => (
                  <IntentBar key={intent.label} intent={intent} index={i} />
                ))}
              </div>

              {/* Dominant signals */}
              <p className="mt-4 text-[10px] font-[family-name:var(--font-mono)] text-text-faint/60 tracking-wide">
                {current.dominantSignals}
              </p>

              {/* ─── 3. Sidecar Reasoning ─── */}
              <div className="mt-6 bg-bg-hover border border-border-default rounded-xl p-5 space-y-3">
                {/* Strategy */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider">
                    Strategy:
                  </span>
                  <span className="text-[13px] font-[family-name:var(--font-mono)] text-text-faint line-through">
                    {current.sidecar.oldStrategy}
                  </span>
                  <span className="text-[13px] text-accent">&rarr;</span>
                  <span className="text-[13px] font-[family-name:var(--font-mono)] text-text-primary font-medium">
                    {current.sidecar.newStrategy}
                  </span>
                </div>

                {/* Activated */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider">
                    Activated:
                  </span>
                  <span className="text-[13px] font-[family-name:var(--font-mono)] text-accent">
                    {current.sidecar.activated}
                  </span>
                </div>

                {/* Reasoning */}
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider shrink-0 pt-0.5">
                    Reasoning:
                  </span>
                  <span className="text-[13px] text-text-body italic leading-relaxed">
                    &ldquo;{current.sidecar.reasoning}&rdquo;
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ─── 4. Domain Tabs ─── */}
          <div className="mt-8 flex flex-wrap gap-2">
            {tabData.map((tab, i) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 rounded-lg text-[12px] font-medium font-[family-name:var(--font-mono)] transition-all duration-200 ${
                  activeTab === i
                    ? 'bg-accent/10 border border-accent/20 text-accent'
                    : 'text-text-faint hover:text-text-body border border-transparent'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
