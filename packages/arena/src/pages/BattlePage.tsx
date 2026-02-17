import { useState } from 'react'
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
} from 'lucide-react'
import { battlePrompts, models } from '../data/mockData'
import WaveformVisualizer from '../components/WaveformVisualizer'

// ---- Types ----
type VoteChoice = 'a' | 'b' | 'tie' | 'both_bad' | null
type PlayingState = 'a' | 'b' | null
type DimensionRating = 0 | 1 | 2 | 3 | 4

// ---- Constants ----
const COLOR_A = '#6366f1'
const COLOR_B = '#f59e0b'

const DIMENSIONS = ['Naturalness', 'Clarity', 'Expressiveness', 'Pacing'] as const

const modelA = models.find((m) => m.id === 'm2')! // ElevenLabs v3
const modelB = models.find((m) => m.id === 'm1')! // Cartesia Sonic 3

const metricsComparison = [
  { label: 'UTMOS', a: modelA.metrics.utmos, b: modelB.metrics.utmos, higher: true },
  { label: 'NISQA', a: modelA.metrics.nisqa, b: modelB.metrics.nisqa, higher: true },
  { label: 'SECS', a: modelA.metrics.secs, b: modelB.metrics.secs, higher: true },
  { label: 'WER', a: modelA.metrics.wer, b: modelB.metrics.wer, higher: false },
  { label: 'F0-RMSE', a: modelA.metrics.f0rmse, b: modelB.metrics.f0rmse, higher: false },
  { label: 'TTFB', a: modelA.metrics.ttfb, b: modelB.metrics.ttfb, higher: false },
]

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
  const [promptIndex, setPromptIndex] = useState(0)

  const currentPrompt = battlePrompts[promptIndex % battlePrompts.length]

  function handlePlay(model: 'a' | 'b') {
    if (playing === model) {
      setPlaying(null)
    } else {
      setPlaying(model)
      if (model === 'a') setHasPlayedA(true)
      if (model === 'b') setHasPlayedB(true)
    }
  }

  function handleVote(choice: VoteChoice) {
    setVoted(choice)
    setRevealed(true)
  }

  function handleNextBattle() {
    setPlaying(null)
    setVoted(null)
    setRevealed(false)
    setShowDimensions(false)
    setHasPlayedA(false)
    setHasPlayedB(false)
    setPromptIndex((i) => i + 1)
    setDimensions({ Naturalness: 2, Clarity: 2, Expressiveness: 2, Pacing: 2 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleNewPrompt() {
    setPromptIndex((i) => i + 1)
  }

  const bothPlayed = hasPlayedA && hasPlayedB

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-4xl mx-auto px-6 pt-10">
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
              Battle <span className="text-text-primary">#4,291</span>
            </span>
          </div>
        </div>

        {/* ================================ */}
        {/* Prompt Card                      */}
        {/* ================================ */}
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint">
              Prompt
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-text-faint px-2 py-0.5 rounded bg-bg-hover border border-border-default">
              {currentPrompt.category}
            </span>
          </div>
          <p className="text-text-primary text-[15px] leading-relaxed mb-4">
            {currentPrompt.text}
          </p>
          <div className="flex justify-end">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleNewPrompt}
              className="flex items-center gap-2 text-xs text-text-body hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg border border-border-default hover:border-border-strong bg-bg-hover/50"
            >
              <Shuffle size={13} />
              New Prompt
            </motion.button>
          </div>
        </div>

        {/* ================================ */}
        {/* Dual Audio Players               */}
        {/* ================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Model A */}
          <AudioPlayerCard
            label="Model A"
            color={COLOR_A}
            isPlaying={playing === 'a'}
            hasPlayed={hasPlayedA}
            onTogglePlay={() => handlePlay('a')}
            duration="8.2s"
            ttfb="180ms"
            progress={playing === 'a' ? 0.6 : hasPlayedA ? 1 : 0}
          />

          {/* Model B */}
          <AudioPlayerCard
            label="Model B"
            color={COLOR_B}
            isPlaying={playing === 'b'}
            hasPlayed={hasPlayedB}
            onTogglePlay={() => handlePlay('b')}
            duration="7.8s"
            ttfb="130ms"
            progress={playing === 'b' ? 0.35 : hasPlayedB ? 1 : 0}
          />
        </div>

        {/* ================================ */}
        {/* Vote Panel                       */}
        {/* ================================ */}
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
                Vote
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <VoteButton
                  label="A is better"
                  active={voted === 'a'}
                  color={COLOR_A}
                  variant="a"
                  disabled={!bothPlayed}
                  onClick={() => handleVote('a')}
                />
                <VoteButton
                  label="Tie"
                  active={voted === 'tie'}
                  color="#888899"
                  variant="tie"
                  disabled={!bothPlayed}
                  onClick={() => handleVote('tie')}
                />
                <VoteButton
                  label="B is better"
                  active={voted === 'b'}
                  color={COLOR_B}
                  variant="b"
                  disabled={!bothPlayed}
                  onClick={() => handleVote('b')}
                />
                <VoteButton
                  label="Both bad"
                  active={voted === 'both_bad'}
                  color="#ef4444"
                  variant="both_bad"
                  disabled={!bothPlayed}
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

        {/* ================================ */}
        {/* Dimension Ratings (Optional)     */}
        {/* ================================ */}
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

        {/* ================================ */}
        {/* Post-Vote Reveal                 */}
        {/* ================================ */}
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
              {/* Reveal Header */}
              <div className="relative bg-bg-surface rounded-xl border border-accent/30 p-6 mb-4 overflow-hidden">
                {/* Subtle glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10">
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-accent text-center mb-5">
                    Models Revealed
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Model A reveal */}
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-hover border border-border-default"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_A }} />
                      <div>
                        <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Model A</p>
                        <p className="text-text-primary font-medium text-sm">{modelA.name}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Arena Score</p>
                        <p className="text-text-primary font-[family-name:var(--font-mono)] text-sm font-semibold">
                          {modelA.arenaScore}
                        </p>
                      </div>
                    </motion.div>

                    {/* Model B reveal */}
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-hover border border-border-default"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_B }} />
                      <div>
                        <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Model B</p>
                        <p className="text-text-primary font-medium text-sm">{modelB.name}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-text-faint font-[family-name:var(--font-mono)]">Arena Score</p>
                        <p className="text-text-primary font-[family-name:var(--font-mono)] text-sm font-semibold">
                          {modelB.arenaScore}
                        </p>
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

                  {/* Metrics Table */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint mb-3">
                      Metrics Comparison
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
                          {metricsComparison.map((row, idx) => {
                            const aBetter = row.higher ? row.a > row.b : row.a < row.b
                            const bBetter = row.higher ? row.b > row.a : row.b < row.a
                            return (
                              <tr
                                key={row.label}
                                className={idx % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-hover/50'}
                              >
                                <td className="px-4 py-2.5 text-text-body font-[family-name:var(--font-mono)] text-xs">
                                  {row.label}
                                </td>
                                <td className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs ${
                                  aBetter ? 'text-accent font-semibold' : 'text-text-body'
                                }`}>
                                  {row.a}
                                  {row.label === 'TTFB' && 'ms'}
                                </td>
                                <td className={`px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-xs ${
                                  bBetter ? 'text-accent font-semibold' : 'text-text-body'
                                }`}>
                                  {row.b}
                                  {row.label === 'TTFB' && 'ms'}
                                </td>
                              </tr>
                            )
                          })}
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
      </div>
    </div>
  )
}

// ============================================================
// AudioPlayerCard
// ============================================================
function AudioPlayerCard({
  label,
  color,
  isPlaying,
  hasPlayed,
  onTogglePlay,
  duration,
  ttfb,
  progress,
}: {
  label: string
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
          transition={{ duration: 0.6, ease: 'easeOut' }}
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
