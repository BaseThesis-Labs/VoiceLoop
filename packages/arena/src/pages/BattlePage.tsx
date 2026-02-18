import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Shuffle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Share2,
  ArrowRight,
  Zap,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import WaveformVisualizer from '../components/WaveformVisualizer'
import { api, type GeneratedBattle } from '../api/client'

// ---- Types ----
type VoteChoice = 'a' | 'b' | 'tie' | 'both_bad' | null
type PlayingState = 'a' | 'b' | null
type DimensionRating = 0 | 1 | 2 | 3 | 4

// ---- Constants ----
const COLOR_A = '#6366f1'
const COLOR_B = '#f59e0b'

const DIMENSIONS = ['Naturalness', 'Clarity', 'Expressiveness', 'Pacing'] as const

// ---- Component ----
export default function BattlePage() {
  const [playing, setPlaying] = useState<PlayingState>(null)
  const [voted, setVoted] = useState<VoteChoice>(null)
  const [showDimensions, setShowDimensions] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [dimensions, setDimensions] = useState<Record<string, DimensionRating>>({
    Naturalness: 2,
    Clarity: 2,
    Expressiveness: 2,
    Pacing: 2,
  })
  const [hasPlayedA, setHasPlayedA] = useState(false)
  const [hasPlayedB, setHasPlayedB] = useState(false)

  // API state
  const [battle, setBattle] = useState<GeneratedBattle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [battleCount, setBattleCount] = useState(0)
  const [voting, setVoting] = useState(false)

  // Audio refs + progress
  const audioARef = useRef<HTMLAudioElement>(null)
  const audioBRef = useRef<HTMLAudioElement>(null)
  const [progressA, setProgressA] = useState(0)
  const [progressB, setProgressB] = useState(0)

  const loadBattle = useCallback(async () => {
    setLoading(true)
    setError(null)
    setBattle(null)
    try {
      const result = await api.battles.generate()
      setBattle(result)
      setBattleCount((c) => c + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate battle')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBattle()
  }, [loadBattle])

  // Audio event handlers
  useEffect(() => {
    const audioA = audioARef.current
    const audioB = audioBRef.current
    if (!audioA || !audioB) return

    const onTimeUpdateA = () => {
      if (audioA.duration) setProgressA(audioA.currentTime / audioA.duration)
    }
    const onTimeUpdateB = () => {
      if (audioB.duration) setProgressB(audioB.currentTime / audioB.duration)
    }
    const onEndedA = () => {
      setPlaying((p) => (p === 'a' ? null : p))
      setProgressA(1)
    }
    const onEndedB = () => {
      setPlaying((p) => (p === 'b' ? null : p))
      setProgressB(1)
    }

    audioA.addEventListener('timeupdate', onTimeUpdateA)
    audioB.addEventListener('timeupdate', onTimeUpdateB)
    audioA.addEventListener('ended', onEndedA)
    audioB.addEventListener('ended', onEndedB)

    return () => {
      audioA.removeEventListener('timeupdate', onTimeUpdateA)
      audioB.removeEventListener('timeupdate', onTimeUpdateB)
      audioA.removeEventListener('ended', onEndedA)
      audioB.removeEventListener('ended', onEndedB)
    }
  }, [battle])

  function handlePlay(model: 'a' | 'b') {
    const audioA = audioARef.current
    const audioB = audioBRef.current
    if (!audioA || !audioB) return

    if (playing === model) {
      // Pause current
      if (model === 'a') audioA.pause()
      else audioB.pause()
      setPlaying(null)
    } else {
      // Pause the other, play this one
      if (model === 'a') {
        audioB.pause()
        audioA.play()
        setHasPlayedA(true)
      } else {
        audioA.pause()
        audioB.play()
        setHasPlayedB(true)
      }
      setPlaying(model)
    }
  }

  async function handleVote(choice: VoteChoice) {
    if (!battle || !choice || choice === 'both_bad') {
      // "both_bad" is recorded locally only (no winner)
      setVoted(choice)
      setRevealed(true)
      return
    }
    setVoting(true)
    try {
      const winner = choice === 'tie' ? 'tie' : choice
      await api.battles.vote(battle.id, winner)
    } catch {
      // Vote failed silently — still reveal
    }
    setVoted(choice)
    setRevealed(true)
    setVoting(false)

    // Stop audio on vote
    audioARef.current?.pause()
    audioBRef.current?.pause()
    setPlaying(null)
  }

  function handleNextBattle() {
    setPlaying(null)
    setVoted(null)
    setRevealed(false)
    setShowDimensions(false)
    setHasPlayedA(false)
    setHasPlayedB(false)
    setProgressA(0)
    setProgressB(0)
    setDimensions({ Naturalness: 2, Clarity: 2, Expressiveness: 2, Pacing: 2 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    loadBattle()
  }

  const bothPlayed = hasPlayedA && hasPlayedB

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-4xl mx-auto px-6 pt-10">
        {/* Hidden audio elements */}
        {battle && (
          <>
            <audio ref={audioARef} src={battle.audio_a_url} preload="auto" />
            <audio ref={audioBRef} src={battle.audio_b_url} preload="auto" />
          </>
        )}

        {/* ================================ */}
        {/* Header Bar                       */}
        {/* ================================ */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-text-faint">
              Voice Model Battle
            </h1>
            <button className="flex items-center gap-1.5 text-xs text-text-body hover:text-text-primary transition-colors group">
              <HelpCircle size={14} className="text-text-faint group-hover:text-text-body transition-colors" />
              How it works
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent" />
            <span className="font-[family-name:var(--font-mono)] text-sm text-text-body">
              Battle <span className="text-text-primary">#{battleCount}</span>
            </span>
          </div>
        </div>

        {/* ================================ */}
        {/* Loading State                    */}
        {/* ================================ */}
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
              This takes 2-5 seconds
            </p>
          </motion.div>
        )}

        {/* ================================ */}
        {/* Error State                      */}
        {/* ================================ */}
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

        {/* ================================ */}
        {/* Battle Content                   */}
        {/* ================================ */}
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

            {/* Dual Audio Players */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <AudioPlayerCard
                label="Model A"
                provider={battle.provider_a}
                color={COLOR_A}
                isPlaying={playing === 'a'}
                hasPlayed={hasPlayedA}
                onTogglePlay={() => handlePlay('a')}
                duration={`${battle.duration_a.toFixed(1)}s`}
                ttfb={`${Math.round(battle.ttfb_a)}ms`}
                progress={progressA}
              />
              <AudioPlayerCard
                label="Model B"
                provider={battle.provider_b}
                color={COLOR_B}
                isPlaying={playing === 'b'}
                hasPlayed={hasPlayedB}
                onTogglePlay={() => handlePlay('b')}
                duration={`${battle.duration_b.toFixed(1)}s`}
                ttfb={`${Math.round(battle.ttfb_b)}ms`}
                progress={progressB}
              />
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
                    {voting ? 'Submitting vote...' : 'Vote'}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <VoteButton
                      label="A is better"
                      active={voted === 'a'}
                      color={COLOR_A}
                      variant="a"
                      disabled={!bothPlayed || voting}
                      onClick={() => handleVote('a')}
                    />
                    <VoteButton
                      label="Tie"
                      active={voted === 'tie'}
                      color="#888899"
                      variant="tie"
                      disabled={!bothPlayed || voting}
                      onClick={() => handleVote('tie')}
                    />
                    <VoteButton
                      label="B is better"
                      active={voted === 'b'}
                      color={COLOR_B}
                      variant="b"
                      disabled={!bothPlayed || voting}
                      onClick={() => handleVote('b')}
                    />
                    <VoteButton
                      label="Both bad"
                      active={voted === 'both_bad'}
                      color="#ef4444"
                      variant="both_bad"
                      disabled={!bothPlayed || voting}
                      onClick={() => handleVote('both_bad')}
                    />
                  </div>
                  {!bothPlayed && (
                    <p className="text-center text-text-faint text-xs mt-4 font-[family-name:var(--font-mono)]">
                      Listen to both models before voting
                    </p>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Dimension Ratings (Optional) */}
            {!revealed && (
              <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden mb-6">
                <button
                  onClick={() => setShowDimensions(!showDimensions)}
                  className="w-full flex items-center justify-between px-6 py-4 text-sm text-text-body hover:text-text-primary transition-colors"
                >
                  <span>Rate dimensions (optional)</span>
                  {showDimensions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <AnimatePresence>
                  {showDimensions && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 space-y-5 border-t border-border-default">
                        {DIMENSIONS.map((dim) => (
                          <DimensionScale
                            key={dim}
                            label={dim}
                            value={dimensions[dim]}
                            onChange={(v) => setDimensions((d) => ({ ...d, [dim]: v }))}
                          />
                        ))}
                        <p className="text-[11px] text-text-faint font-[family-name:var(--font-mono)] text-center pt-1">
                          Left = A better &middot; Center = Tie &middot; Right = B better
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

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
                        <motion.div
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-hover border border-border-default"
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_A }} />
                          <div>
                            <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Model A</p>
                            <div className="flex items-center gap-2">
                              <p className="text-text-primary font-medium text-sm">{battle.model_a_name}</p>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent">
                                {battle.provider_a}
                              </span>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-hover border border-border-default"
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_B }} />
                          <div>
                            <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Model B</p>
                            <div className="flex items-center gap-2">
                              <p className="text-text-primary font-medium text-sm">{battle.model_b_name}</p>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent">
                                {battle.provider_b}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </div>

                      {/* Your vote */}
                      <div className="text-center mb-6">
                        <span className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Your vote: </span>
                        <span className="text-sm font-medium" style={{
                          color: voted === 'a' ? COLOR_A : voted === 'b' ? COLOR_B : voted === 'both_bad' ? '#ef4444' : '#888899',
                        }}>
                          {voted === 'a' ? 'A is better' : voted === 'b' ? 'B is better' : voted === 'tie' ? 'Tie' : 'Both bad'}
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
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-bg-hover">
                                <th className="text-left px-4 py-2.5 text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider font-normal">
                                  Metric
                                </th>
                                <th className="text-right px-4 py-2.5 text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider font-normal">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_A }} />
                                    Model A
                                  </span>
                                </th>
                                <th className="text-right px-4 py-2.5 text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider font-normal">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_B }} />
                                    Model B
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: 'TTFB', a: `${Math.round(battle.ttfb_a)}ms`, b: `${Math.round(battle.ttfb_b)}ms`, aBetter: battle.ttfb_a < battle.ttfb_b },
                                { label: 'Duration', a: `${battle.duration_a.toFixed(1)}s`, b: `${battle.duration_b.toFixed(1)}s`, aBetter: false },
                              ].map((row, idx) => (
                                <tr
                                  key={row.label}
                                  className={idx % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-hover/50'}
                                >
                                  <td className="px-4 py-2.5 text-text-body font-[family-name:var(--font-mono)] text-xs">
                                    {row.label}
                                  </td>
                                  <td className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs ${
                                    row.aBetter ? 'text-accent font-semibold' : 'text-text-body'
                                  }`}>
                                    {row.a}
                                  </td>
                                  <td className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs ${
                                    !row.aBetter && row.label === 'TTFB' ? 'text-accent font-semibold' : 'text-text-body'
                                  }`}>
                                    {row.b}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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

// ============================================================
// AudioPlayerCard
// ============================================================
function AudioPlayerCard({
  label,
  provider,
  color,
  isPlaying,
  hasPlayed,
  onTogglePlay,
  duration,
  ttfb,
  progress,
}: {
  label: string
  provider: string
  color: string
  isPlaying: boolean
  hasPlayed: boolean
  onTogglePlay: () => void
  duration: string
  ttfb: string
  progress: number
}) {
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
        <span className="px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent">
          {provider}
        </span>
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

// ============================================================
// VoteButton
// ============================================================
function VoteButton({
  label,
  active,
  color,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  color: string
  variant: 'a' | 'b' | 'tie' | 'both_bad'
  disabled: boolean
  onClick: () => void
}) {
  const borderColor = active ? color : '#282A3A'
  const bgColor = active ? `${color}18` : 'transparent'

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.04 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
      }`}
      style={{
        borderColor,
        backgroundColor: bgColor,
        color: active ? color : '#888899',
      }}
    >
      {active && (
        <motion.div
          layoutId="vote-highlight"
          className="absolute inset-0 rounded-lg"
          style={{ boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}08` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </motion.button>
  )
}

// ============================================================
// DimensionScale
// ============================================================
function DimensionScale({
  label,
  value,
  onChange,
}: {
  label: string
  value: DimensionRating
  onChange: (v: DimensionRating) => void
}) {
  const dotLabels = ['A++', 'A+', 'Tie', 'B+', 'B++']
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-text-body w-28 shrink-0">{label}</span>
      <div className="flex-1 flex items-center justify-center gap-3">
        {[0, 1, 2, 3, 4].map((i) => {
          const isActive = value === i
          const dotColor =
            i < 2 ? COLOR_A : i > 2 ? COLOR_B : '#888899'
          return (
            <button
              key={i}
              onClick={() => onChange(i as DimensionRating)}
              className="group relative flex flex-col items-center gap-1.5"
            >
              <motion.div
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.85 }}
                className="w-4 h-4 rounded-full border-2 transition-all"
                style={{
                  borderColor: isActive ? dotColor : '#282A3A',
                  backgroundColor: isActive ? dotColor : 'transparent',
                  boxShadow: isActive ? `0 0 8px ${dotColor}40` : 'none',
                }}
              />
              <span className="text-[9px] font-[family-name:var(--font-mono)] text-text-faint opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4">
                {dotLabels[i]}
              </span>
            </button>
          )
        })}
      </div>
      <div className="w-28 shrink-0" />
    </div>
  )
}
