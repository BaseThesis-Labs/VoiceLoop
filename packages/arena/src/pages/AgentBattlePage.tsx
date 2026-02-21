import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Share2,
  ArrowRight,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import ScenarioCard from '../components/ScenarioCard'
import AgentConversation from '../components/AgentConversation'
import ConversationSummary from '../components/ConversationSummary'
import AgentSubDimensionVoter from '../components/AgentSubDimensionVoter'
import VoteButton from '../components/VoteButton'
import { type BattleMode } from '../components/ModeSelector'
import {
  api,
  type AgentBattleSetup,
  type AgentConversationEnd,
  type AgentMetrics,
} from '../api/client'

type AgentState = 'idle' | 'briefing' | 'conversing_a' | 'transition' | 'conversing_b' | 'voting' | 'revealed'
type VoteChoice = 'a' | 'b' | 'tie' | null

const COLORS = { a: '#6366f1', b: '#f59e0b' }

export default function AgentBattlePage({
  battleCount: externalBattleCount,
}: {
  onModeChange?: (mode: BattleMode) => void
  battleCount: number
}) {
  const [state, setState] = useState<AgentState>('idle')
  const [setup, setSetup] = useState<AgentBattleSetup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [battleCount, setBattleCount] = useState(externalBattleCount)

  // Conversation summaries
  const [convA, setConvA] = useState<AgentConversationEnd | null>(null)
  const [convB, setConvB] = useState<AgentConversationEnd | null>(null)

  // Voting
  const [voted, setVoted] = useState<VoteChoice>(null)
  const [voting, setVoting] = useState(false)
  const [subVotes, setSubVotes] = useState<Record<string, string>>({})

  // Metrics
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null)
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize battle
  const initBattle = useCallback(async () => {
    setState('idle')
    setSetup(null)
    setError(null)
    setConvA(null)
    setConvB(null)
    setVoted(null)
    setVoting(false)
    setSubVotes({})
    setMetrics(null)

    try {
      const data = await api.agent.setup()
      setSetup(data)
      setState('briefing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize battle')
    }
  }, [])

  useEffect(() => {
    initBattle()
    return () => {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current)
    }
  }, [initBattle])

  // Handle conversation A end
  function handleConvAEnd(data: AgentConversationEnd) {
    setConvA(data)
    setState('transition')
  }

  // Handle conversation B end
  function handleConvBEnd(data: AgentConversationEnd) {
    setConvB(data)
    setState('voting')
  }

  // Handle vote
  async function handleVote(choice: VoteChoice) {
    if (!setup || !choice || voting) return
    setVoting(true)
    try {
      await api.battles.vote(setup.id, choice, Object.keys(subVotes).length > 0 ? subVotes : undefined)
      setVoted(choice)
      setState('revealed')
      // Start metrics polling
      pollMetrics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vote failed')
    } finally {
      setVoting(false)
    }
  }

  function pollMetrics() {
    if (!setup) return
    const poll = async () => {
      try {
        const data = await api.agent.getMetrics(setup.id)
        setMetrics(data)
        if (data.status === 'complete' && metricsIntervalRef.current) {
          clearInterval(metricsIntervalRef.current)
          metricsIntervalRef.current = null
        }
      } catch {
        // Silently retry
      }
    }
    poll()
    metricsIntervalRef.current = setInterval(poll, 2000)
  }

  function handleNextBattle() {
    setBattleCount((c) => c + 1)
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
      metricsIntervalRef.current = null
    }
    initBattle()
  }

  function handleConvError(msg: string) {
    setError(msg)
  }

  return (
    <>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent" />
            <span className="font-[family-name:var(--font-mono)] text-sm text-text-body">
              Agent Battle <span className="text-text-primary">#{battleCount + 1}</span>
            </span>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="text-text-faint hover:text-text-body transition-colors"
            title="Share battle"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3"
          >
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Loading */}
        {state === 'idle' && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}

        {/* Briefing — show scenario + start button */}
        {state === 'briefing' && setup && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <div className="text-center">
              <p className="text-sm text-text-faint mb-4">
                You'll have two separate conversations with two different agents on this task. After both, vote on which handled it better.
              </p>
              <button
                onClick={() => setState('conversing_a')}
                className="px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                Talk to Agent A
              </button>
            </div>
          </motion.div>
        )}

        {/* Conversing A */}
        {state === 'conversing_a' && setup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <AgentConversation
              wsUrl={api.agent.getStreamUrl(setup.id, 'a')}
              label="Agent A"
              color={COLORS.a}
              maxDuration={setup.scenario.max_duration_seconds || 120}
              onConversationEnd={handleConvAEnd}
              onError={handleConvError}
            />
          </motion.div>
        )}

        {/* Transition — A done, ready for B */}
        {state === 'transition' && setup && convA && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <ConversationSummary
              label="Agent A"
              color={COLORS.a}
              totalTurns={convA.total_turns}
              durationSeconds={convA.duration_seconds}
            />
            <div className="text-center">
              <p className="text-sm text-text-faint mb-4">
                Now try the same task with Agent B.
              </p>
              <button
                onClick={() => setState('conversing_b')}
                className="px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                Talk to Agent B
              </button>
            </div>
          </motion.div>
        )}

        {/* Conversing B */}
        {state === 'conversing_b' && setup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <ScenarioCard
              name={setup.scenario.name}
              category={setup.scenario.category}
              difficulty={setup.scenario.difficulty}
              description={setup.scenario.description}
              maxTurns={setup.scenario.max_turns}
              maxDuration={setup.scenario.max_duration_seconds}
            />
            <div className="grid grid-cols-2 gap-4">
              <ConversationSummary
                label="Agent A"
                color={COLORS.a}
                totalTurns={convA?.total_turns || 0}
                durationSeconds={convA?.duration_seconds || 0}
              />
              <div className="rounded-xl border-2 border-dashed border-accent/30 flex items-center justify-center p-4">
                <span className="text-xs text-accent font-[family-name:var(--font-mono)] uppercase tracking-wider">
                  In progress
                </span>
              </div>
            </div>
            <AgentConversation
              wsUrl={api.agent.getStreamUrl(setup.id, 'b')}
              label="Agent B"
              color={COLORS.b}
              maxDuration={setup.scenario.max_duration_seconds || 120}
              onConversationEnd={handleConvBEnd}
              onError={handleConvError}
            />
          </motion.div>
        )}

        {/* Voting */}
        {state === 'voting' && setup && convA && convB && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">
              Which agent handled the task better?
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <ConversationSummary
                label="Agent A"
                color={COLORS.a}
                totalTurns={convA.total_turns}
                durationSeconds={convA.duration_seconds}
              />
              <ConversationSummary
                label="Agent B"
                color={COLORS.b}
                totalTurns={convB.total_turns}
                durationSeconds={convB.duration_seconds}
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <VoteButton label="Agent A" active={voted === 'a'} color={COLORS.a} disabled={voting} onClick={() => handleVote('a')} />
              <VoteButton label="Agent B" active={voted === 'b'} color={COLORS.b} disabled={voting} onClick={() => handleVote('b')} />
              <VoteButton label="Tie" active={voted === 'tie'} color="#888899" disabled={voting} onClick={() => handleVote('tie')} />
            </div>

            <AgentSubDimensionVoter onSubVotesChange={setSubVotes} />
          </motion.div>
        )}

        {/* Revealed */}
        {state === 'revealed' && setup && metrics && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Battle Results</h2>

            {/* Agent details */}
            <div className="grid grid-cols-2 gap-4">
              {[metrics.metrics_a, metrics.metrics_b].map((m) => {
                if (!m) return null
                const color = m.agent_label === 'a' ? COLORS.a : COLORS.b
                const isWinner = voted === m.agent_label
                return (
                  <motion.div
                    key={m.agent_label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border bg-bg-secondary p-4"
                    style={{ borderColor: isWinner ? color : '#282A3A' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold text-text-primary">
                        Agent {m.agent_label.toUpperCase()}
                        {isWinner && ' (Winner)'}
                      </span>
                    </div>
                    <p className="text-xs text-accent font-[family-name:var(--font-mono)] mb-2">
                      {m.config_name}
                    </p>
                    <p className="text-xs text-text-faint mb-3">
                      {m.provider} &middot; {m.components.stt} + {m.components.llm} + {m.components.tts}
                    </p>
                    <div className="space-y-1 text-xs font-[family-name:var(--font-mono)] text-text-body">
                      {m.total_turns != null && <p>Turns: {m.total_turns}</p>}
                      {m.duration_seconds != null && <p>Duration: {m.duration_seconds.toFixed(1)}s</p>}
                      {m.avg_latency_ms != null && <p>Avg latency: {m.avg_latency_ms.toFixed(0)}ms</p>}
                      {m.task_success != null && (
                        <p>
                          Task success:{' '}
                          <span className={m.task_success ? 'text-green-400' : 'text-red-400'}>
                            {m.task_success ? 'Yes' : 'No'}
                          </span>
                        </p>
                      )}
                      {m.joint_goal_accuracy != null && (
                        <p>Goal accuracy: {(m.joint_goal_accuracy * 100).toFixed(0)}%</p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Evaluation status */}
            {metrics.status !== 'complete' && (
              <div className="flex items-center gap-2 justify-center text-text-faint">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs font-[family-name:var(--font-mono)]">
                  Running automated evaluation...
                </span>
              </div>
            )}

            {/* Next battle */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleNextBattle}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                Next Battle
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Revealed but metrics not yet loaded — show basic reveal */}
        {state === 'revealed' && setup && !metrics && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}
    </>
  )
}
