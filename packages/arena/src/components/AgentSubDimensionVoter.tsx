import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface AgentSubDimensionVoterProps {
  onSubVotesChange: (subVotes: Record<string, string>) => void
}

const DIMENSIONS = [
  { key: 'naturalness', label: 'Which sounded more human?' },
  { key: 'speed', label: 'Which felt more responsive?' },
  { key: 'understanding', label: 'Which understood you better?' },
  { key: 'helpfulness', label: 'Which was more helpful?' },
]

const COLORS: Record<string, string> = {
  a: '#6366f1',
  b: '#f59e0b',
  tie: '#888899',
}

export default function AgentSubDimensionVoter({ onSubVotesChange }: AgentSubDimensionVoterProps) {
  const [expanded, setExpanded] = useState(false)
  const [votes, setVotes] = useState<Record<string, string>>({})

  function handleVote(dimension: string, choice: string) {
    const updated = { ...votes, [dimension]: choice }
    setVotes(updated)
    onSubVotesChange(updated)
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-text-faint hover:text-text-body transition-colors"
      >
        <span className="text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
          Help us rank better (optional)
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-4 space-y-3"
        >
          {DIMENSIONS.map((dim) => (
            <div key={dim.key}>
              <p className="text-xs text-text-body mb-2">{dim.label}</p>
              <div className="flex gap-2">
                {['a', 'b', 'tie'].map((choice) => {
                  const isActive = votes[dim.key] === choice
                  const c = COLORS[choice]
                  return (
                    <button
                      key={choice}
                      onClick={() => handleVote(dim.key, choice)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: isActive ? `${c}18` : 'transparent',
                        borderColor: isActive ? c : '#282A3A',
                        color: isActive ? c : '#888899',
                      }}
                    >
                      {choice === 'tie' ? 'Tie' : `Agent ${choice.toUpperCase()}`}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
