import { motion } from 'framer-motion';

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

/* ─── Blinking cursor CSS animation (inline keyframes via style) ─── */
function BlinkingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[14px] bg-accent ml-0.5 align-middle"
      style={{
        animation: 'blink-cursor 1s step-end infinite',
      }}
    />
  );
}

/* ─── Transformation visual: input panel -> arrow -> output panel ─── */
function TransformationVisual() {
  const configRows = [
    { label: 'Domain', value: 'travel_booking', check: false },
    { label: 'Strategies', value: '5 generated', check: true },
    { label: 'Tools', value: '6 configured', check: true },
    { label: 'Intent dims', value: '18 calibrated', check: true },
    { label: 'Guardrails', value: '3 applied', check: true },
    { label: 'Status', value: 'Ready to deploy', check: false, pulse: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="flex-1 flex justify-center lg:justify-start"
    >
      <div className="w-full max-w-[520px] space-y-0">
        {/* Panel 1: Input */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-bg-hover border border-border-default rounded-xl p-5"
        >
          <span className="inline-block text-[10px] font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-[0.12em] mb-3">
            DESCRIBE YOUR AGENT
          </span>
          <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
            <p className="text-[13px] font-[family-name:var(--font-mono)] text-text-body leading-relaxed">
              A travel booking agent that handles flight and hotel searches, is
              empathetic when users are frustrated, offers discounts to retain
              hesitant customers, and escalates to human support after sustained
              frustration.
              <BlinkingCursor />
            </p>
          </div>
        </motion.div>

        {/* Transformation arrow */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="h-12 flex flex-col items-center justify-center gap-1"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="text-accent"
            style={{
              animation: 'arrow-pulse 1.5s ease-in-out infinite',
            }}
          >
            <path
              d="M10 4v12M10 16l-4-4M10 16l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] text-accent"
            style={{
              animation: 'arrow-pulse 1.5s ease-in-out infinite',
            }}
          >
            generating...
          </span>
        </motion.div>

        {/* Panel 2: Output */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-bg-surface border border-accent/20 rounded-xl p-5"
        >
          <span className="inline-block text-[10px] font-[family-name:var(--font-mono)] text-accent uppercase tracking-[0.12em] mb-3">
            GENERATED CONFIGURATION
          </span>
          <div className="space-y-2.5">
            {configRows.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.6 + i * 0.06 }}
                className="flex items-center justify-between font-[family-name:var(--font-mono)] text-[12px]"
              >
                <span className="text-text-faint w-[100px] shrink-0">
                  {row.label}
                </span>
                <span className="flex items-center gap-2 text-text-primary">
                  <span>{row.value}</span>
                  {row.check && (
                    <span className="text-accent text-[11px]">{'\u2713'}</span>
                  )}
                  {row.pulse && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                  )}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function TextToAgentSection() {
  const details = [
    'Natural language to full agent config',
    'Auto-generated strategy catalogs',
    'Intent dimension calibration',
    'One-click deployment',
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
            radial-gradient(ellipse 600px 450px at 30% 45%, rgba(20, 184, 166, 0.06), transparent),
            radial-gradient(ellipse 500px 350px at 75% 55%, rgba(6, 182, 212, 0.04), transparent)
          `,
        }}
      />

      {/* Inline keyframes for blinking cursor and arrow pulse */}
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes arrow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
          {/* Text — right side */}
          <div className="max-w-[480px]">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5"
            >
              TEXT-TO-AGENT
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="font-[family-name:var(--font-display)] text-4xl lg:text-[52px] text-text-primary tracking-[-0.02em] leading-[1.08] mb-6"
            >
              Describe it. Deploy it.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-[16px] text-text-body leading-relaxed mb-8"
            >
              Write a natural language description of the voice agent you need.
              VoiceLoop generates the strategy catalog, tool configuration, intent
              dimensions, and system prompts. Go from idea to production agent in
              minutes.
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

          {/* Visual — left side */}
          <TransformationVisual />
        </div>
      </div>
    </section>
  );
}
