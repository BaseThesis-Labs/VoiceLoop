import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ExternalLink, Star, Play, Trophy, Swords } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { models, agents, scoreHistory } from '../data/mockData'
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

interface PipelineScore {
  name: string
  score: number
  percentile: number
}

const pipelineScores: PipelineScore[] = [
  { name: 'UTMOS', score: 4.21, percentile: 85 },
  { name: 'NISQA Overall', score: 4.05, percentile: 80 },
  { name: 'NISQA Noise', score: 4.42, percentile: 92 },
  { name: 'NISQA Color', score: 3.78, percentile: 72 },
  { name: 'DNSMOS', score: 4.12, percentile: 83 },
  { name: 'Intelligibility', score: 97.1, percentile: 91 },
  { name: 'Speaker Sim', score: 0.87, percentile: 78 },
  { name: 'F0-RMSE', score: 12.4, percentile: 65 },
]

interface AudioSample {
  description: string
  category: string
}

const audioSamples: AudioSample[] = [
  { description: 'Welcome to our restaurant, how many in your party tonight?', category: 'Customer Service' },
  { description: 'Once upon a time, in a land far beyond the mountains...', category: 'Entertainment' },
  { description: 'The quarterly results show a 12% increase in revenue...', category: 'Knowledge' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString()
}

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg px-3 py-2 shadow-lg">
      <p className="font-[family-name:var(--font-mono)] text-xs text-text-faint mb-0.5">
        Day {label}
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

function PercentileBar({ percentile, delay }: { percentile: number; delay: number }) {
  return (
    <div className="flex items-center gap-3 flex-1 max-w-[280px]">
      <div className="flex-1 h-2 rounded-full bg-bg-hover overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: '#2DD4A8' }}
          initial={{ width: 0 }}
          animate={{ width: `${percentile}%` }}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        />
      </div>
      <span className="font-[family-name:var(--font-mono)] text-xs text-text-faint w-8 text-right">
        {percentile}th
      </span>
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
// ModelProfilePage
// ---------------------------------------------------------------------------

export default function ModelProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const allModels = [...models, ...agents]
  const model = allModels.find((m) => m.id === id) ?? models[1] // fallback: ElevenLabs v3

  // Compute rank
  const sortedByScore = [...allModels].sort((a, b) => b.arenaScore - a.arenaScore)
  const rank = sortedByScore.findIndex((m) => m.id === model.id) + 1

  // Determine scoreHistory data key — use model id if it matches m1/m2/m3, else m2
  const historyKey = ['m1', 'm2', 'm3'].includes(model.id) ? model.id : 'm2'

  // Win rate categories
  const categories = model.categories ?? {
    'Customer Service': 0.68,
    'Entertainment': 0.71,
    'Knowledge': 0.59,
    'Assistants': 0.62,
  }

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
            <span>{model.isOpenSource ? 'Open Source' : 'Proprietary'}</span>
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
                {model.arenaScore}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-text-faint mt-0.5">
                &plusmn;{Math.round((model.ciUpper - model.ciLower) / 2)}
              </p>
            </div>

            {/* Rank */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Rank
              </p>
              <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                #{rank}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-text-faint mt-0.5">
                of {allModels.length}
              </p>
            </div>

            {/* Total Battles */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Swords className="h-3 w-3" />
                Total Battles
              </p>
              <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                {formatNumber(model.totalBattles)}
              </p>
            </div>

            {/* Win Rate */}
            <div>
              <p className="text-text-faint text-xs uppercase tracking-wider mb-1.5">Win Rate</p>
              <p className="font-[family-name:var(--font-mono)] text-2xl text-text-primary font-medium">
                {Math.round(model.winRate * 100)}%
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-bg-hover overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${model.winRate * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-bg-hover border border-border-default rounded-full px-3 py-1 text-xs text-text-body">
              {typeLabels[model.type] ?? model.type.toUpperCase()}
            </span>
            <span className="bg-bg-hover border border-border-default rounded-full px-3 py-1 text-xs text-text-body">
              29 Languages
            </span>
            <span className="bg-bg-hover border border-border-default rounded-full px-3 py-1 text-xs text-text-body">
              Voice Cloning: Yes
            </span>
            <span className="bg-bg-hover border border-border-default rounded-full px-3 py-1 text-xs text-text-body">
              $0.30/1K chars
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
              {/* Automated Pipeline Scores                               */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Automated Pipeline Scores
                </h2>
                <div className="space-y-3">
                  {pipelineScores.map((row, i) => (
                    <div
                      key={row.name}
                      className="flex items-center gap-4 py-2 border-b border-border-default last:border-0"
                    >
                      <span className="text-text-body text-sm w-32 shrink-0">{row.name}</span>
                      <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary w-16 text-right shrink-0">
                        {row.score}
                      </span>
                      <PercentileBar percentile={row.percentile} delay={i * 0.06} />
                    </div>
                  ))}
                </div>
              </section>

              {/* ------------------------------------------------------ */}
              {/* Win Rate by Category                                    */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Win Rate by Category
                </h2>
                <div className="space-y-4">
                  {Object.entries(categories).map(([label, value], i) => (
                    <CategoryBar key={label} label={label} value={value} delay={i * 0.08} />
                  ))}
                </div>
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
              {/* Arena Score History                                     */}
              {/* ------------------------------------------------------ */}
              <section className="bg-bg-surface rounded-xl border border-border-default p-6">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-5">
                  Arena Score History
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={scoreHistory}
                      margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                    >
                      <defs>
                        <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2DD4A8" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#2DD4A8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: '#4E4E5E',
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                        }}
                        tickFormatter={(v: number) => `D${v}`}
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
                        dataKey={historyKey}
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
