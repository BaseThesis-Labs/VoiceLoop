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
            className="relative flex items-center justify-center h-[36px] bg-transparent border-b border-white/[0.08]"
          >
            <p className="text-[11.5px] tracking-[0.03em] text-white/70 font-[family-name:var(--font-mono)]">
              Introducing KoeCode v1 — the complete harness for voice AI
              agents{' '}
              <a
                href="#"
                className="text-[#0d9e7e] font-medium hover:text-[#0b8a6e] transition-colors duration-200 ml-1"
              >
                Learn more &gt;
              </a>
            </p>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors duration-200"
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
