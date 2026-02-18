import { motion, useInView } from 'framer-motion';
import { useRef, useMemo } from 'react';

/* ── Intent dimension data ──────────────────────────────────────── */

interface IntentDimension {
  name: string;
  value: number;
  cluster: 'pragmatic' | 'commitment' | 'emotional' | 'conversational';
}

const CLUSTER_COLORS: Record<string, string> = {
  pragmatic: '#2DD4A8',
  commitment: '#34d399',
  emotional: '#06b6d4',
  conversational: '#f59e0b',
};

const dimensions: IntentDimension[] = [
  // Pragmatic
  { name: 'requesting', value: 0.82, cluster: 'pragmatic' },
  { name: 'informing', value: 0.10, cluster: 'pragmatic' },
  { name: 'confirming', value: 0.05, cluster: 'pragmatic' },
  { name: 'objecting', value: 0.08, cluster: 'pragmatic' },
  { name: 'exploring', value: 0.35, cluster: 'pragmatic' },
  // Commitment
  { name: 'committed', value: 0.12, cluster: 'commitment' },
  { name: 'hesitant', value: 0.55, cluster: 'commitment' },
  { name: 'hedging', value: 0.72, cluster: 'commitment' },
  { name: 'tentative', value: 0.48, cluster: 'commitment' },
  // Emotional
  { name: 'frustrated', value: 0.45, cluster: 'emotional' },
  { name: 'excited', value: 0.40, cluster: 'emotional' },
  { name: 'anxious', value: 0.30, cluster: 'emotional' },
  { name: 'satisfied', value: 0.15, cluster: 'emotional' },
  { name: 'confused', value: 0.20, cluster: 'emotional' },
  // Conversational
  { name: 'turn_taking', value: 0.60, cluster: 'conversational' },
  { name: 'backchanneling', value: 0.25, cluster: 'conversational' },
  { name: 'interrupting', value: 0.05, cluster: 'conversational' },
  { name: 'repairing', value: 0.18, cluster: 'conversational' },
];

/* ── Detail bullets ─────────────────────────────────────────────── */

const details = [
  '18 intent dimensions across 4 clusters',
  'Explainable attention weights',
  '2-5M parameter composition engine',
  'Sub-10ms inference latency',
];

/* ── Radar chart geometry helpers ────────────────────────────────── */

const CX = 200;
const CY = 200;
const RADIUS = 150;
const LABEL_RADIUS = RADIUS + 22;
const N = dimensions.length;

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function getAngle(index: number) {
  return (2 * Math.PI * index) / N - Math.PI / 2;
}

/* ── Radar chart visual ─────────────────────────────────────────── */

function RadarChart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const rings = [0.25, 0.5, 0.75, 1.0];

  // Build the data polygon path
  const dataPoints = useMemo(
    () =>
      dimensions.map((d, i) => {
        const angle = getAngle(i);
        const r = d.value * RADIUS;
        return polarToCartesian(CX, CY, r, angle);
      }),
    [],
  );

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // Collapsed polygon (all at center) for animation start
  const collapsedPath =
    dimensions.map((_, i) => `${i === 0 ? 'M' : 'L'} ${CX} ${CY}`).join(' ') + ' Z';

  return (
    <div ref={ref} className="flex-1 flex flex-col items-center">
      <svg viewBox="0 0 400 400" className="w-full max-w-[480px]">
        {/* Concentric rings */}
        {rings.map((scale) => (
          <circle
            key={scale}
            cx={CX}
            cy={CY}
            r={RADIUS * scale}
            fill="none"
            stroke="#1C1E2E"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {dimensions.map((_, i) => {
          const angle = getAngle(i);
          const edge = polarToCartesian(CX, CY, RADIUS, angle);
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={edge.x}
              y2={edge.y}
              stroke="#1C1E2E"
              strokeWidth="0.5"
              opacity={0.5}
            />
          );
        })}

        {/* Data polygon */}
        <motion.path
          d={dataPath}
          fill="rgba(45, 212, 168, 0.08)"
          stroke="rgba(45, 212, 168, 0.6)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          initial={{ d: collapsedPath }}
          animate={isInView ? { d: dataPath } : { d: collapsedPath }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        />

        {/* Data point dots */}
        {dimensions.map((d, i) => {
          const angle = getAngle(i);
          const r = d.value * RADIUS;
          const pt = polarToCartesian(CX, CY, r, angle);
          const color = CLUSTER_COLORS[d.cluster];
          return (
            <motion.circle
              key={d.name}
              cx={pt.x}
              cy={pt.y}
              r={3}
              fill={color}
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.03 }}
            />
          );
        })}

        {/* Labels around the outside */}
        {dimensions.map((d, i) => {
          const angle = getAngle(i);
          const pos = polarToCartesian(CX, CY, LABEL_RADIUS, angle);

          // Determine text-anchor based on quadrant
          let anchor: 'start' | 'middle' | 'end' = 'middle';
          if (pos.x > CX + 10) anchor = 'start';
          else if (pos.x < CX - 10) anchor = 'end';

          // Adjust vertical alignment
          let dy = '0.35em';
          if (pos.y < CY - RADIUS * 0.8) dy = '1em';
          else if (pos.y > CY + RADIUS * 0.8) dy = '-0.2em';

          return (
            <text
              key={d.name}
              x={pos.x}
              y={pos.y}
              textAnchor={anchor}
              dy={dy}
              fill="#4E4E5E"
              fontSize="8"
              fontFamily="'JetBrains Mono', monospace"
            >
              {d.name}
            </text>
          );
        })}
      </svg>

      {/* Annotation card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="rounded-lg bg-bg-hover border border-border-default p-3 mt-2 w-full max-w-[420px]"
      >
        <span className="block text-[10px] font-[family-name:var(--font-mono)] text-text-faint">
          <span className="text-accent/70">dominant_signals</span>
          <br />
          F0_slope: 0.38{'  '}·{'  '}hedge_density: 0.31{'  '}·{'  '}pause_ratio: 0.22
        </span>
      </motion.div>
    </div>
  );
}

/* ── Main section ───────────────────────────────────────────────── */

export default function IntentApiSection() {
  return (
    <section id="features" className="relative py-32 lg:py-40 overflow-hidden">
      {/* Gradient divider at top */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      {/* Atmospheric background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 700px 500px at 30% 40%, rgba(45, 212, 168, 0.05), transparent),
            radial-gradient(ellipse 500px 400px at 70% 60%, rgba(45, 212, 168, 0.04), transparent)
          `,
        }}
      />

      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Text — left side */}
          <div className="max-w-[480px]">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5"
            >
              Intent API
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-[family-name:var(--font-display)] text-4xl lg:text-[52px] text-text-primary tracking-[-0.02em] leading-[1.08] mb-6"
            >
              Intent is not a label. It&rsquo;s a measurement.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-[16px] text-text-body leading-relaxed mb-8"
            >
              Traditional voice AI classifies intent into buckets &mdash; booking,
              complaint, inquiry. KoeCode computes a graded 18-dimensional intent
              vector from prosody, semantics, user history, and context. Every
              dimension scored 0.0 to 1.0. Every score explainable.
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

          {/* Visual — right side */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-1 w-full"
          >
            <RadarChart />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
