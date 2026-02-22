import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  FileText,
  BarChart3,
  Users,
  Vote,
  Scale,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { arenaStats as mockArenaStats, metricCorrelations, fairnessData } from '../data/mockData'
import { api, type AnalyticsSummary, type ProviderComparison } from '../api/client'
import { ModeSelector, getStoredMode, type BattleMode } from '../components/ModeSelector'

// ============================================================
// Types
// ============================================================

type TabId = 'votes' | 'correlations' | 'fairness' | 'papers' | 'dataset'

interface TabDef {
  id: TabId
  label: string
}

// ============================================================
// Constants
// ============================================================

const TABS: TabDef[] = [
  { id: 'votes', label: 'Vote Analytics' },
  { id: 'correlations', label: 'Provider Comparison' },
  { id: 'fairness', label: 'Fairness' },
  { id: 'papers', label: 'Papers' },
  { id: 'dataset', label: 'Dataset' },
]

const ACCENT_COLORS: Record<string, string> = {
  genAm: '#2DD4A8',
  aae: '#6366f1',
  indian: '#f59e0b',
  latAm: '#ec4899',
}

const ACCENT_LABELS: Record<string, string> = {
  genAm: 'Gen. American',
  aae: 'AAE',
  indian: 'Indian English',
  latAm: 'Latin American',
}

// ============================================================
// Animation Variants
// ============================================================

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
}

const staggerChild = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

// ============================================================
// Helpers
// ============================================================

function correlationColor(r: number): string {
  if (r >= 0.6) return 'text-accent'
  if (r >= 0.5) return 'text-text-body'
  return 'text-text-faint'
}

function correlationBarColor(r: number): string {
  if (r >= 0.6) return '#2DD4A8'
  if (r >= 0.5) return '#888899'
  return '#4E4E5E'
}

function getWerExtremes(row: typeof fairnessData[number]) {
  const vals = [row.genAm, row.aae, row.indian, row.latAm]
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return { min, max }
}

function werCellClass(value: number, min: number, max: number): string {
  if (value === max) return 'text-[#ef4444]'
  if (value === min) return 'text-accent'
  return 'text-text-primary'
}

function faasPillClass(faas: string): string {
  switch (faas) {
    case 'Fair':
      return 'bg-accent/10 text-accent'
    case 'Moderately Fair':
      return 'bg-yellow-500/10 text-yellow-500'
    case 'Severely Biased':
      return 'bg-red-500/10 text-red-400'
    default:
      return 'bg-bg-hover text-text-body'
  }
}

// ============================================================
// Custom Recharts Tooltip
// ============================================================

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name?: string; payload?: Record<string, unknown>; fill?: string; color?: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg px-4 py-3 shadow-xl">
      <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1.5">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-text-primary text-sm font-[family-name:var(--font-mono)]"
          style={{ color: entry.fill || entry.color }}
        >
          {entry.name ? `${entry.name}: ` : ''}{entry.value}%
        </p>
      ))}
    </div>
  )
}

function CustomTooltipWer({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name?: string; fill?: string; color?: string; dataKey?: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg px-4 py-3 shadow-xl">
      <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1.5">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-sm font-[family-name:var(--font-mono)]"
          style={{ color: entry.fill || entry.color }}
        >
          {entry.name}: {entry.value}% WER
        </p>
      ))}
    </div>
  )
}

// ============================================================
// Tab Content Components
// ============================================================

function VoteAnalyticsTab({ apiSummary, activeMode }: { apiSummary: AnalyticsSummary | null; activeMode: string }) {
  const [voteData, setVoteData] = useState<{ outcome: string; pct: number; fill: string }[]>([])

  useEffect(() => {
    api.analytics.voteDistribution(activeMode).then((data) => {
      const total = data.total || 1
      const chartData: { outcome: string; pct: number; fill: string }[] = []
      if (data.a) chartData.push({ outcome: 'A Wins', pct: Math.round(((data.a || 0) / total) * 100), fill: '#6366f1' })
      if (data.b) chartData.push({ outcome: 'B Wins', pct: Math.round(((data.b || 0) / total) * 100), fill: '#f59e0b' })
      if (data.c) chartData.push({ outcome: 'C Wins', pct: Math.round(((data.c || 0) / total) * 100), fill: '#14b8a6' })
      if (data.d) chartData.push({ outcome: 'D Wins', pct: Math.round(((data.d || 0) / total) * 100), fill: '#a855f7' })
      if (data.tie) chartData.push({ outcome: 'Tie', pct: Math.round(((data.tie || 0) / total) * 100), fill: '#888899' })
      if (data.all_bad) chartData.push({ outcome: 'Both Bad', pct: Math.round(((data.all_bad || 0) / total) * 100), fill: '#ef4444' })
      setVoteData(chartData)
    }).catch(() => {})
  }, [activeMode])

  const stats = apiSummary
    ? [
        { label: 'Total Battles', value: apiSummary.total_battles.toLocaleString(), icon: Vote },
        { label: 'Total Models', value: apiSummary.total_models.toLocaleString(), icon: Users },
        { label: 'Evaluations', value: apiSummary.completed_evaluations.toLocaleString(), icon: BarChart3 },
        { label: 'Scenarios', value: apiSummary.total_scenarios.toLocaleString(), icon: Scale },
      ]
    : [
        { label: 'Total Votes', value: mockArenaStats.totalVotes.toLocaleString(), icon: Vote },
        { label: 'Unique Voters', value: mockArenaStats.uniqueVoters.toLocaleString(), icon: Users },
        { label: 'Avg Battles / Voter', value: mockArenaStats.avgBattlesPerVoter.toFixed(1), icon: BarChart3 },
        { label: "Krippendorff's \u03B1", value: mockArenaStats.interRaterAgreement.toFixed(2), icon: Scale },
      ]

  return (
    <motion.div
      key="votes"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Stats Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerChild}
            className="bg-bg-surface rounded-xl border border-border-default p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="h-4 w-4 text-text-faint" />
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-text-faint">
                {stat.label}
              </span>
            </div>
            <p className="font-[family-name:var(--font-mono)] text-2xl lg:text-3xl font-medium text-text-primary">
              {stat.value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Vote Distribution Chart */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-1">
          Vote Distribution by Outcome
        </h3>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6">
          Percentage of total votes across all battles
        </p>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={voteData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid horizontal={false} stroke="#1C1E2E" />
              <XAxis
                type="number"
                domain={[0, 50]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: '#4E4E5E', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: '#1C1E2E' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="outcome"
                width={90}
                tick={{ fill: '#888899', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="pct"
                radius={[0, 6, 6, 0]}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {voteData.map((entry) => (
                  <motion.rect key={entry.outcome} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-border-default">
          {voteData.map((entry) => (
            <div key={entry.outcome} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-text-body text-xs font-[family-name:var(--font-mono)]">
                {entry.outcome} ({entry.pct}%)
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Key Finding */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-accent/20 p-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-accent" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
            Key Finding
          </span>
        </div>
        <p className="text-text-body text-sm leading-relaxed italic">
          Position bias detected: Model A (shown first) wins 42% vs Model B at 38%.
          After randomization correction, the adjusted rates converge to ~40% each,
          confirming our bias mitigation is working.
        </p>
      </motion.div>
    </motion.div>
  )
}

const COMPARISON_METRIC_COLORS: Record<string, string> = {
  Prosody: '#2DD4A8',
  NISQA: '#6366f1',
  DNSMOS: '#f59e0b',
  'TTFB (inv)': '#ec4899',
}

function normalizeProviderMetrics(providers: ProviderComparison[]) {
  const maxTtfb = Math.max(...providers.map((p) => p.avg_ttfb), 1)
  return providers.map((p) => ({
    provider: p.provider,
    Prosody: Math.round(p.avg_prosody * 100),
    NISQA: Math.round(((p.avg_nisqa - 1) / 4) * 100),
    DNSMOS: Math.round(((p.avg_dnsmos - 1) / 4) * 100),
    'TTFB (inv)': Math.round(Math.max(0, (1 - p.avg_ttfb / maxTtfb) * 100)),
  }))
}

function ProviderComparisonTab({ activeMode }: { activeMode: string }) {
  const [providers, setProviders] = useState<ProviderComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.analytics
      .providerComparison(activeMode)
      .then((data) => {
        setProviders(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load provider data')
        setLoading(false)
      })
  }, [activeMode])

  if (loading) {
    return (
      <motion.div
        key="correlations"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex items-center justify-center py-20"
      >
        <div className="text-text-faint font-[family-name:var(--font-mono)] text-sm">
          Loading provider comparison...
        </div>
      </motion.div>
    )
  }

  if (error || providers.length === 0) {
    return (
      <motion.div
        key="correlations"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex items-center justify-center py-20"
      >
        <div className="text-text-faint font-[family-name:var(--font-mono)] text-sm">
          {error || 'No provider data available for this mode.'}
        </div>
      </motion.div>
    )
  }

  const chartData = normalizeProviderMetrics(providers)

  return (
    <motion.div
      key="correlations"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Grouped Bar Chart */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-1">
          Provider Comparison — Normalized Metrics
        </h3>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6 max-w-2xl">
          All metrics normalized to 0–100 scale. TTFB is inverted (higher = faster).
        </p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              barCategoryGap="20%"
              barGap={3}
            >
              <CartesianGrid vertical={false} stroke="#1C1E2E" />
              <XAxis
                dataKey="provider"
                tick={{ fill: '#888899', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: '#1C1E2E' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}`}
                tick={{ fill: '#4E4E5E', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
              />
              <Bar dataKey="Prosody" fill={COMPARISON_METRIC_COLORS['Prosody']} radius={[4, 4, 0, 0]} animationDuration={1000} />
              <Bar dataKey="NISQA" fill={COMPARISON_METRIC_COLORS['NISQA']} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={100} />
              <Bar dataKey="DNSMOS" fill={COMPARISON_METRIC_COLORS['DNSMOS']} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={200} />
              <Bar dataKey="TTFB (inv)" fill={COMPARISON_METRIC_COLORS['TTFB (inv)']} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Provider Stats Table */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-1">
          Provider Aggregate Statistics
        </h3>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6">
          Raw metric values across all providers
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Provider
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Models
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Battles
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Avg Elo
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Win Rate
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  TTFB (ms)
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Prosody
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  NISQA
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  DNSMOS
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, idx) => (
                <motion.tr
                  key={p.provider}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.07 }}
                  className="border-b border-border-default/50 last:border-0"
                >
                  <td className="py-3.5 px-3 text-text-primary font-medium whitespace-nowrap">
                    {p.provider}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.model_count}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.total_battles.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_elo.toFixed(1)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {(p.avg_win_rate * 100).toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_ttfb.toFixed(0)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-accent">
                    {p.avg_prosody.toFixed(3)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_nisqa.toFixed(3)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_dnsmos.toFixed(3)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Key Insight */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-accent/20 p-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
            Key Insight
          </span>
        </div>
        <p className="text-text-body text-sm leading-relaxed italic">
          Provider-level aggregates reveal how quality and latency trade off across vendors.
          Normalized metrics allow direct visual comparison across different measurement scales.
        </p>
      </motion.div>
    </motion.div>
  )
}

function FairnessTab() {
  return (
    <motion.div
      key="fairness"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2.5 mb-1">
          <Scale className="h-5 w-5 text-accent" />
          <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary">
            Fairness Dashboard — ASR Accent Bias Analysis
          </h3>
        </div>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)]">
          Word Error Rate (WER) comparison across demographic accent groups
        </p>
      </motion.div>

      {/* WER Table */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h4 className="text-text-primary font-medium mb-4">WER by Accent Group</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Model
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Gen. American (%)
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  AAE (%)
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Indian English (%)
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Latin American (%)
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  FAAS Score
                </th>
              </tr>
            </thead>
            <tbody>
              {fairnessData.map((row, idx) => {
                const { min, max } = getWerExtremes(row)
                return (
                  <motion.tr
                    key={row.model}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                    className="border-b border-border-default/50 last:border-0"
                  >
                    <td className="py-3.5 px-3 text-text-primary font-medium whitespace-nowrap">
                      {row.model}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-[family-name:var(--font-mono)] ${werCellClass(row.genAm, min, max)}`}>
                      {row.genAm.toFixed(1)}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-[family-name:var(--font-mono)] ${werCellClass(row.aae, min, max)}`}>
                      {row.aae.toFixed(1)}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-[family-name:var(--font-mono)] ${werCellClass(row.indian, min, max)}`}>
                      {row.indian.toFixed(1)}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-[family-name:var(--font-mono)] ${werCellClass(row.latAm, min, max)}`}>
                      {row.latAm.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-[family-name:var(--font-mono)] font-medium ${faasPillClass(row.faas)}`}
                      >
                        {row.faas}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* WER Disparity Bar Chart */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h4 className="text-text-primary font-medium mb-1">
          WER Disparity Across Accent Groups
        </h4>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6">
          Grouped comparison of Word Error Rate per model and accent
        </p>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={fairnessData.map((row) => ({
                model: row.model.replace(/\s+/g, '\n'),
                'Gen. American': row.genAm,
                'AAE': row.aae,
                'Indian English': row.indian,
                'Latin American': row.latAm,
              }))}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              barCategoryGap="20%"
              barGap={3}
            >
              <CartesianGrid vertical={false} stroke="#1C1E2E" />
              <XAxis
                dataKey="model"
                tick={{ fill: '#888899', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: '#1C1E2E' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: '#4E4E5E', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltipWer />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="Gen. American" fill={ACCENT_COLORS.genAm} radius={[4, 4, 0, 0]} animationDuration={1000} />
              <Bar dataKey="AAE" fill={ACCENT_COLORS.aae} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={100} />
              <Bar dataKey="Indian English" fill={ACCENT_COLORS.indian} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={200} />
              <Bar dataKey="Latin American" fill={ACCENT_COLORS.latAm} radius={[4, 4, 0, 0]} animationDuration={1000} animationBegin={300} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-border-default">
          {Object.entries(ACCENT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ACCENT_COLORS[key] }}
              />
              <span className="text-text-body text-xs font-[family-name:var(--font-mono)]">
                {label}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

function PapersTab() {
  return (
    <motion.div
      key="papers"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="bg-bg-surface rounded-xl border border-border-default p-8 flex flex-col items-center text-center py-20">
        <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
          <FileText className="h-7 w-7 text-accent" />
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-3">
          Coming Soon
        </h3>
        <p className="text-text-body text-sm max-w-md leading-relaxed">
          Our research paper on KoeCode Arena will be submitted to Interspeech 2026.
        </p>
      </div>
    </motion.div>
  )
}

function DatasetTab({ activeMode }: { activeMode: string }) {
  const exportCsvUrl = api.analytics.exportUrl({ battle_type: activeMode, format: 'csv' })
  const exportJsonUrl = api.analytics.exportUrl({ battle_type: activeMode, format: 'json' })

  return (
    <motion.div
      key="dataset"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="bg-bg-surface rounded-xl border border-border-default p-8 flex flex-col items-center text-center py-20">
        <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
          <Download className="h-7 w-7 text-accent" />
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-3">
          Export Battle Data
        </h3>
        <p className="text-text-body text-sm max-w-md leading-relaxed mb-6">
          Download battle data for the selected mode as CSV or JSON
        </p>
        <div className="flex gap-3">
          <a
            href={exportCsvUrl}
            download
            className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent font-[family-name:var(--font-mono)] text-sm px-6 py-3 rounded-lg hover:bg-accent/20 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </a>
          <a
            href={exportJsonUrl}
            download
            className="inline-flex items-center gap-2 bg-bg-hover border border-border-default text-text-body font-[family-name:var(--font-mono)] text-sm px-6 py-3 rounded-lg hover:bg-bg-surface transition-colors"
          >
            <Download className="h-4 w-4" />
            Download JSON
          </a>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('votes')
  const [apiSummary, setApiSummary] = useState<AnalyticsSummary | null>(null)
  const [activeMode, setActiveMode] = useState<BattleMode>(getStoredMode)

  useEffect(() => {
    api.analytics.summary().then(setApiSummary).catch(() => {
      // Fallback to mock data (apiSummary stays null)
    })
  }, [])

  function renderTab() {
    switch (activeTab) {
      case 'votes':
        return <VoteAnalyticsTab apiSummary={apiSummary} activeMode={activeMode} />
      case 'correlations':
        return <ProviderComparisonTab activeMode={activeMode} />
      case 'fairness':
        return <FairnessTab />
      case 'papers':
        return <PapersTab />
      case 'dataset':
        return <DatasetTab activeMode={activeMode} />
    }
  }

  return (
    <main className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        {/* ---------------------------------------------------------- */}
        {/* Page Header                                                 */}
        {/* ---------------------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          className="mb-10"
        >
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-text-primary mb-2">
            Research & Analytics
          </h1>
          <p className="text-text-body text-sm sm:text-base">
            Public analytics for the voice AI research community
          </p>
        </motion.div>

        {/* ---------------------------------------------------------- */}
        {/* Mode Selector                                               */}
        {/* ---------------------------------------------------------- */}
        <div className="mb-8">
          <ModeSelector active={activeMode} onChange={setActiveMode} />
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Tab Navigation                                              */}
        {/* ---------------------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="border-b border-border-default mb-8 overflow-x-auto"
        >
          <nav className="flex gap-0 min-w-max" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-accent'
                    : 'text-text-body hover:text-text-primary'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="analytics-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>
        </motion.div>

        {/* ---------------------------------------------------------- */}
        {/* Tab Content                                                 */}
        {/* ---------------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {renderTab()}
        </AnimatePresence>
      </div>
    </main>
  )
}
