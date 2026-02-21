import { motion } from 'framer-motion'
import WaveformVisualizer from './WaveformVisualizer'

interface GatedLoadingStateProps {
  modelCount: number
  elapsedMs: number
}

const PLACEHOLDER_COLORS = ['#6366f1', '#f59e0b', '#10b981']

export default function GatedLoadingState({ modelCount, elapsedMs }: GatedLoadingStateProps) {
  const formatTime = (ms: number) => (ms / 1000).toFixed(1)

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Model card placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
        {Array.from({ length: modelCount }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
            className="bg-bg-surface rounded-xl border border-border-default p-5"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <motion.span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PLACEHOLDER_COLORS[i] }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
              <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.15em] text-text-faint">
                Model {String.fromCharCode(65 + i)}
              </span>
              <motion.span
                className="ml-auto text-[11px] font-[family-name:var(--font-mono)] text-text-faint"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Thinking...
              </motion.span>
            </div>
            <div className="min-h-[48px] flex items-center justify-center">
              <WaveformVisualizer
                bars={20}
                playing={true}
                color={PLACEHOLDER_COLORS[i]}
                height={48}
                className="w-full opacity-40"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Central timer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-2"
      >
        <p className="text-sm text-text-body font-[family-name:var(--font-mono)]">
          Waiting for all models to respond...
        </p>
        <motion.span
          className="text-lg font-[family-name:var(--font-mono)] text-accent"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {formatTime(elapsedMs)}s
        </motion.span>
      </motion.div>
    </div>
  )
}
