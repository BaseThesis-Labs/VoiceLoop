import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shuffle,
  HelpCircle,
  Share2,
  ArrowRight,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import AudioPlayerCard from '../components/AudioPlayerCard'
import VoteButton from '../components/VoteButton'
import { api, type GeneratedBattle } from '../api/client'
import { ModeSelector, getStoredMode, type BattleMode } from '../components/ModeSelector'
import S2SBattlePage from './S2SBattlePage'
import STTBattlePage from './STTBattlePage'

// ---- Types ----
type ModelLabel = 'a' | 'b' | 'c' | 'd'
type VoteChoice = ModelLabel | 'all_bad' | null
type PlayingState = ModelLabel | null

// ---- Constants ----
const COLORS: Record<ModelLabel, string> = {
  a: '#6366f1', // indigo
  b: '#f59e0b', // amber
  c: '#10b981', // emerald
  d: '#ec4899', // pink
}

const LABEL_NAMES: Record<ModelLabel, string> = {
  a: 'Model A',
  b: 'Model B',
  c: 'Model C',
  d: 'Model D',
}

// ---- Component ----
export default function BattlePage() {
  const [playing, setPlaying] = useState<PlayingState>(null)
  const [voted, setVoted] = useState<VoteChoice>(null)
  const [revealed, setRevealed] = useState(false)
  const [hasPlayed, setHasPlayed] = useState<Record<ModelLabel, boolean>>({
    a: false, b: false, c: false, d: false,
  })

  // API state
  const [battle, setBattle] = useState<GeneratedBattle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [battleCount, setBattleCount] = useState(0)
  const [voting, setVoting] = useState(false)
  const [battleMode, setBattleMode] = useState<BattleMode>(getStoredMode)

  // Audio refs + progress
  const audioRefs = {
    a: useRef<HTMLAudioElement>(null),
    b: useRef<HTMLAudioElement>(null),
    c: useRef<HTMLAudioElement>(null),
    d: useRef<HTMLAudioElement>(null),
  }
  const [progress, setProgress] = useState<Record<ModelLabel, number>>({
    a: 0, b: 0, c: 0, d: 0,
  })

  // Which models are present in this battle
  const activeModels: ModelLabel[] = battle
    ? (['a', 'b'] as ModelLabel[])
        .concat(battle.audio_c_url ? ['c'] : [])
        .concat(battle.audio_d_url ? ['d'] : [])
    : []

  const allPlayed = activeModels.every((m) => hasPlayed[m])

  const loadBattle = useCallback(async () => {
    setLoading(true)
    setError(null)
    setBattle(null)
    try {
      const result = await api.battles.generate(battleMode)
      setBattle(result)
      setBattleCount((c) => c + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate battle')
    } finally {
      setLoading(false)
    }
  }, [battleMode])

  useEffect(() => {
    loadBattle()
  }, [loadBattle])

  // Audio event handlers
  useEffect(() => {
    const labels: ModelLabel[] = ['a', 'b', 'c', 'd']
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
  }, [battle])

  function handlePlay(model: ModelLabel) {
    const allAudios = (['a', 'b', 'c', 'd'] as ModelLabel[]).map((l) => audioRefs[l].current)

    if (playing === model) {
      audioRefs[model].current?.pause()
      setPlaying(null)
    } else {
      // Pause all others
      allAudios.forEach((a) => a?.pause())
      audioRefs[model].current?.play()
      setHasPlayed((p) => ({ ...p, [model]: true }))
      setPlaying(model)
    }
  }

  async function handleVote(choice: VoteChoice) {
    if (!battle || !choice) return

    setVoting(true)
    try {
      if (choice === 'all_bad') {
        await api.battles.vote(battle.id, 'all_bad')
      } else {
        await api.battles.vote(battle.id, choice)
      }
    } catch {
      // Vote failed silently — still reveal
    }
    setVoted(choice)
    setRevealed(true)
    setVoting(false)

    // Stop all audio on vote
    for (const label of ['a', 'b', 'c', 'd'] as ModelLabel[]) {
      audioRefs[label].current?.pause()
    }
    setPlaying(null)
  }

  function handleNextBattle() {
    setPlaying(null)
    setVoted(null)
    setRevealed(false)
    setHasPlayed({ a: false, b: false, c: false, d: false })
    setProgress({ a: 0, b: 0, c: 0, d: 0 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    loadBattle()
  }

  function handleModeChange(mode: BattleMode) {
    setBattleMode(mode)
  }

  useEffect(() => {
    // Reset state when mode changes
    setPlaying(null)
    setVoted(null)
    setRevealed(false)
    setHasPlayed({ a: false, b: false, c: false, d: false })
    setProgress({ a: 0, b: 0, c: 0, d: 0 })
  }, [battleMode])

  function getModelInfo(label: ModelLabel) {
    if (!battle) return { name: '', provider: '', duration: 0, ttfb: 0 }
    const map: Record<ModelLabel, { name: string; provider: string; duration: number; ttfb: number }> = {
      a: { name: battle.model_a_name, provider: battle.provider_a, duration: battle.duration_a, ttfb: battle.ttfb_a },
      b: { name: battle.model_b_name, provider: battle.provider_b, duration: battle.duration_b, ttfb: battle.ttfb_b },
      c: { name: battle.model_c_name ?? '', provider: battle.provider_c ?? '', duration: battle.duration_c ?? 0, ttfb: battle.ttfb_c ?? 0 },
      d: { name: battle.model_d_name ?? '', provider: battle.provider_d ?? '', duration: battle.duration_d ?? 0, ttfb: battle.ttfb_d ?? 0 },
    }
    return map[label]
  }

  // Route to S2S battle page when in S2S mode
  if (battleMode === 's2s') {
    return <S2SBattlePage onModeChange={handleModeChange} battleCount={battleCount} />
  }

  // Route to STT battle page when in STT mode
  if (battleMode === 'stt') {
    return <STTBattlePage onModeChange={handleModeChange} battleCount={battleCount} />
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-5xl mx-auto px-6 pt-10">
        {/* Hidden audio elements */}
        {battle && (
          <>
            <audio ref={audioRefs.a} src={battle.audio_a_url} preload="auto" />
            <audio ref={audioRefs.b} src={battle.audio_b_url} preload="auto" />
            {battle.audio_c_url && <audio ref={audioRefs.c} src={battle.audio_c_url} preload="auto" />}
            {battle.audio_d_url && <audio ref={audioRefs.d} src={battle.audio_d_url} preload="auto" />}
          </>
        )}

        {/* Header + Mode Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-accent" />
              <span className="font-[family-name:var(--font-mono)] text-sm text-text-body">
                Battle <span className="text-text-primary">#{battleCount}</span>
              </span>
            </div>
            <button className="flex items-center gap-1.5 text-xs text-text-body hover:text-text-primary transition-colors group">
              <HelpCircle size={14} className="text-text-faint group-hover:text-text-body transition-colors" />
              How it works
            </button>
          </div>
          <ModeSelector active={battleMode} onChange={handleModeChange} />
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
              Generating battle audio...
            </p>
            <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mt-1">
              This takes 3-8 seconds for 4 models
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !loading && (
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
              onClick={loadBattle}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
            >
              Retry
            </motion.button>
          </motion.div>
        )}

        {/* Battle Content */}
        {battle && !loading && !error && (
          <>
            {/* Prompt Card */}
            <div className="bg-bg-surface rounded-xl border border-border-default p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint">
                  Prompt
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-text-faint px-2 py-0.5 rounded bg-bg-hover border border-border-default">
                  {battle.prompt_category}
                </span>
              </div>
              <p className="text-text-primary text-[15px] leading-relaxed mb-4">
                {battle.prompt_text}
              </p>
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleNextBattle}
                  className="flex items-center gap-2 text-xs text-text-body hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg border border-border-default hover:border-border-strong bg-bg-hover/50"
                >
                  <Shuffle size={13} />
                  New Prompt
                </motion.button>
              </div>
            </div>

            {/* 4-Model Audio Grid (2x2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  revealed={revealed}
                  provider={revealed ? getModelInfo(label).provider : undefined}
                />
              ))}
            </div>

            {/* Vote Panel */}
            <AnimatePresence mode="wait">
              {!revealed ? (
                <motion.div
                  key="vote-panel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="bg-bg-surface rounded-xl border border-border-default p-6 mb-4"
                >
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint text-center mb-5">
                    {voting ? 'Submitting vote...' : 'Which voice sounds best?'}
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
              {revealed && (
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {activeModels.map((label, idx) => {
                          const info = getModelInfo(label)
                          const isWinner = voted === label
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
                                    {info.name}
                                  </p>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent shrink-0">
                                    {info.provider}
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

                      {/* Metrics Comparison */}
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
                                  const ttfbs = activeModels.map((l) => getModelInfo(l).ttfb)
                                  const minTtfb = Math.min(...ttfbs)
                                  return (
                                    <>
                                      <tr className="bg-bg-surface">
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
                                      <tr className="bg-bg-hover/50">
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

