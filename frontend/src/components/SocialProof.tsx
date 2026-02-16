import { motion } from 'framer-motion';

const providers = [
  'ElevenLabs',
  'Vapi',
  'Cartesia',
  'Deepgram',
  'OpenAI',
  'Ultravox',
];

export default function SocialProof() {
  return (
    <motion.section
      className="relative py-24 overflow-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div className="max-w-[1280px] mx-auto px-6 text-center">
        {/* Label */}
        <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] text-text-faint mb-10">
          Built for the voice AI stack
        </p>

        {/* Provider names */}
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
          {providers.map((name) => (
            <span
              key={name}
              className="text-[15px] font-semibold text-text-faint/50 font-[family-name:var(--font-sans)] hover:text-text-faint transition-colors duration-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
