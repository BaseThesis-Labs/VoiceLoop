import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

type ModelKey = 'a' | 'b' | 'c'

interface DimensionVoterProps {
  models: ModelKey[]
  onSubVotesChange: (subVotes: Record<string, string>) => void
}

const DIMENSIONS = [
  { key: 'answer', label: 'Better answer?' },
  { key: 'voice', label: 'Better voice?' },
]

const MODEL_COLORS: Record<ModelKey, string> = {
  a: '#6366f1',
  b: '#f59e0b',
  c: '#10b981',
}

export default function DimensionVoter({ models, onSubVotesChange }: DimensionVoterProps) {
  const [expanded, setExpanded] = useState(false)
  const [votes, setVotes] = useState<Record<string, string>>({})

  function handleVote(dimension: string, choice: string) {
    const next = { ...votes, [dimension]: choice }
    setVotes(next)
    onSubVotesChange(next)
  }

  const options = [...models.map((m) => m.toUpperCase()), 'Tie']

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-faint hover:text-text-body transition-colors mx-auto"
      >
        <span className="font-[family-name:var(--font-mono)]">Help us rank better</span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-3">
              {DIMENSIONS.map((dim) => (
                <div key={dim.key}>
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-text-faint mb-2">
                    {dim.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => {
                      const isActive = votes[dim.key] === option.toLowerCase()
                      const modelKey = option.toLowerCase() as ModelKey
                      const color = option === 'Tie' ? '#888899' : MODEL_COLORS[modelKey] || '#888899'

                      return (
                        <motion.button
                          key={option}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleVote(dim.key, option.toLowerCase())}
                          className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
                          style={{
                            borderColor: isActive ? color : '#282A3A',
                            backgroundColor: isActive ? `${color}18` : 'transparent',
                            color: isActive ? color : '#888899',
                          }}
                        >
                          {option}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
