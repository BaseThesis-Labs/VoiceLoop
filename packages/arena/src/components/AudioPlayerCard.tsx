import { motion } from 'framer-motion'
import { Play, Pause, Clock, Zap } from 'lucide-react'
import WaveformVisualizer from './WaveformVisualizer'

interface AudioPlayerCardProps {
  label: string
  color: string
  isPlaying: boolean
  hasPlayed: boolean
  onTogglePlay: () => void
  duration: string
  ttfb: string
  progress: number
  revealed: boolean
  provider?: string
}

export default function AudioPlayerCard({
  label,
  color,
  isPlaying,
  hasPlayed,
  onTogglePlay,
  duration,
  ttfb,
  progress,
  revealed,
  provider,
}: AudioPlayerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
      className="bg-bg-surface rounded-xl border border-border-default p-5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color, boxShadow: isPlaying ? `0 0 8px ${color}60` : 'none' }}
        />
        <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.15em] text-text-faint">
          {label}
        </span>
        {revealed && provider && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent">
            {provider}
          </span>
        )}
        {isPlaying && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-auto text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wider"
            style={{ color }}
          >
            Live
          </motion.span>
        )}
      </div>

      {/* Waveform */}
      <div className="flex-1 mb-4 min-h-[48px] flex items-center justify-center">
        <WaveformVisualizer
          bars={20}
          playing={isPlaying}
          color={color}
          height={48}
          className="w-full"
        />
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full bg-bg-hover mb-4 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: '0%' }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>

      {/* Play button + status */}
      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onTogglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors"
          style={{
            borderColor: isPlaying ? color : '#282A3A',
            backgroundColor: isPlaying ? `${color}18` : 'transparent',
          }}
        >
          {isPlaying ? (
            <Pause size={16} style={{ color }} />
          ) : (
            <Play size={16} className="text-text-body ml-0.5" />
          )}
        </motion.button>
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium truncate"
            style={{ color: isPlaying ? color : '#888899' }}
          >
            {isPlaying ? 'Playing...' : hasPlayed ? 'Played' : 'Click to play'}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-default">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-text-faint" />
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-faint">
            {duration}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-text-faint" />
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-faint">
            TTFB {ttfb}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
