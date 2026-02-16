import { motion } from 'framer-motion';
import AuroraGradient from './AuroraGradient';

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background dot grid */}
      <div className="absolute inset-0 dot-grid" />

      {/* Subtle radial atmosphere behind content */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 700px 500px at 50% 30%, rgba(45, 212, 168, 0.05), transparent),
            radial-gradient(ellipse 500px 400px at 65% 55%, rgba(6, 182, 212, 0.04), transparent)
          `,
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6 pt-24 pb-8 text-center">
        {/* Category label */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0 }}
          className="text-[11px] font-[family-name:var(--font-mono)] uppercase text-accent tracking-[0.15em] mb-6"
        >
          THE VOICE AI PLATFORM
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-[family-name:var(--font-display)] text-[40px] md:text-[48px] lg:text-[72px] text-text-primary tracking-[-0.02em] leading-[1.08] max-w-[900px] mx-auto"
        >
          The harness your voice stack is missing
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-[18px] text-text-body max-w-[620px] mx-auto leading-relaxed mt-6 mb-10"
        >
          The intelligence layer for production voice AI. Measure intent as a
          mathematical function. Reason over strategy in real-time. Reconfigure
          your agent every turn.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-row items-center justify-center gap-4"
        >
          <a
            href="#"
            className="px-7 py-3.5 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:shadow-[0_0_24px_rgba(45,212,168,0.2)] transition-all duration-300"
          >
            Start for Free
          </a>
          <a
            href="#"
            className="px-7 py-3.5 border border-border-strong text-text-body rounded-lg font-medium text-sm hover:text-text-primary hover:border-text-faint transition-all duration-300"
          >
            Contact Sales
          </a>
        </motion.div>

        {/* Aurora gradient */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16"
        >
          <AuroraGradient variant="hero" />
        </motion.div>
      </div>
    </section>
  );
}
