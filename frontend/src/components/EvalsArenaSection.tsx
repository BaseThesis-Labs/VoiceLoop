import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

/* ─── Metric bar that animates width on scroll ─── */
function MetricBar({
  percent,
  variant,
  delay,
}: {
  percent: number;
  variant: 'a' | 'b';
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <div ref={ref} className="h-1.5 rounded-full bg-border-default w-full">
      <motion.div
        className={`h-full rounded-full ${
          variant === 'b' ? 'bg-accent' : 'bg-text-faint/40'
        }`}
        initial={{ width: 0 }}
        animate={inView ? { width: `${percent}%` } : { width: 0 }}
        transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      />
    </div>
  );
}

/* ─── Arena comparison card ─── */
function ArenaVisual() {
  const metricsA = [
    { label: 'Empathy', value: '0.72', percent: 72 },
    { label: 'Resolution', value: '0.85', percent: 85 },
    { label: 'Latency', value: '340ms', percent: 53 },
    { label: 'Escalations', value: '3', percent: 30 },
  ];

  const metricsB = [
    { label: 'Empathy', value: '0.89', percent: 89, winner: true },
    { label: 'Resolution', value: '0.91', percent: 91, winner: true },
    { label: 'Latency', value: '285ms', percent: 72, winner: true },
    { label: 'Escalations', value: '1', percent: 90, winner: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="flex-1 flex justify-center lg:justify-end"
    >
      <div className="w-full max-w-[520px] bg-bg-surface border border-border-default rounded-2xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-bg-surface-header border-b border-border-default px-6 py-3">
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-text-faint">
            Arena Match #47
          </span>
          <span className="text-accent bg-accent/10 rounded-full px-2.5 py-0.5 text-[10px] font-[family-name:var(--font-mono)]">
            completed
          </span>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2">
          {/* Column A */}
          <div className="border-r border-border-default p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[12px] font-[family-name:var(--font-mono)] text-text-body">
                Agent A
              </span>
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint bg-bg-hover px-1.5 py-0.5 rounded">
                v3.1
              </span>
            </div>

            <div className="space-y-3">
              {metricsA.map((m, i) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-[family-name:var(--font-mono)] text-text-faint">
                      {m.label}
                    </span>
                    <span className="text-[11px] font-[family-name:var(--font-mono)] text-text-body">
                      {m.value}
                    </span>
                  </div>
                  <MetricBar percent={m.percent} variant="a" delay={0.1 + i * 0.08} />
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border-default">
              <span className="text-[28px] font-semibold text-text-body font-[family-name:var(--font-mono)]">
                78.2
              </span>
            </div>
          </div>

          {/* Column B */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[12px] font-[family-name:var(--font-mono)] text-accent">
                Agent B
              </span>
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint bg-bg-hover px-1.5 py-0.5 rounded">
                v3.2
              </span>
              <span className="text-[9px] font-[family-name:var(--font-mono)] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                challenger
              </span>
            </div>

            <div className="space-y-3">
              {metricsB.map((m, i) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-[family-name:var(--font-mono)] text-text-faint">
                      {m.label}
                    </span>
                    <span
                      className={`text-[11px] font-[family-name:var(--font-mono)] ${
                        m.winner ? 'text-accent' : 'text-text-body'
                      }`}
                    >
                      {m.value}
                      {m.winner && (
                        <span className="ml-1 text-accent text-[10px]">{'\u2713'}</span>
                      )}
                    </span>
                  </div>
                  <MetricBar percent={m.percent} variant="b" delay={0.1 + i * 0.08} />
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border-default flex items-center gap-2">
              <span className="text-[28px] font-semibold text-accent font-[family-name:var(--font-mono)]">
                91.4
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-accent mt-1"
              >
                <path
                  d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z"
                  fill="currentColor"
                  opacity="0.7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border-default px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-accent">
            Champion: Agent B v3.2
          </span>
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-text-faint">
            promoted to production
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Detail bullet list ─── */
function DetailBullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.5 + i * 0.08 }}
          className="flex items-center gap-2.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          <span className="text-[13px] font-[family-name:var(--font-mono)] text-text-body">
            {item}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

export default function EvalsArenaSection() {
  const details = [
    'Side-by-side agent comparison',
    'Scenario-based stress testing',
    'Statistical significance scoring',
    'Automated regression detection',
  ];

  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      {/* Gradient divider at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] max-w-[600px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      {/* Atmospheric background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 700px 500px at 70% 40%, rgba(20, 184, 166, 0.06), transparent),
            radial-gradient(ellipse 500px 400px at 20% 60%, rgba(6, 182, 212, 0.04), transparent)
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
              transition={{ duration: 0.4 }}
              className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5"
            >
              VOICE EVALS ARENA
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="font-[family-name:var(--font-display)] text-4xl lg:text-[52px] text-text-primary tracking-[-0.02em] leading-[1.08] mb-6"
            >
              Pit your agents against each other
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-[16px] text-text-body leading-relaxed mb-8"
            >
              Run head-to-head evaluations of different agent configurations,
              strategies, and prompt versions. See which one handles edge cases,
              maintains composure under frustration, and drives outcomes. An arena
              for voice agent quality.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.24 }}
            >
              <DetailBullets items={details} />
            </motion.div>
          </div>

          {/* Visual — right side */}
          <ArenaVisual />
        </div>
      </div>
    </section>
  );
}
