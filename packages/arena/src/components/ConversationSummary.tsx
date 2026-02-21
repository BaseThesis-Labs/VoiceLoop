import { motion } from 'framer-motion'
import { MessageSquare, Clock, CheckCircle } from 'lucide-react'

interface ConversationSummaryProps {
  label: string
  color: string
  totalTurns: number
  durationSeconds: number
}

export default function ConversationSummary({
  label,
  color,
  totalTurns,
  durationSeconds,
}: ConversationSummaryProps) {
  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = Math.round(s % 60)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-border-default bg-bg-secondary p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <CheckCircle size={14} className="text-accent" />
      </div>
      <div className="flex items-center gap-4 text-text-faint">
        <div className="flex items-center gap-1">
          <MessageSquare size={12} />
          <span className="text-xs font-[family-name:var(--font-mono)]">
            {totalTurns} turns
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span className="text-xs font-[family-name:var(--font-mono)]">
            {formatDuration(durationSeconds)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
