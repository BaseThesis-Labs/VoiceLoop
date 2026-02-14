import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  BarChart3,
  Eye,
  Sparkles,
  RefreshCw,
  GitBranch,
  Mic,
} from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    label: 'Evals',
    title: 'Evals Framework',
    description:
      'Define custom evaluation criteria for your voice agents. Track accuracy, latency, tone, and task completion across every conversation.',
    visual: 'evals',
  },
  {
    icon: Eye,
    label: 'Traces',
    title: 'Observability',
    description:
      'Full trace visibility into every agent turn. See exactly what happened, why, and where to improve.',
    visual: 'observability',
  },
  {
    icon: Sparkles,
    label: 'Prompts',
    title: 'Dynamic Prompt Optimization',
    description:
      'Automatically iterate on prompts based on eval results. Your prompts get better with every conversation.',
    visual: 'prompts',
  },
  {
    icon: RefreshCw,
    label: 'Agents',
    title: 'Self-Evolving Agents',
    description:
      'Agents that learn from production feedback loops. Continuous improvement without manual intervention.',
    visual: 'agents',
  },
  {
    icon: GitBranch,
    label: 'Routing',
    title: 'Decision Router',
    description:
      'Smart routing with confidence scoring. Route calls to the right agent with the right context, every time.',
    visual: 'router',
  },
  {
    icon: Mic,
    label: 'Integrations',
    title: 'Voice AI Native',
    description:
      'Built specifically for voice. Works with ElevenLabs, Vapi, Cartesia, Deepgram, and your entire stack.',
    visual: 'native',
  },
];

/** Shared SVG gradient/filter defs for all feature visuals */
function FeatureDefs() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden="true">
      <defs>
        <filter id="feat-dither" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="7" result="noise" />
          <feComponentTransfer in="noise" result="threshold">
            <feFuncA type="discrete" tableValues="0 1" />
          </feComponentTransfer>
          <feComposite operator="in" in="SourceGraphic" in2="threshold" />
        </filter>
        <linearGradient id="fg-h" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="fg-v" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <radialGradient id="fg-r" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ─── 1. Evals: Radial score gauge with gradient arcs ─── */
function EvalsVisual() {
  const metrics = [
    { label: 'ACC', value: 94 },
    { label: 'LAT', value: 87 },
    { label: 'TONE', value: 91 },
    { label: 'COMP', value: 96 },
  ];
  const r = 52;
  const cx = 130;
  const cy = 70;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="mt-6">
      <svg viewBox="0 0 260 140" className="w-full">
        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1E2E" strokeWidth="6" />

        {/* Dithered glow behind gauge */}
        <circle cx={cx} cy={cy} r="35" fill="url(#fg-r)" filter="url(#feat-dither)" />

        {/* Animated score arcs — each metric is a quarter */}
        {metrics.map((m, i) => {
          const quarter = circumference / 4;
          const filled = (m.value / 100) * quarter;
          const gap = quarter - filled;
          const rotation = -90 + i * 90;
          return (
            <motion.circle
              key={m.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="url(#fg-h)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${gap + circumference - quarter}`}
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
            />
          );
        })}

        {/* Center score text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#EEEEF3" fontSize="18" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
          94.2
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#4E4E5E" fontSize="7" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.12em">
          SCORE
        </text>

        {/* Metric labels around the gauge */}
        {metrics.map((m, i) => {
          const angle = ((i * 90 + 45) * Math.PI) / 180 - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (r + 18);
          const ly = cy + Math.sin(angle) * (r + 18);
          return (
            <g key={m.label}>
              <text x={lx} y={ly - 4} textAnchor="middle" fill="#4E4E5E" fontSize="6" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.08em">
                {m.label}
              </text>
              <text x={lx} y={ly + 5} textAnchor="middle" fill="#888899" fontSize="8" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
                {m.value}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── 2. Observability: Gradient trace waterfall with glow ─── */
function ObservabilityVisual() {
  const traces = [
    { label: 'STT', duration: 120, start: 0, color: '#14b8a6' },
    { label: 'LLM', duration: 340, start: 130, color: '#34d399' },
    { label: 'TTS', duration: 180, start: 480, color: '#06b6d4' },
  ];
  const total = 640;
  const w = 320;
  const barH = 16;
  const gap = 8;
  const padL = 32;
  const padR = 8;
  const trackW = w - padL - padR;

  return (
    <div className="mt-6">
      <svg viewBox={`0 0 ${w} ${(barH + gap) * 3 + 20}`} className="w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={padL + p * trackW}
            y1="0"
            x2={padL + p * trackW}
            y2={(barH + gap) * 3}
            stroke="#1C1E2E"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
        ))}

        {/* Trace bars */}
        {traces.map((t, i) => {
          const x = padL + (t.start / total) * trackW;
          const barW = (t.duration / total) * trackW;
          const y = i * (barH + gap);
          return (
            <g key={t.label}>
              {/* Label */}
              <text x="0" y={y + barH / 2 + 3} fill="#4E4E5E" fontSize="8" fontFamily="'JetBrains Mono', monospace">
                {t.label}
              </text>
              {/* Glow */}
              <motion.rect
                x={x}
                y={y}
                rx="4"
                ry="4"
                height={barH}
                fill={t.color}
                opacity={0.08}
                initial={{ width: 0 }}
                whileInView={{ width: barW + 8 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.15 }}
              />
              {/* Bar */}
              <motion.rect
                x={x}
                y={y + 2}
                rx="3"
                ry="3"
                height={barH - 4}
                fill={t.color}
                opacity={0.25}
                initial={{ width: 0 }}
                whileInView={{ width: barW }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.15 }}
              />
              {/* Dithered bar overlay */}
              <motion.rect
                x={x}
                y={y + 2}
                rx="3"
                ry="3"
                height={barH - 4}
                fill={t.color}
                opacity={0.5}
                filter="url(#feat-dither)"
                initial={{ width: 0 }}
                whileInView={{ width: barW }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.15 }}
              />
              {/* Duration label */}
              <motion.text
                x={x + barW + 4}
                y={y + barH / 2 + 3}
                fill="#888899"
                fontSize="7"
                fontFamily="'JetBrains Mono', monospace"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.15 }}
              >
                {t.duration}ms
              </motion.text>
            </g>
          );
        })}

        {/* Time axis */}
        <text x={padL} y={(barH + gap) * 3 + 14} fill="#4E4E5E" fontSize="6" fontFamily="'JetBrains Mono', monospace">0ms</text>
        <text x={padL + trackW} y={(barH + gap) * 3 + 14} fill="#4E4E5E" fontSize="6" fontFamily="'JetBrains Mono', monospace" textAnchor="end">640ms</text>
      </svg>
    </div>
  );
}

/* ─── 3. Prompts: Version evolution with gradient connector ─── */
function PromptVisual() {
  return (
    <div className="mt-6 relative">
      {/* Gradient connector line between versions */}
      <div className="absolute left-5 top-3 bottom-3 w-px bg-gradient-to-b from-red-400/30 via-accent/40 to-accent/60" />

      <div className="space-y-2.5 pl-3">
        {/* Deprecated version */}
        <div className="relative rounded-lg bg-bg-hover border border-[#2A1A1A] px-3.5 py-3">
          <div className="absolute -left-[13px] top-4 w-2 h-2 rounded-full bg-red-400/70 ring-2 ring-bg-surface" />
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-red-400/70 font-[family-name:var(--font-mono)] uppercase tracking-wider">
              v2.1 — deprecated
            </span>
          </div>
          <p className="text-[12px] text-text-faint font-[family-name:var(--font-mono)] line-through">
            You are a helpful assistant...
          </p>
        </div>

        {/* Optimized version */}
        <div className="relative rounded-lg bg-bg-hover border border-accent/15 px-3.5 py-3">
          <div className="absolute -left-[13px] top-4 w-2 h-2 rounded-full bg-accent ring-2 ring-bg-surface" />
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-accent font-[family-name:var(--font-mono)] uppercase tracking-wider">
              v3.2 — optimized
            </span>
            <span className="text-[9px] text-accent/60 font-[family-name:var(--font-mono)] bg-accent/[0.08] px-1.5 py-0.5 rounded">
              +12% accuracy
            </span>
          </div>
          <p className="text-[12px] text-text-body font-[family-name:var(--font-mono)]">
            You are a scheduling agent. Confirm date, time, and attendees before booking...
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── 4. Agents: Circular feedback loop with animated arcs ─── */
function AgentVisual() {
  const steps = ['Observe', 'Evaluate', 'Adapt', 'Improve'];
  const r = 50;
  const cx = 130;
  const cy = 62;

  return (
    <div className="mt-6">
      <svg viewBox="0 0 260 124" className="w-full">
        {/* Dithered center glow */}
        <circle cx={cx} cy={cy} r="25" fill="url(#fg-r)" filter="url(#feat-dither)" />

        {/* Connecting ring track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1E2E" strokeWidth="1.5" />

        {/* Animated flowing arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#fg-h)"
          strokeWidth="1.5"
          strokeDasharray="40 275"
          strokeLinecap="round"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: 'spin-slow 6s linear infinite',
          }}
        />

        {/* Step nodes */}
        {steps.map((step, i) => {
          const angle = (i * 90 * Math.PI) / 180 - Math.PI / 2;
          const nx = cx + Math.cos(angle) * r;
          const ny = cy + Math.sin(angle) * r;
          return (
            <g key={step}>
              {/* Node background */}
              <circle cx={nx} cy={ny} r="18" fill="#0F1118" stroke="#1C1E2E" strokeWidth="1" />
              {/* Node glow on hover-like active state */}
              <circle cx={nx} cy={ny} r="18" fill="#14b8a6" opacity="0.04" />
              {/* Label */}
              <text x={nx} y={ny + 3} textAnchor="middle" fill="#EEEEF3" fontSize="6.5" fontWeight="500" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.04em">
                {step}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text x={cx} y={cy + 3} textAnchor="middle" fill="#14b8a6" fontSize="5.5" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.1em" opacity="0.6">
          LOOP
        </text>
      </svg>
    </div>
  );
}

/* ─── 5. Router: Branching gradient paths ─── */
function RouterVisual() {
  const routes = [
    { label: 'Scheduling', confidence: 98, y: 20 },
    { label: 'Support', confidence: 45, y: 55 },
    { label: 'Sales', confidence: 12, y: 90 },
  ];

  return (
    <div className="mt-6">
      <svg viewBox="0 0 300 110" className="w-full">
        {/* Input node */}
        <circle cx="30" cy="55" r="10" fill="#0F1118" stroke="url(#fg-h)" strokeWidth="1" />
        <text x="30" y="58" textAnchor="middle" fill="#14b8a6" fontSize="7" fontFamily="'JetBrains Mono', monospace">IN</text>

        {/* Branching paths */}
        {routes.map((route, i) => {
          const opacity = route.confidence / 100;
          const isActive = i === 0;
          return (
            <g key={route.label}>
              {/* Path curve from input to output */}
              <motion.path
                d={`M 40 55 C 90 55, 100 ${route.y}, 180 ${route.y}`}
                fill="none"
                stroke={isActive ? '#14b8a6' : '#1C1E2E'}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive ? 'none' : '3 4'}
                opacity={isActive ? 0.6 : 0.4}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
              />
              {/* Dithered glow on active path */}
              {isActive && (
                <path
                  d={`M 40 55 C 90 55, 100 ${route.y}, 180 ${route.y}`}
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="6"
                  opacity="0.08"
                  filter="url(#feat-dither)"
                />
              )}
              {/* Output node */}
              <circle
                cx="190"
                cy={route.y}
                r="6"
                fill={isActive ? '#14b8a6' : '#1C1E2E'}
                opacity={isActive ? 0.3 : 1}
                stroke={isActive ? '#14b8a6' : '#282A3A'}
                strokeWidth="1"
              />
              {/* Label */}
              <text x="204" y={route.y - 4} fill={isActive ? '#EEEEF3' : '#4E4E5E'} fontSize="7.5" fontFamily="'DM Sans', sans-serif" fontWeight={isActive ? '600' : '400'}>
                {route.label}
              </text>
              {/* Confidence */}
              <text x="204" y={route.y + 7} fill={isActive ? '#14b8a6' : '#4E4E5E'} fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="600" opacity={opacity}>
                {route.confidence}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── 6. Native: Constellation graph of integrations ─── */
function NativeVisual() {
  const providers = [
    { name: 'ElevenLabs', x: 50, y: 25 },
    { name: 'Vapi', x: 180, y: 18 },
    { name: 'Cartesia', x: 260, y: 38 },
    { name: 'Deepgram', x: 70, y: 72 },
    { name: 'OpenAI', x: 195, y: 80 },
    { name: 'AssemblyAI', x: 280, y: 75 },
  ];
  const hub = { x: 160, y: 50 };

  return (
    <div className="mt-6">
      <svg viewBox="0 0 330 100" className="w-full">
        {/* Connection lines from hub to each provider */}
        {providers.map((p) => (
          <line
            key={p.name}
            x1={hub.x}
            y1={hub.y}
            x2={p.x}
            y2={p.y}
            stroke="#1C1E2E"
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
        ))}

        {/* Hub glow */}
        <circle cx={hub.x} cy={hub.y} r="18" fill="url(#fg-r)" filter="url(#feat-dither)" />
        <circle cx={hub.x} cy={hub.y} r="10" fill="#0F1118" stroke="url(#fg-h)" strokeWidth="1" />
        <text x={hub.x} y={hub.y + 2.5} textAnchor="middle" fill="#14b8a6" fontSize="5" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.08em">
          VL
        </text>

        {/* Provider nodes */}
        {providers.map((p) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r="3" fill="#1C1E2E" stroke="#282A3A" strokeWidth="0.5" />
            <text x={p.x} y={p.y + 12} textAnchor="middle" fill="#888899" fontSize="6.5" fontFamily="'JetBrains Mono', monospace">
              {p.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function getVisual(visual: string) {
  switch (visual) {
    case 'evals': return <EvalsVisual />;
    case 'observability': return <ObservabilityVisual />;
    case 'prompts': return <PromptVisual />;
    case 'agents': return <AgentVisual />;
    case 'router': return <RouterVisual />;
    case 'native': return <NativeVisual />;
    default: return null;
  }
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group bg-bg-surface border border-border-default rounded-2xl p-6 hover:border-accent/20 hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(20,184,166,0.04)] transition-all duration-300"
    >
      <div className="flex items-center gap-3 mb-4">
        <Icon size={16} className="text-accent shrink-0" />
        <span className="text-[10px] font-semibold text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-[0.12em]">
          {feature.label}
        </span>
      </div>
      <h3 className="text-[17px] font-semibold text-text-primary font-[family-name:var(--font-sans)] tracking-tight mb-2">
        {feature.title}
      </h3>
      <p className="text-[13px] text-text-body leading-relaxed">
        {feature.description}
      </p>
      {getVisual(feature.visual)}
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="features" className="relative py-24">
      {/* Shared SVG defs for feature visuals */}
      <FeatureDefs />

      {/* Gradient mesh atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 600px 400px at 20% 25%, rgba(20, 184, 166, 0.08), transparent),
            radial-gradient(ellipse 500px 350px at 75% 55%, rgba(6, 182, 212, 0.06), transparent),
            radial-gradient(ellipse 450px 300px at 45% 85%, rgba(52, 211, 153, 0.05), transparent)
          `,
        }}
      />
      {/* Slow-rotating conic haze behind heading */}
      <div
        className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none opacity-[0.06]"
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, #14b8a6, #34d399, #06b6d4, #14b8a6)',
          filter: 'blur(100px)',
          animation: 'spin-slow 60s linear infinite',
        }}
        aria-hidden="true"
      />

      {/* Divider with transition halo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] max-w-[600px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
      <div className="absolute -top-[80px] left-1/2 -translate-x-1/2 w-[500px] h-[160px] bg-accent/[0.04] rounded-full blur-[80px] pointer-events-none" aria-hidden="true" />

      <div className="max-w-[1100px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-4">
            Features
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl lg:text-[44px] font-normal text-text-primary tracking-[-0.01em] leading-[1.15] mb-4">
            Everything you need to ship{' '}
            <span className="bg-gradient-to-r from-accent to-[#34d399] bg-clip-text text-transparent">
              reliable Voice AI
            </span>
          </h2>
          <p className="text-[15px] text-text-body leading-relaxed">
            From evals to production observability — the complete platform for
            voice agents that actually work.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
