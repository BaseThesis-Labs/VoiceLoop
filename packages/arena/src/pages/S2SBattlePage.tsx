import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  ArrowRight,
  Zap,
  HelpCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import AudioPlayerCard from '../components/AudioPlayerCard'
import VoteButton from '../components/VoteButton'
import GatedLoadingState from '../components/GatedLoadingState'
import DimensionVoter from '../components/DimensionVoter'
import S2SInputPanel from '../components/S2SInputPanel'
import { ModeSelector, type BattleMode } from '../components/ModeSelector'
import {
  api,
  type S2SBattleSetup,
  type S2SBattleResult,
  type S2SMetrics,
} from '../api/client'

// ---- Types ----
type ModelLabel = 'a' | 'b' | 'c'
type VoteChoice = ModelLabel | 'all_bad' | null
type PlayingState = ModelLabel | null
type S2SState = 'idle' | 'recording' | 'processing' | 'playing' | 'voting' | 'revealed'

// ---- Constants ----
const COLORS: Record<ModelLabel, string> = {
  a: '#6366f1',
  b: '#f59e0b',
  c: '#10b981',
}

const LABEL_NAMES: Record<ModelLabel, string> = {
  a: 'Model A',
  b: 'Model B',
  c: 'Model C',
}

// ---- Component ----
export default function S2SBattlePage({
  onModeChange,
  battleCount: externalBattleCount,
}: {
  onModeChange: (mode: BattleMode) => void
  battleCount: number
}) {
  const [state, setState] = useState<S2SState>('idle')
  const [setup, setSetup] = useState<S2SBattleSetup | null>(null)
  const [result, setResult] = useState<S2SBattleResult | null>(null)
  const [metrics, setMetrics] = useState<S2SMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [battleCount, setBattleCount] = useState(externalBattleCount)

  // Playback state
  const [playing, setPlaying] = useState<PlayingState>(null)
  const [hasPlayed, setHasPlayed] = useState<Record<ModelLabel, boolean>>({ a: false, b: false, c: false })
  const [progress, setProgress] = useState<Record<ModelLabel, number>>({ a: 0, b: 0, c: 0 })
  const [voted, setVoted] = useState<VoteChoice>(null)
  const [voting, setVoting] = useState(false)
  const [subVotes, setSubVotes] = useState<Record<string, string>>({})

  // Processing timer
  const [processingElapsed, setProcessingElapsed] = useState(0)
  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Audio refs
  const audioRefs = {
    a: useRef<HTMLAudioElement>(null),
    b: useRef<HTMLAudioElement>(null),
    c: useRef<HTMLAudioElement>(null),
  }
  const inputAudioRef = useRef<HTMLAudioElement>(null)

  // Metrics polling
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeModels: ModelLabel[] = result
    ? (['a', 'b'] as ModelLabel[]).concat(result.audio_c_url ? ['c'] : [])
    : []

  const allPlayed = activeModels.length > 0 && activeModels.every((m) => hasPlayed[m])

  // ---------- Setup battle (step 1) ----------
  const initBattle = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSetup(null)
    setResult(null)
    setMetrics(null)
    setState('idle')
    try {
      const s = await api.s2s.setup()
      setSetup(s)
      setBattleCount((c) => c + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set up S2S battle')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initBattle()
  }, [initBattle])

  // ---------- Submit audio (step 2) ----------
  async function handleSubmitAudio(audio: Blob | null, curatedPromptId: string | null) {
    if (!setup) return
    setState('processing')
    setProcessingElapsed(0)

    processingTimerRef.current = setInterval(() => {
      setProcessingElapsed((e) => e + 100)
    }, 100)

    try {
      const res = await api.s2s.submitAudio(
        setup.id,
        audio,
        curatedPromptId ?? undefined,
      )
      setResult(res)
      setState('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process audio')
      setState('idle')
    } finally {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current)
        processingTimerRef.current = null
      }
    }
  }

  // ---------- Audio event handlers ----------
  useEffect(() => {
    const labels: ModelLabel[] = ['a', 'b', 'c']
    const cleanups: (() => void)[] = []

    for (const label of labels) {
      const audio = audioRefs[label].current
      if (!audio) continue

      const onTimeUpdate = () => {
        if (audio.duration) {
          setProgress((p) => ({ ...p, [label]: audio.currentTime / audio.duration }))
        }
      }
      const onEnded = () => {
        setPlaying((p) => (p === label ? null : p))
        setProgress((p) => ({ ...p, [label]: 1 }))
      }

      audio.addEventListener('timeupdate', onTimeUpdate)
      audio.addEventListener('ended', onEnded)
      cleanups.push(() => {
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('ended', onEnded)
      })
    }

    return () => cleanups.forEach((fn) => fn())
  }, [result])

  function handlePlay(model: ModelLabel) {
    const allAudios = (['a', 'b', 'c'] as ModelLabel[]).map((l) => audioRefs[l].current)

    if (playing === model) {
      audioRefs[model].current?.pause()
      setPlaying(null)
    } else {
      allAudios.forEach((a) => a?.pause())
      audioRefs[model].current?.play()
      setHasPlayed((p) => ({ ...p, [model]: true }))
      setPlaying(model)
    }
  }

  // ---------- Voting ----------
  async function handleVote(choice: VoteChoice) {
    if (!setup || !choice) return

    setVoting(true)
    try {
      const allSubVotes = Object.keys(subVotes).length > 0 ? subVotes : undefined
      await api.battles.vote(setup.id, choice as 'a' | 'b' | 'c' | 'tie' | 'all_bad', allSubVotes)
    } catch {
      // Vote failed silently — still reveal
    }
    setVoted(choice)
    setState('revealed')
    setVoting(false)

    // Stop all audio
    for (const label of ['a', 'b', 'c'] as ModelLabel[]) {
      audioRefs[label].current?.pause()
    }
    setPlaying(null)

    // Start metrics polling
    startMetricsPolling()
  }

  function startMetricsPolling() {
    if (!setup) return
    const battleId = setup.id

    metricsIntervalRef.current = setInterval(async () => {
      try {
        const m = await api.s2s.getMetrics(battleId)
        setMetrics(m)
        if (m.status === 'complete') {
          if (metricsIntervalRef.current) {
            clearInterval(metricsIntervalRef.current)
            metricsIntervalRef.current = null
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 1000)
  }

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current)
    }
  }, [])

  // ---------- Next battle ----------
  function handleNextBattle() {
    setPlaying(null)
    setVoted(null)
    setSubVotes({})
    setHasPlayed({ a: false, b: false, c: false })
    setProgress({ a: 0, b: 0, c: 0 })
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
      metricsIntervalRef.current = null
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    initBattle()
  }

  function getModelInfo(label: ModelLabel) {
    if (!result) return { e2eLatency: 0, duration: 0, ttfb: 0 }
    const map: Record<ModelLabel, { e2eLatency: number; duration: number; ttfb: number }> = {
      a: { e2eLatency: result.e2e_latency_a, duration: result.duration_a, ttfb: result.ttfb_a },
      b: { e2eLatency: result.e2e_latency_b, duration: result.duration_b, ttfb: result.ttfb_b },
      c: { e2eLatency: result.e2e_latency_c ?? 0, duration: result.duration_c ?? 0, ttfb: result.ttfb_c ?? 0 },
    }
    return map[label]
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-5xl mx-auto px-6 pt-10">
        {/* Hidden audio elements */}
        {result && (
          <>
            <audio ref={audioRefs.a} src={result.audio_a_url} preload="auto" />
            <audio ref={audioRefs.b} src={result.audio_b_url} preload="auto" />
            {result.audio_c_url && <audio ref={audioRefs.c} src={result.audio_c_url} preload="auto" />}
            {result.input_audio_url && <audio ref={inputAudioRef} src={result.input_audio_url} preload="auto" />}
          </>
        )}

        {/* Header + Mode Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-accent" />
              <span className="font-[family-name:var(--font-mono)] text-sm text-text-body">
                S2S Battle <span className="text-text-primary">#{battleCount}</span>
              </span>
            </div>
            <button className="flex items-center gap-1.5 text-xs text-text-body hover:text-text-primary transition-colors group">
              <HelpCircle size={14} className="text-text-faint group-hover:text-text-body transition-colors" />
              How it works
            </button>
          </div>
          <ModeSelector active="s2s" onChange={onModeChange} />
        </div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32"
          >
            <Loader2 size={32} className="text-accent animate-spin mb-4" />
            <p className="text-text-body text-sm font-[family-name:var(--font-mono)]">
              Setting up S2S battle...
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {error && state !== 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32"
          >
            <AlertCircle size={32} className="text-red-400 mb-4" />
            <p className="text-text-body text-sm mb-4">{error}</p>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={initBattle}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
            >
              Retry
            </motion.button>
          </motion.div>
        )}

        {/* Idle: Input panel */}
        {state === 'idle' && setup && !loading && !error && (
          <S2SInputPanel
            curatedPrompts={setup.curated_prompts ?? []}
            onSubmitAudio={handleSubmitAudio}
          />
        )}

        {/* Processing: Gated loading */}
        {state === 'processing' && setup && (
          <GatedLoadingState
            modelCount={setup.model_count}
            elapsedMs={processingElapsed}
          />
        )}

        {/* Playing + Voting + Revealed */}
        {(state === 'playing' || state === 'voting' || state === 'revealed') && result && (
          <>
            {/* Input audio replay card */}
            {result.input_transcript && (
              <div className="bg-bg-surface rounded-xl border border-border-default p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint">
                    Your Input
                  </span>
                </div>
                <p className="text-text-primary text-sm leading-relaxed">
                  {result.input_transcript}
                </p>
              </div>
            )}

            {/* Model Audio Grid */}
            <div className={`grid grid-cols-1 ${activeModels.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-6`}>
              {activeModels.map((label) => (
                <AudioPlayerCard
                  key={label}
                  label={LABEL_NAMES[label]}
                  color={COLORS[label]}
                  isPlaying={playing === label}
                  hasPlayed={hasPlayed[label]}
                  onTogglePlay={() => handlePlay(label)}
                  duration={`${getModelInfo(label).duration.toFixed(1)}s`}
                  ttfb={`${Math.round(getModelInfo(label).ttfb)}ms`}
                  progress={progress[label]}
                  revealed={state === 'revealed'}
                  provider={state === 'revealed' && metrics?.providers ? metrics.providers[label] : undefined}
                />
              ))}
            </div>

            {/* Vote Panel */}
            <AnimatePresence mode="wait">
              {state !== 'revealed' ? (
                <motion.div
                  key="vote-panel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="bg-bg-surface rounded-xl border border-border-default p-6 mb-4"
                >
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint text-center mb-5">
                    {voting ? 'Submitting vote...' : 'Which response sounds best?'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {activeModels.map((label) => (
                      <VoteButton
                        key={label}
                        label={`${LABEL_NAMES[label].split(' ')[1]} is best`}
                        active={voted === label}
                        color={COLORS[label]}
                        disabled={!allPlayed || voting}
                        onClick={() => handleVote(label)}
                      />
                    ))}
                    <VoteButton
                      label="All bad"
                      active={voted === 'all_bad'}
                      color="#ef4444"
                      disabled={!allPlayed || voting}
                      onClick={() => handleVote('all_bad')}
                    />
                  </div>

                  {/* Dimension voter */}
                  <DimensionVoter
                    models={activeModels}
                    onSubVotesChange={setSubVotes}
                  />

                  {!allPlayed && (
                    <p className="text-center text-text-faint text-xs mt-4 font-[family-name:var(--font-mono)]">
                      Listen to all {activeModels.length} models before voting
                    </p>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Post-Vote Reveal */}
            <AnimatePresence>
              {state === 'revealed' && (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
                  className="mt-6"
                >
                  <div className="relative bg-bg-surface rounded-xl border border-accent/30 p-6 mb-4 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] via-transparent to-transparent pointer-events-none" />

                    <div className="relative z-10">
                      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-accent text-center mb-5">
                        Models Revealed
                      </p>

                      {/* Model cards */}
                      <div className={`grid grid-cols-1 ${activeModels.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-6`}>
                        {activeModels.map((label, idx) => {
                          const isWinner = voted === label
                          const modelName = metrics?.model_names?.[label] ?? '...'
                          const provider = metrics?.providers?.[label] ?? '...'
                          return (
                            <motion.div
                              key={label}
                              initial={{ opacity: 0, x: idx % 2 === 0 ? -12 : 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + idx * 0.1 }}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                                isWinner
                                  ? 'bg-accent/10 border-accent/40'
                                  : 'bg-bg-hover border-border-default'
                              }`}
                            >
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[label] }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">
                                  {LABEL_NAMES[label]}
                                  {isWinner && (
                                    <span className="ml-2 text-accent">Winner</span>
                                  )}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-text-primary font-medium text-sm truncate">
                                    {modelName}
                                  </p>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent shrink-0">
                                    {provider}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>

                      {/* Your vote */}
                      <div className="text-center mb-6">
                        <span className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Your vote: </span>
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: voted === 'all_bad' ? '#ef4444' : voted ? COLORS[voted] : '#888899',
                          }}
                        >
                          {voted === 'all_bad'
                            ? 'All bad'
                            : voted
                              ? `${LABEL_NAMES[voted].split(' ')[1]} is best`
                              : 'None'}
                        </span>
                      </div>

                      {/* Metrics table */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint mb-3">
                          Performance
                        </p>
                        <div className="rounded-lg border border-border-default overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-bg-hover">
                                  <th className="text-left px-4 py-2.5 text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider font-normal">
                                    Metric
                                  </th>
                                  {activeModels.map((label) => (
                                    <th
                                      key={label}
                                      className="text-right px-4 py-2.5 text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider font-normal"
                                    >
                                      <span className="inline-flex items-center gap-1.5">
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: COLORS[label] }}
                                        />
                                        {LABEL_NAMES[label].split(' ')[1]}
                                      </span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const e2es = activeModels.map((l) => getModelInfo(l).e2eLatency)
                                  const minE2e = Math.min(...e2es)
                                  const ttfbs = activeModels.map((l) => getModelInfo(l).ttfb)
                                  const minTtfb = Math.min(...ttfbs)
                                  return (
                                    <>
                                      <tr className="bg-bg-surface">
                                        <td className="px-4 py-2.5 text-text-body font-[family-name:var(--font-mono)] text-xs">
                                          E2E Latency
                                        </td>
                                        {activeModels.map((label) => {
                                          const e2e = getModelInfo(label).e2eLatency
                                          const isBest = e2e === minE2e
                                          return (
                                            <td
                                              key={label}
                                              className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs ${
                                                isBest ? 'text-accent font-semibold' : 'text-text-body'
                                              }`}
                                            >
                                              {Math.round(e2e)}ms
                                            </td>
                                          )
                                        })}
                                      </tr>
                                      <tr className="bg-bg-hover/50">
                                        <td className="px-4 py-2.5 text-text-body font-[family-name:var(--font-mono)] text-xs">
                                          TTFB
                                        </td>
                                        {activeModels.map((label) => {
                                          const ttfb = getModelInfo(label).ttfb
                                          const isBest = ttfb === minTtfb
                                          return (
                                            <td
                                              key={label}
                                              className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs ${
                                                isBest ? 'text-accent font-semibold' : 'text-text-body'
                                              }`}
                                            >
                                              {Math.round(ttfb)}ms
                                            </td>
                                          )
                                        })}
                                      </tr>
                                      <tr className="bg-bg-surface">
                                        <td className="px-4 py-2.5 text-text-body font-[family-name:var(--font-mono)] text-xs">
                                          Duration
                                        </td>
                                        {activeModels.map((label) => (
                                          <td
                                            key={label}
                                            className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs text-text-body"
                                          >
                                            {getModelInfo(label).duration.toFixed(1)}s
                                          </td>
                                        ))}
                                      </tr>
                                    </>
                                  )
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Progressive metrics status */}
                        {metrics && metrics.status !== 'complete' && (
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <Loader2 size={12} className="text-accent animate-spin" />
                            <span className="text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
                              Computing detailed metrics...
                            </span>
                          </div>
                        )}
                      </motion.div>

                      {/* Action Buttons */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6"
                      >
                        <button className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-body hover:text-text-primary border border-border-default hover:border-border-strong rounded-lg transition-colors bg-bg-hover/50">
                          <Share2 size={14} />
                          Share this battle
                        </button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleNextBattle}
                          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
                        >
                          Next battle
                          <ArrowRight size={14} />
                        </motion.button>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}
