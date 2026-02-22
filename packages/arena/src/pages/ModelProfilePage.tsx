import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ExternalLink, Star, Play, Trophy, Swords, Loader2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api, type Model, type ModelBreakdown } from '../api/client'
import WaveformVisualizer from '../components/WaveformVisualizer'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'metrics' | 'battles' | 'compare'

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'battles', label: 'Battles' },
  { key: 'compare', label: 'vs. Compare' },
]

const typeLabels: Record<string, string> = {
  tts: 'TTS',
  asr: 'ASR',
  s2s: 'S2S',
  agent: 'Agent',
  speech_llm: 'Speech LLM',
}

interface AudioSample {
  description: string
  category: string
}

const audioSamples: AudioSample[] = [
  { description: 'Welcome to our restaurant, how many in your party tonight?', category: 'Customer Service' },
  { description: 'Once upon a time, in a land far beyond the mountains...', category: 'Entertainment' },
  { description: 'The quarterly results show a 12% increase in revenue...', category: 'Knowledge' },
]

// Metric display names and formatting
const metricLabels: Record<string, string> = {
  avg_ttfb: 'Avg TTFB',
  avg_e2e_latency: 'Avg E2E Latency',
  avg_generation_time: 'Avg Generation Time',
  avg_duration: 'Avg Duration',
}

const metricUnits: Record<string, string> = {
  avg_ttfb: 'ms',
  avg_e2e_latency: 'ms',
  avg_generation_time: 'ms',
  avg_duration: 's',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatMetricValue(key: string, value: number): string {
  const unit = metricUnits[key] || ''
  if (unit === 'ms') return `${Math.round(value)} ms`
  if (unit === 's') return `${value.toFixed(2)} s`
  return value.toFixed(2)
}

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg px-3 py-2 shadow-lg">
      <p className="font-[family-name:var(--font-mono)] text-xs text-text-faint mb-0.5">
        {label}
      </p>
      <p className="font-[family-name:var(--font-mono)] text-sm text-accent font-medium">
        {payload[0].value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

const tabContent = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricBar({ value, maxValue, delay }: { value: number; maxValue: number; delay: number }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3 flex-1 max-w-[280px]">
      <div className="flex-1 h-2 rounded-full bg-bg-hover overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: '#2DD4A8' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        />
      </div>
    </div>
  )
}

function CategoryBar({ label, value, delay }: { label: string; value: number; delay: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-4">
      <span className="text-text-body text-sm w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-bg-hover overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: '#2DD4A8' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        />
      </div>
      <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary w-10 text-right">
        {pct}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <main className="min-h-screen pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-2 text-text-body text-sm hover:text-accent transition-colors duration-200 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leaderboard
        </Link>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 text-accent animate-spin" />
          <span className="ml-3 text-text-body text-sm">Loading model profile...</span>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// ModelProfilePage
// ---------------------------------------------------------------------------

export default function ModelProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [battleType] = useState('tts')

  // API state
  const [model, setModel] = useState<Model | null>(null)
  const [breakdown, setBreakdown] = useState<ModelBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch model data
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.models.get(id)
      .then(setModel)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // Fetch breakdown data
  useEffect(() => {
    if (!id) return
    api.analytics.modelBreakdown(id, battleType)
      .then(setBreakdown)
      .catch(() => {
        // Breakdown may not be available for models with no battles yet
        setBreakdown(null)
      })
  }, [id, battleType])

  if (loading) return <LoadingSkeleton />

  if (error || !model) {
    return (
      <main className="min-h-screen pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 text-text-body text-sm hover:text-accent transition-colors duration-200 mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Leaderboard
          </Link>
          <div className="bg-bg-surface rounded-xl border border-border-default p-8 text-center">
            <p className="text-text-body">
              {error ?? 'Model not found.'}
            </p>
          </div>
        </div>
      </main>
    )
  }

  // Build metrics rows from breakdown avg_metrics (only non-null values)
  const metricRows: { key: string; label: string; value: number }[] = []
  if (breakdown?.avg_metrics) {
    const m = breakdown.avg_metrics
    const entries: [string, number | null][] = [
      ['avg_ttfb', m.avg_ttfb],
      ['avg_e2e_latency', m.avg_e2e_latency],
      ['avg_generation_time', m.avg_generation_time],
      ['avg_duration', m.avg_duration],
    ]
    for (const [key, val] of entries) {
      if (val != null) {
        metricRows.push({ key, label: metricLabels[key], value: val })
      }
    }
  }

  // Max metric value for bar scaling
  const maxMetricValue = metricRows.length > 0
    ? Math.max(...metricRows.map((r) => r.value))
    : 1

  // Opponent records
  const opponents = breakdown?.opponents ?? []

  // ELO history for chart
  const eloHistory = breakdown?.elo_history ?? []

  return (
    <main className="min-h-screen pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        {/* ============================================================ */}
        {/* Back Link                                                     */}
        {/* ============================================================ */}
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-2 text-text-body text-sm hover:text-accent transition-colors duration-200 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leaderboard
        </Link>

        {/* ============================================================ */}
        {/* Model Header Card                                             */}
        {/* ============================================================ */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="bg-bg-surface rounded-xl border border-border-default p-8 mb-8"
        >
          {/* Name */}
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-[32px] text-text-primary mb-2">
            {model.name}
          </h1>

          {/* Provider line */}
          <p className="text-text-body text-sm mb-6 flex flex-wrap items-center gap-x-1.5">
            <span>by</span>
            <span className="text-text-primary font-medium">{model.provider}</span>
            <span className="text-text-faint">&middot;</span>
            <span className="inline-flex items-center gap-1">
              API Available
              <ExternalLink className="h-3 w-3 text-text-faint" />
            </span>
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
            {/* Arena Score */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Star className="h-3 w-3" />
                Arena Score
              </p>
              <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                {Math.round(model.elo_rating)}
              </p>
            </div>

            {/* Rank — only shown if breakdown has data */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Record
              </p>
              {breakdown ? (
                <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                  {breakdown.wins}W-{breakdown.losses}L-{breakdown.ties}T
                </p>
              ) : (
                <p className="font-[family-name:var(--font-mono)] text-2xl text-text-faint">
                  --
                </p>
              )}
            </div>

            {/* Total Battles */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Swords className="h-3 w-3" />
                Total Battles
              </p>
              <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                {formatNumber(model.total_battles)}
              </p>
            </div>

            {/* Win Rate */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5">Win Rate</p>
              <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                {Math.round(model.win_rate * 100)}%
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-bg-hover overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${model.win_rate * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-bg-hover border border-border-default rounded-full px-3 py-1 text-xs text-text-body">
              {typeLabels[model.model_type] ?? model.model_type?.toUpperCase() ?? 'MODEL'}
            </span>
          </div>
        </motion.div>

        {/* ============================================================ */}
        {/* Tab Navigation                                                */}
        {/* ============================================================ */}
        <div className="border-b border-border-default mb-8">
          <nav className="-mb-px flex gap-6" aria-label="Model profile tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    relative pb-3 text-sm font-medium transition-colors duration-200
                    ${isActive ? 'text-accent' : 'text-text-body hover:text-text-primary'}
                  `}
                >
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-accent rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* ============================================================ */}
        {/* Tab Content                                                   */}
        {/* ============================================================ */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-8"
            >
              {/* ------------------------------------------------------ */}
              {/* Average Performance Metrics                             */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Average Performance Metrics
                </h2>
                {metricRows.length > 0 ? (
                  <div className="space-y-3">
                    {metricRows.map((row, i) => (
                      <div
                        key={row.key}
                        className="flex items-center gap-4 py-2 border-b border-border-default last:border-0"
                      >
                        <span className="text-text-body text-sm w-40 shrink-0">{row.label}</span>
                        <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary w-24 text-right shrink-0">
                          {formatMetricValue(row.key, row.value)}
                        </span>
                        <MetricBar value={row.value} maxValue={maxMetricValue} delay={i * 0.06} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-faint text-sm">
                    No performance metrics available yet. Metrics will appear after battles are completed.
                  </p>
                )}
              </section>

              {/* ------------------------------------------------------ */}
              {/* Head-to-Head Opponent Record                            */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Head-to-Head Record
                </h2>
                {opponents.length > 0 ? (
                  <div className="space-y-4">
                    {opponents.map((opp, i) => {
                      const total = opp.wins + opp.losses + opp.ties
                      const winRate = total > 0 ? opp.wins / total : 0
                      return (
                        <div key={opp.model_id} className="flex items-center gap-4">
                          <Link
                            to={`/model/${opp.model_id}`}
                            className="text-text-body text-sm w-44 shrink-0 hover:text-accent transition-colors truncate"
                            title={`${opp.model_name} (${opp.provider})`}
                          >
                            {opp.model_name}
                          </Link>
                          <span className="font-[family-name:var(--font-mono)] text-xs text-text-faint w-24 shrink-0 text-center">
                            {opp.wins}W-{opp.losses}L-{opp.ties}T
                          </span>
                          <CategoryBar label="" value={winRate} delay={i * 0.08} />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-text-faint text-sm">
                    No opponent data available yet. Records will appear after battles are completed.
                  </p>
                )}
              </section>

              {/* ------------------------------------------------------ */}
              {/* Sample Audio                                            */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Sample Audio
                </h2>
                <div className="space-y-3">
                  {audioSamples.map((sample) => (
                    <div
                      key={sample.description}
                      className="flex items-center gap-4 p-3 rounded-lg bg-bg-hover border border-border-default hover:border-border-strong transition-colors duration-200"
                    >
                      {/* Play button */}
                      <button
                        className="shrink-0 h-9 w-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-colors duration-200"
                        aria-label={`Play sample: ${sample.description}`}
                      >
                        <Play className="h-4 w-4 ml-0.5" />
                      </button>

                      {/* Waveform */}
                      <div className="shrink-0">
                        <WaveformVisualizer playing={false} bars={16} height={24} />
                      </div>

                      {/* Description */}
                      <p className="flex-1 text-text-body text-sm truncate min-w-0">
                        {sample.description}
                      </p>

                      {/* Category tag */}
                      <span className="shrink-0 bg-bg-primary border border-border-default rounded-full px-2.5 py-0.5 text-xs text-text-faint">
                        {sample.category}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ------------------------------------------------------ */}
              {/* ELO Score History                                        */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Arena Score History
                </h2>
                {eloHistory.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={eloHistory}
                        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                      >
                        <defs>
                          <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2DD4A8" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#2DD4A8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: '#4E4E5E',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                        <YAxis
                          domain={['dataMin - 10', 'dataMax + 10']}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: '#4E4E5E',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ stroke: '#1C1E2E', strokeWidth: 1 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="elo_rating"
                          stroke="#2DD4A8"
                          strokeWidth={2}
                          fill="url(#accentGradient)"
                          dot={false}
                          activeDot={{
                            r: 4,
                            fill: '#2DD4A8',
                            stroke: '#0F1118',
                            strokeWidth: 2,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-text-faint text-sm">
                    No ELO history available yet. History will appear after battles are recorded.
                  </p>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-bg-surface rounded-xl border border-border-default p-8"
            >
              <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-3">
                Detailed Metrics
              </h2>
              <p className="text-text-body text-sm leading-relaxed">
                Comprehensive metric breakdowns with percentile distributions, historical trends,
                and cross-model comparisons are coming soon. This section will include per-prompt
                analysis, latency distributions, and confidence interval breakdowns across all
                automated evaluation dimensions.
              </p>
            </motion.div>
          )}

          {activeTab === 'battles' && (
            <motion.div
              key="battles"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-bg-surface rounded-xl border border-border-default p-8"
            >
              <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-3">
                Battle History
              </h2>
              <p className="text-text-body text-sm leading-relaxed">
                Full battle log with individual match results, opponent breakdown, win streaks,
                and category-level performance will be available here. You will be able to replay
                audio from past battles and filter by opponent, category, or date range.
              </p>
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div
              key="compare"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-bg-surface rounded-xl border border-border-default p-8"
            >
              <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-3">
                Head-to-Head Comparison
              </h2>
              <p className="text-text-body text-sm leading-relaxed">
                Select another model to compare side-by-side across all metrics, battle win rates,
                category strengths, and audio quality dimensions. Direct head-to-head statistics
                and radar chart overlays will be displayed here.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
