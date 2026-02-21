import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Share2,
  ArrowRight,
  Zap,
  HelpCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import TranscriptCard from '../components/TranscriptCard'
import VoteButton from '../components/VoteButton'
import GatedLoadingState from '../components/GatedLoadingState'
import STTInputPanel from '../components/STTInputPanel'
import AudioClipPlayer from '../components/AudioClipPlayer'
import { ModeSelector, type BattleMode } from '../components/ModeSelector'
import {
  api,
  type STTBattleSetup,
  type STTBattleResult,
  type STTMetrics,
} from '../api/client'

// ---- Types ----
type ModelLabel = 'a' | 'b' | 'c' | 'd'
type VoteChoice = ModelLabel | 'all_bad' | null
type STTState = 'idle' | 'loading' | 'listening' | 'voting' | 'revealed'

// ---- Constants ----
const COLORS: Record<ModelLabel, string> = {
  a: '#6366f1',
  b: '#f59e0b',
  c: '#10b981',
  d: '#ec4899',
}

const LABEL_NAMES: Record<ModelLabel, string> = {
  a: 'Model A',
  b: 'Model B',
  c: 'Model C',
  d: 'Model D',
}

// ---- Component ----
export default function STTBattlePage({
  onModeChange,
  battleCount: externalBattleCount,
}: {
  onModeChange: (mode: BattleMode) => void
  battleCount: number
}) {
  const [state, setState] = useState<STTState>('idle')
  const [setup, setSetup] = useState<STTBattleSetup | null>(null)
  const [result, setResult] = useState<STTBattleResult | null>(null)
  const [metrics, setMetrics] = useState<STTMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [battleCount, setBattleCount] = useState(externalBattleCount)

  // Voting state
  const [voted, setVoted] = useState<VoteChoice>(null)
  const [voting, setVoting] = useState(false)

  // Processing timer
  const [processingElapsed, setProcessingElapsed] = useState(0)
  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Metrics polling
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---- Initialize battle ----
  const initBattle = useCallback(async () => {
    setLoading(true)
    setError(null)
    setState('idle')
    setSetup(null)
    setResult(null)
    setMetrics(null)
    setVoted(null)
    setVoting(false)
    setProcessingElapsed(0)

    try {
      const data = await api.stt.setup()
      setSetup(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize battle')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initBattle()
    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current)
    }
  }, [initBattle])

  // ---- Submit audio ----
  async function handleSubmitAudio(audio: Blob | null, curatedClipId: string | null) {
    if (!setup) return
    setState('loading')
    setProcessingElapsed(0)

    processingTimerRef.current = setInterval(() => {
      setProcessingElapsed((prev) => prev + 100)
    }, 100)

    try {
      const data = await api.stt.submitAudio(setup.id, audio, curatedClipId ?? undefined)
      setResult(data)
      setState('listening')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed')
      setState('idle')
    } finally {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current)
        processingTimerRef.current = null
      }
    }
  }

  // ---- Vote ----
  async function handleVote(choice: VoteChoice) {
    if (!setup || !choice || voting) return
    setVoting(true)

    try {
      await api.battles.vote(setup.id, choice === 'all_bad' ? 'all_bad' : choice)
      setVoted(choice)
      setState('revealed')

      // Start polling for metrics
      pollMetrics()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vote failed')
    } finally {
      setVoting(false)
    }
  }

  // ---- Poll metrics ----
  function pollMetrics() {
    if (!setup) return

    const poll = async () => {
      try {
        const data = await api.stt.getMetrics(setup.id)
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
    metricsIntervalRef.current = setInterval(poll, 1000)
  }

  // ---- Next battle ----
  function handleNextBattle() {
    setBattleCount((c) => c + 1)
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
      metricsIntervalRef.current = null
    }
    initBattle()
  }

  // ---- Get active models from result ----
  function getActiveModels(): ModelLabel[] {
    if (!result) return []
    return result.transcripts.map((t) => t.model_id as ModelLabel)
  }

  // ---- Render ----
  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-5xl mx-auto px-6 pt-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <ModeSelector active="stt" onChange={onModeChange} />
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2 text-text-faint">
                <Zap size={14} />
                <span className="font-[family-name:var(--font-mono)] text-xs">
                  Battle #{battleCount + 1}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const url = window.location.href
              navigator.clipboard.writeText(url)
            }}
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

        {/* Loading initial */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}

        {/* Idle — Input panel */}
        {state === 'idle' && setup && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                Provide audio to transcribe
              </h2>
              <p className="text-sm text-text-faint">
                {setup.model_count} STT models will transcribe your audio. Compare the results and vote on the best.
              </p>
            </div>
            <STTInputPanel
              curatedClips={setup.curated_clips || []}
              onSubmitAudio={handleSubmitAudio}
            />
          </motion.div>
        )}

        {/* Loading — Processing */}
        {state === 'loading' && (
          <GatedLoadingState
            modelCount={setup?.model_count || 4}
            elapsedMs={processingElapsed}
          />
        )}

        {/* Listening — Show transcripts */}
        {(state === 'listening' || state === 'voting' || state === 'revealed') && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Input audio player */}
            <div>
              <h3 className="text-xs font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider mb-2">
                Input Audio
              </h3>
              <AudioClipPlayer audioUrl={result.input_audio_url} />
            </div>

            {/* How to vote hint */}
            {state === 'listening' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-text-faint"
              >
                <HelpCircle size={14} />
                <span className="text-xs font-[family-name:var(--font-mono)]">
                  Read each transcript and vote for the most accurate one
                </span>
              </motion.div>
            )}

            {/* Transcript cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.transcripts.map((t) => {
                const label = t.model_id as ModelLabel
                const metricsData = metrics?.metrics?.[label]
                return (
                  <TranscriptCard
                    key={label}
                    label={LABEL_NAMES[label]}
                    color={COLORS[label]}
                    transcript={t.transcript}
                    wordCount={t.word_count}
                    latencyMs={t.e2e_latency_ms}
                    revealed={state === 'revealed'}
                    provider={metrics?.providers?.[label]}
                    modelName={metrics?.model_names?.[label]}
                    wer={metricsData?.wer}
                    cer={metricsData?.cer}
                    diff={metricsData?.diff}
                  />
                )
              })}
            </div>

            {/* Ground truth (revealed) */}
            {state === 'revealed' && metrics?.ground_truth && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-accent/20 bg-accent/5 p-4"
              >
                <h4 className="text-xs font-[family-name:var(--font-mono)] text-accent uppercase tracking-wider mb-2">
                  Ground Truth
                </h4>
                <p className="font-[family-name:var(--font-mono)] text-sm text-text-body leading-relaxed">
                  {metrics.ground_truth}
                </p>
              </motion.div>
            )}

            {/* Vote buttons */}
            {(state === 'listening' || state === 'voting') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-text-primary">
                  Which transcription is most accurate?
                </h3>
                <div className="flex flex-wrap gap-3">
                  {getActiveModels().map((label) => (
                    <VoteButton
                      key={label}
                      label={LABEL_NAMES[label]}
                      active={voted === label}
                      color={COLORS[label]}
                      disabled={voting}
                      onClick={() => {
                        setState('voting')
                        handleVote(label)
                      }}
                    />
                  ))}
                  <VoteButton
                    label="All Bad"
                    active={voted === 'all_bad'}
                    color="#6b7280"
                    disabled={voting}
                    onClick={() => {
                      setState('voting')
                      handleVote('all_bad')
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Next battle */}
            {state === 'revealed' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center pt-4"
              >
                <button
                  onClick={handleNextBattle}
                  className="flex items-center gap-2 px-6 py-3 bg-accent text-bg-primary rounded-xl font-medium hover:bg-accent/90 transition-colors"
                >
                  Next Battle
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
