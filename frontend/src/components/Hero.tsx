import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import ParticleWaveField from './ParticleWaveField';

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background atmosphere — gradient mesh */}
      <div className="absolute inset-0 dot-grid" />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 700px 500px at 30% 25%, rgba(20, 184, 166, 0.07), transparent),
            radial-gradient(ellipse 500px 400px at 75% 60%, rgba(6, 182, 212, 0.05), transparent)
          `,
        }}
      />

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
            <ParticleWaveField />
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
