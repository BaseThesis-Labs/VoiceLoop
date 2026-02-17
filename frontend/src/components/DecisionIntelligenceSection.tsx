import { motion } from 'framer-motion';

/* ── Step data ──────────────────────────────────────────────────── */

interface Step {
  label: string;
  icon: string;
  content: React.ReactNode;
}

/* ── Step card content components ───────────────────────────────── */

function UserSpeaksContent() {
  return (
    <p className="text-[13px] text-text-body italic font-[family-name:var(--font-mono)]">
      &ldquo;I guess we could try Bali...&rdquo;
    </p>
  );
}

function IntentVectorContent() {
  const bars = [
    { label: 'hedging', value: 0.72 },
    { label: 'requesting', value: 0.82 },
    { label: 'frustrated', value: 0.45 },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2 min-w-[120px]">
          <span className="text-[10px] text-text-faint font-[family-name:var(--font-mono)] w-[72px] shrink-0">
            {bar.label}
          </span>
          <div className="flex-1 h-[6px] bg-border-default/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent/60"
              initial={{ width: 0 }}
              whileInView={{ width: `${bar.value * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            />
          </div>
          <span className="text-[10px] text-text-faint font-[family-name:var(--font-mono)] w-[28px] text-right">
            {bar.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SessionTrendContent() {
  const points = [
    { x: 5, y: 36, value: 0.20 },
    { x: 30, y: 22, value: 0.35 },
    { x: 55, y: 5, value: 0.45 },
  ];

  return (
    <div className="flex items-center gap-3">
      <svg width="60" height="40" viewBox="0 0 60 40" className="shrink-0">
        {/* Connecting line */}
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#2DD4A8"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity={0.6}
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2DD4A8" />
        ))}
      </svg>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-faint font-[family-name:var(--font-mono)]">
          frustration: 0.20 &rarr; 0.35 &rarr; 0.45
        </span>
        <span className="text-red-400/70 text-[12px]">&uarr;</span>
      </div>
    </div>
  );
}

function SidecarReasonsContent() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-[family-name:var(--font-mono)]">
        <span className="text-text-faint">Strategy:</span>
        <span className="text-text-body">exploratory</span>
        <span className="text-accent">&rarr;</span>
        <span className="text-accent">empathetic</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-[family-name:var(--font-mono)]">
        <span className="text-text-faint">Tool activated:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-text-body">apply_discount</span>
        </span>
      </div>
    </div>
  );
}

function AgentReconfiguredContent() {
  const tools = [
    { name: 'search_flights', status: 'on' as const },
    { name: 'apply_discount', status: 'new' as const },
    { name: 'create_booking', status: 'off' as const },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tools.map((tool) => {
        const isOff = tool.status === 'off';
        const isNew = tool.status === 'new';
        return (
          <span
            key={tool.name}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-[family-name:var(--font-mono)] border ${
              isOff
                ? 'border-border-default/50 text-text-faint'
                : isNew
                  ? 'border-emerald-400/40 text-emerald-400'
                  : 'border-accent/30 text-text-body'
            }`}
          >
            {isNew && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
            )}
            {tool.name}
            {isOff && (
              <span className="text-[8px] text-text-faint/60 uppercase ml-0.5">off</span>
            )}
            {isNew && (
              <span className="text-[8px] text-emerald-400/80 uppercase ml-0.5">new</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ── Step icon rendering ────────────────────────────────────────── */

const STEP_ICONS: Record<string, string> = {
  mic: '\u{1F399}',
  chart: '\u2593',
  trend: '\u2197',
  brain: '\u2699',
  check: '\u2713',
};

function StepIcon({ icon }: { icon: string }) {
  return (
    <span className="text-accent text-[14px] leading-none">{STEP_ICONS[icon] ?? icon}</span>
  );
}

/* ── Steps definition ───────────────────────────────────────────── */

const steps: Step[] = [
  {
    label: 'User speaks',
    icon: 'mic',
    content: <UserSpeaksContent />,
  },
  {
    label: 'Intent Vector',
    icon: 'chart',
    content: <IntentVectorContent />,
  },
  {
    label: 'Session Trend',
    icon: 'trend',
    content: <SessionTrendContent />,
  },
  {
    label: 'Sidecar Reasons',
    icon: 'brain',
    content: <SidecarReasonsContent />,
  },
  {
    label: 'Agent Reconfigured',
    icon: 'check',
    content: <AgentReconfiguredContent />,
  },
];

/* ── Detail bullets ─────────────────────────────────────────────── */

const details = [
  'Per-turn strategy reconfiguration',
  'Dynamic tool activation & deactivation',
  'Anti-flapping built in',
  'Explainable reasoning traces',
];

/* ── Vertical connector ─────────────────────────────────────────── */

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="h-6 w-px bg-gradient-to-b from-border-default to-accent/30" />
    </div>
  );
}

/* ── Flow diagram visual ────────────────────────────────────────── */

function FlowDiagram() {
  return (
    <div className="flex-1 w-full flex justify-center">
      <div className="max-w-[420px] w-full mx-auto">
        {steps.map((step, i) => (
          <div key={step.label}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-bg-hover border border-border-default rounded-xl p-4"
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <StepIcon icon={step.icon} />
                <span className="text-[11px] font-semibold text-text-primary font-[family-name:var(--font-mono)] uppercase tracking-[0.08em]">
                  {step.label}
                </span>
              </div>
              {step.content}
            </motion.div>
            {i < steps.length - 1 && <Connector />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main section ───────────────────────────────────────────────── */

export default function DecisionIntelligenceSection() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      {/* Gradient divider at top */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      {/* Atmospheric background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 600px 450px at 65% 35%, rgba(45, 212, 168, 0.06), transparent),
            radial-gradient(ellipse 450px 350px at 30% 65%, rgba(45, 212, 168, 0.04), transparent)
          `,
        }}
      />

      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
          {/* Text — right side (via flex-row-reverse) */}
          <div className="max-w-[480px]">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5"
            >
              Decision Intelligence
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-[family-name:var(--font-display)] text-4xl lg:text-[52px] text-text-primary tracking-[-0.02em] leading-[1.08] mb-6"
            >
              From automation to decision intelligence
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-[16px] text-text-body leading-relaxed mb-8"
            >
              The Sidecar consumes intent vectors every turn, reads frustration
              trends over the last 3 turns, reasons over domain-specific strategy
              and tool catalogs, and reconfigures your voice agent&rsquo;s behavior,
              tools, and personality in real-time. Not if-then rules. Reasoning.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-2.5"
            >
              {details.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-[13px] text-text-body font-[family-name:var(--font-mono)]">
                    {item}
                  </span>
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Visual — left side (via flex-row-reverse) */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-1 w-full"
          >
            <FlowDiagram />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
