import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div
            className="relative flex items-center justify-center h-[36px] border-b border-accent/[0.12]"
            style={{
              background:
                'linear-gradient(90deg, transparent 5%, rgba(45, 212, 168, 0.06) 50%, transparent 95%)',
            }}
          >
            <p className="text-[11.5px] tracking-[0.03em] text-text-body/90 font-[family-name:var(--font-mono)]">
              Introducing VoiceLoop v1 — the complete harness for voice AI
              agents{' '}
              <a
                href="#"
                className="text-accent font-medium hover:text-accent/80 transition-colors duration-200 ml-1"
              >
                Learn more &gt;
              </a>
            </p>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-body transition-colors duration-200"
              aria-label="Dismiss announcement"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
