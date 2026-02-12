import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';

/**
 * Dithered Sonic Field — hero visual asset.
 * Adapted to a taller aspect ratio for side-by-side layout.
 */
function SonicField() {
  const barCount = 40;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const normalized = i / (barCount - 1);
    const centered = Math.abs(normalized - 0.5) * 2;
    const height = Math.pow(1 - centered, 1.5) * 100;
    return { height: Math.max(8, height), delay: i * 0.06 };
  });

  const vw = 500;
  const vh = 420;
  const cx = vw / 2;
  const cy = vh / 2;

  return (
    <div className="relative w-full h-full min-h-[380px]" aria-hidden="true">
      {/* SVG filter definitions */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="dither" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="3" result="noise" />
            <feComponentTransfer in="noise" result="threshold">
              <feFuncA type="discrete" tableValues="0 1" />
            </feComponentTransfer>
            <feComposite operator="in" in="SourceGraphic" in2="threshold" />
          </filter>
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Layer 1: Drifting gradient blobs */}
      <div className="absolute inset-0">
        <div
          className="absolute top-[10%] left-[15%] w-[280px] h-[280px] rounded-full bg-accent/20 blur-[100px]"
          style={{ animation: 'drift-1 10s ease-in-out infinite' }}
        />
        <div
          className="absolute top-[40%] right-[10%] w-[240px] h-[240px] rounded-full bg-[#34d399]/15 blur-[90px]"
          style={{ animation: 'drift-2 13s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[10%] left-[30%] w-[200px] h-[200px] rounded-full bg-[#06b6d4]/10 blur-[80px]"
          style={{ animation: 'drift-3 16s ease-in-out infinite' }}
        />
      </div>

      {/* Layer 2: Dithered gradient mesh */}
      <div className="absolute inset-0" style={{ filter: 'url(#dither)' }}>
        <div
          className="absolute top-[5%] left-[10%] w-[300px] h-[300px] rounded-full bg-accent/50"
          style={{ animation: 'drift-1 10s ease-in-out infinite' }}
        />
        <div
          className="absolute top-[35%] right-[5%] w-[260px] h-[260px] rounded-full bg-[#34d399]/40"
          style={{ animation: 'drift-2 13s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[5%] left-[25%] w-[220px] h-[220px] rounded-full bg-[#06b6d4]/35"
          style={{ animation: 'drift-3 16s ease-in-out infinite' }}
        />
      </div>

      {/* Layer 3: Concentric sound rings */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${vw} ${vh}`}>
        {[1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={50 + i * 40}
            fill="none"
            stroke="#14b8a6"
            strokeWidth="0.5"
            strokeDasharray="3 6"
            opacity={0.2 - i * 0.04}
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animation: `ring-pulse ${4 + i * 1.5}s ease-out infinite`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
        {[1, 2, 3, 4, 5].map((i) => (
          <circle
            key={`s-${i}`}
            cx={cx}
            cy={cy}
            r={25 + i * 30}
            fill="none"
            stroke="#14b8a6"
            strokeWidth="0.3"
            opacity={0.06}
          />
        ))}
      </svg>

      {/* Layer 4: Frequency bars */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-end gap-[2px] h-[110px]">
          {bars.map((bar, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-gradient-to-t from-accent/60 via-[#34d399]/50 to-[#06b6d4]/30 origin-bottom"
              style={{
                height: `${bar.height}%`,
                animation: `freq-bar ${1.8 + Math.random() * 1.2}s ease-in-out infinite`,
                animationDelay: `${bar.delay}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Layer 5: Central core glow */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${vw} ${vh}`}>
        <circle cx={cx} cy={cy} r="50" fill="url(#core-glow)" />
      </svg>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 dot-grid" />
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-accent/[0.025] rounded-full blur-[150px] pointer-events-none" />

      <div className="relative max-w-[1100px] mx-auto px-6 pt-32 pb-16">
        {/* Two-column layout: text left, asset right */}
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — Hero text */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-accent/20 bg-accent/[0.06] text-[11px] font-medium text-accent font-[family-name:var(--font-mono)] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Now in Public Beta
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="font-[family-name:var(--font-display)] text-5xl md:text-6xl lg:text-[68px] font-normal tracking-[-0.01em] leading-[1.1] mb-6"
            >
              The Operating
              <br />
              System for{' '}
              <span className="bg-gradient-to-r from-accent via-[#34d399] to-accent bg-[length:200%_auto] bg-clip-text text-transparent">
                Voice AI
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="max-w-md text-lg text-text-body leading-relaxed mb-10 mx-auto lg:mx-0"
            >
              Evals, observability, dynamic prompt optimization, and self-evolving
              agents. Ship reliable voice AI with confidence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3"
            >
              <a
                href="#"
                className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-accent to-[#10b981] rounded-lg hover:shadow-[0_0_24px_rgba(20,184,166,0.25)] transition-all duration-300"
              >
                Get Started Free
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-medium text-text-body border border-border-default rounded-lg hover:text-text-primary hover:border-border-strong transition-all duration-300"
              >
                <BookOpen size={16} />
                Read the Docs
              </a>
            </motion.div>
          </div>

          {/* Right — Sonic Field asset */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex-1 w-full lg:max-w-[520px]"
          >
            <SonicField />
          </motion.div>
        </div>

        {/* Trust bar — full width below */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="text-center mt-20"
        >
          <p className="text-[11px] text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5">
            Built for the voice AI stack
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {['ElevenLabs', 'Vapi', 'Cartesia', 'Deepgram', 'OpenAI'].map((name) => (
              <span
                key={name}
                className="text-sm font-medium text-text-faint/70 font-[family-name:var(--font-sans)]"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
