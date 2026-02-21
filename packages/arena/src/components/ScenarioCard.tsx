import { motion } from 'framer-motion'
import { ClipboardList, Zap, Clock } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  booking: '#6366f1',
  support: '#f59e0b',
  info_retrieval: '#10b981',
}

const CATEGORY_LABELS: Record<string, string> = {
  booking: 'Booking',
  support: 'Customer Support',
  info_retrieval: 'Information',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
}

interface ScenarioCardProps {
  name: string
  category: string
  difficulty: string
  description: string
  maxTurns: number | null
  maxDuration: number | null
}

export default function ScenarioCard({
  name,
  category,
  difficulty,
  description,
  maxTurns,
  maxDuration,
}: ScenarioCardProps) {
  const catColor = CATEGORY_COLORS[category] || '#888899'
  const catLabel = CATEGORY_LABELS[category] || category
  const diffColor = DIFFICULTY_COLORS[difficulty] || '#888899'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border-default bg-bg-secondary p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: catColor, backgroundColor: `${catColor}18` }}
          >
            {catLabel}
          </span>
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: diffColor, backgroundColor: `${diffColor}18` }}
          >
            {difficulty}
          </span>
        </div>
      </div>

      <p className="text-sm text-text-body leading-relaxed mb-4">{description}</p>

      <div className="flex items-center gap-4 text-text-faint">
        {maxTurns && (
          <div className="flex items-center gap-1">
            <Zap size={12} />
            <span className="text-xs font-[family-name:var(--font-mono)]">
              Max {maxTurns} turns
            </span>
          </div>
        )}
        {maxDuration && (
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span className="text-xs font-[family-name:var(--font-mono)]">
              {maxDuration}s limit
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
