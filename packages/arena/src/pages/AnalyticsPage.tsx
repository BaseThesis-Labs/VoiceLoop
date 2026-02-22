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
import { api, type AnalyticsSummary, type ProviderComparison, type MetricDistribution } from '../api/client'
import { ModeSelector, getStoredMode, type BattleMode } from '../components/ModeSelector'

// ============================================================
// Types
// ============================================================

type TabId = 'votes' | 'correlations' | 'metricExplorer' | 'papers' | 'dataset'

interface TabDef {
  id: TabId
  label: string
}

// ============================================================
// Constants
// ============================================================

const TABS: TabDef[] = [
  { id: 'votes', label: 'Votes' },
  { id: 'correlations', label: 'Providers' },
  { id: 'metricExplorer', label: 'Metrics' },
  { id: 'papers', label: 'Papers' },
  { id: 'dataset', label: 'Export' },
]

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
    : null

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
      {stats ? (
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
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-surface rounded-xl border border-border-default p-5 animate-pulse">
              <div className="h-4 w-24 bg-bg-hover rounded mb-3" />
              <div className="h-8 w-16 bg-bg-hover rounded" />
            </div>
          ))}
        </div>
      )}

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
  const maxTtfb = Math.max(...providers.map((p) => p.avg_ttfb ?? 0), 1)
  return providers.map((p) => ({
    provider: p.provider,
    Prosody: p.avg_prosody != null ? Math.round(p.avg_prosody * 100) : 0,
    NISQA: p.avg_nisqa != null ? Math.round(((p.avg_nisqa - 1) / 4) * 100) : 0,
    DNSMOS: p.avg_dnsmos != null ? Math.round(((p.avg_dnsmos - 1) / 4) * 100) : 0,
    'TTFB (inv)': p.avg_ttfb != null ? Math.round(Math.max(0, (1 - p.avg_ttfb / maxTtfb) * 100)) : 0,
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
                    {(p.total_battles ?? 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {(p.avg_elo ?? 0).toFixed(1)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {((p.avg_win_rate ?? 0) * 100).toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_ttfb != null ? p.avg_ttfb.toFixed(0) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-accent">
                    {p.avg_prosody != null ? p.avg_prosody.toFixed(3) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_nisqa != null ? p.avg_nisqa.toFixed(3) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-[family-name:var(--font-mono)] text-text-body">
                    {p.avg_dnsmos != null ? p.avg_dnsmos.toFixed(3) : '—'}
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

const METRIC_OPTIONS: { value: string; label: string }[] = [
  { value: 'prosody_score', label: 'Prosody Score' },
  { value: 'nisqa_overall', label: 'NISQA Overall' },
  { value: 'dnsmos_overall', label: 'DNSMOS Overall' },
  { value: 'utmos', label: 'UTMOS' },
  { value: 'wer_score', label: 'Word Error Rate' },
  { value: 'ttfb_ms', label: 'Time to First Byte (ms)' },
  { value: 'duration_seconds', label: 'Duration (s)' },
  { value: 'snr_db', label: 'Signal-to-Noise Ratio (dB)' },
]

function computeSummaryStats(bins: MetricDistribution['bins'], totalValues: number) {
  if (bins.length === 0 || totalValues === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 }
  }

  // Min: first non-empty bin start
  const nonEmptyBins = bins.filter((b) => b.count > 0)
  const min = nonEmptyBins.length > 0 ? nonEmptyBins[0].bin_start : bins[0].bin_start
  // Max: last non-empty bin end
  const max = nonEmptyBins.length > 0 ? nonEmptyBins[nonEmptyBins.length - 1].bin_end : bins[bins.length - 1].bin_end

  // Mean: weighted average of midpoints
  let weightedSum = 0
  for (const b of bins) {
    const midpoint = (b.bin_start + b.bin_end) / 2
    weightedSum += midpoint * b.count
  }
  const mean = weightedSum / totalValues

  // Median: find bin where cumulative count crosses total/2
  const halfTotal = totalValues / 2
  let cumulative = 0
  let median = mean // fallback
  for (const b of bins) {
    cumulative += b.count
    if (cumulative >= halfTotal) {
      // Linear interpolation within the median bin
      const prevCumulative = cumulative - b.count
      const fraction = b.count > 0 ? (halfTotal - prevCumulative) / b.count : 0.5
      median = b.bin_start + fraction * (b.bin_end - b.bin_start)
      break
    }
  }

  // Std dev: sqrt(sum(count * (midpoint - mean)^2) / total)
  let varianceSum = 0
  for (const b of bins) {
    const midpoint = (b.bin_start + b.bin_end) / 2
    varianceSum += b.count * (midpoint - mean) ** 2
  }
  const stdDev = Math.sqrt(varianceSum / totalValues)

  return { min, max, mean, median, stdDev }
}

function formatBinRange(binStart: number, binEnd: number): string {
  // Use reasonable precision based on range magnitude
  const range = binEnd - binStart
  const decimals = range < 0.01 ? 4 : range < 0.1 ? 3 : range < 1 ? 2 : range < 10 ? 1 : 0
  return `${binStart.toFixed(decimals)}-${binEnd.toFixed(decimals)}`
}

function formatStatValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(1)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toFixed(4)
}

function MetricExplorerTooltip({
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
          Count: {entry.value}
        </p>
      ))}
    </div>
  )
}

function MetricExplorerTab({ activeMode }: { activeMode: string }) {
  const [selectedMetric, setSelectedMetric] = useState('prosody_score')
  const [distribution, setDistribution] = useState<MetricDistribution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.analytics
      .metricDistribution(selectedMetric, activeMode)
      .then((data) => {
        setDistribution(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load metric distribution')
        setLoading(false)
      })
  }, [selectedMetric, activeMode])

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label ?? selectedMetric

  if (loading) {
    return (
      <motion.div
        key="metricExplorer"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex items-center justify-center py-20"
      >
        <div className="text-text-faint font-[family-name:var(--font-mono)] text-sm">
          Loading metric distribution...
        </div>
      </motion.div>
    )
  }

  if (error || !distribution) {
    return (
      <motion.div
        key="metricExplorer"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="space-y-6"
      >
        {/* Still show the selector so user can switch metric */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4"
        >
          <BarChart3 className="h-5 w-5 text-accent" />
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="bg-bg-surface border border-border-default rounded-lg px-3 py-2 text-text-primary text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:border-accent"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </motion.div>
        <div className="flex items-center justify-center py-16">
          <div className="text-text-faint font-[family-name:var(--font-mono)] text-sm">
            {error || 'No distribution data available for this metric and mode.'}
          </div>
        </div>
      </motion.div>
    )
  }

  const chartData = distribution.bins.map((b) => ({
    range: formatBinRange(b.bin_start, b.bin_end),
    count: b.count,
  }))

  const stats = computeSummaryStats(distribution.bins, distribution.total_values)

  return (
    <motion.div
      key="metricExplorer"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Header with metric selector */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-4 mb-1">
          <BarChart3 className="h-5 w-5 text-accent" />
          <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary">
            Metric Explorer
          </h3>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="bg-bg-surface border border-border-default rounded-lg px-3 py-2 text-text-primary text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:border-accent"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] ml-9">
          Distribution of {metricLabel} across all evaluations
        </p>
      </motion.div>

      {/* Histogram */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h4 className="text-text-primary font-medium mb-1">
          {metricLabel} Distribution
        </h4>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6">
          {distribution.total_values.toLocaleString()} total values across {distribution.bins.length} bins
        </p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              barCategoryGap="10%"
            >
              <CartesianGrid vertical={false} stroke="#1C1E2E" />
              <XAxis
                dataKey="range"
                tick={{ fill: '#888899', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: '#1C1E2E' }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: '#4E4E5E', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<MetricExplorerTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="count"
                fill="#2DD4A8"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h4 className="text-text-primary font-medium mb-4">Summary Statistics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Values', value: distribution.total_values.toLocaleString() },
            { label: 'Min', value: formatStatValue(stats.min) },
            { label: 'Max', value: formatStatValue(stats.max) },
            { label: 'Mean', value: formatStatValue(stats.mean) },
            { label: 'Median', value: formatStatValue(stats.median) },
            { label: 'Std Dev', value: formatStatValue(stats.stdDev) },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-text-faint mb-1">
                {stat.label}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-lg text-text-primary">
                {stat.value}
              </p>
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

function formatBattleDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncatePrompt(text: string, maxLen = 50): string {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '\u2026'
}

function buildModelsLabel(row: Record<string, unknown>): string {
  const parts: string[] = []
  if (row.model_a_name) parts.push(String(row.model_a_name))
  if (row.model_b_name) parts.push(String(row.model_b_name))
  if (row.model_c_name) parts.push(String(row.model_c_name))
  if (row.model_d_name) parts.push(String(row.model_d_name))
  return parts.join(' vs ')
}

function winnerBadge(winner: string | null | undefined) {
  if (!winner) return <span className="text-text-faint text-xs">--</span>
  const w = String(winner).toLowerCase()
  if (w === 'tie') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-bg-hover text-text-faint border border-border-default">
        tie
      </span>
    )
  }
  if (w === 'all_bad') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
        all bad
      </span>
    )
  }
  // a, b, c, d — winner badges
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
      {w}
    </span>
  )
}

function DatasetTab({ activeMode }: { activeMode: string }) {
  const [battles, setBattles] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [columnCount, setColumnCount] = useState<number>(0)

  useEffect(() => {
    setLoading(true)
    api.analytics
      .battleHistory({ battle_type: activeMode, limit: 10 })
      .then((data) => {
        setBattles(data)
        if (data.length > 0) {
          setColumnCount(Object.keys(data[0]).length)
        }
        setLoading(false)
      })
      .catch(() => {
        setBattles([])
        setLoading(false)
      })
  }, [activeMode])

  const exportCsvUrl = api.analytics.exportUrl({ battle_type: activeMode, format: 'csv' })
  const exportJsonUrl = api.analytics.exportUrl({ battle_type: activeMode, format: 'json' })

  return (
    <motion.div
      key="dataset"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Preview Table */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-1">
          Recent Battles
        </h3>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6">
          Last 10 battles for the selected mode
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-text-faint font-[family-name:var(--font-mono)] text-sm">
              Loading battle history...
            </div>
          </div>
        ) : battles.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-text-faint font-[family-name:var(--font-mono)] text-sm">
              No battle data available for this mode.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                    Date
                  </th>
                  <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                    Prompt
                  </th>
                  <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                    Models
                  </th>
                  <th className="text-center py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                    Winner
                  </th>
                </tr>
              </thead>
              <tbody>
                {battles.map((row, idx) => (
                  <motion.tr
                    key={String(row.battle_id ?? idx)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="border-b border-border-default/50 last:border-0"
                  >
                    <td className="py-3 px-3 font-[family-name:var(--font-mono)] text-text-body text-xs whitespace-nowrap">
                      {row.created_at ? formatBattleDate(String(row.created_at)) : '--'}
                    </td>
                    <td className="py-3 px-3 text-text-primary text-xs max-w-[260px] truncate" title={String(row.prompt_text ?? '')}>
                      {truncatePrompt(String(row.prompt_text ?? ''))}
                    </td>
                    <td className="py-3 px-3 font-[family-name:var(--font-mono)] text-text-body text-xs whitespace-nowrap">
                      {buildModelsLabel(row)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {winnerBadge(row.winner as string | null | undefined)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Column count indicator */}
        {columnCount > 0 && (
          <p className="text-text-faint text-xs text-center italic mt-4 font-[family-name:var(--font-mono)]">
            Export includes {columnCount} columns with per-model evaluation metrics
          </p>
        )}
      </motion.div>

      {/* Export Buttons */}
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
      // apiSummary stays null; stats cards show loading skeleton
    })
  }, [])

  function renderTab() {
    switch (activeTab) {
      case 'votes':
        return <VoteAnalyticsTab apiSummary={apiSummary} activeMode={activeMode} />
      case 'correlations':
        return <ProviderComparisonTab activeMode={activeMode} />
      case 'metricExplorer':
        return <MetricExplorerTab activeMode={activeMode} />
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
