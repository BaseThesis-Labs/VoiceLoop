import { useState } from 'react'
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
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { arenaStats, metricCorrelations, fairnessData } from '../data/mockData'

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
  { id: 'correlations', label: 'Metric Correlations' },
  { id: 'fairness', label: 'Fairness' },
  { id: 'papers', label: 'Papers' },
  { id: 'dataset', label: 'Dataset' },
]

const voteDistribution = [
  { outcome: 'A Wins', pct: 42, fill: '#6366f1' },
  { outcome: 'B Wins', pct: 38, fill: '#f59e0b' },
  { outcome: 'Tie', pct: 15, fill: '#888899' },
  { outcome: 'Both Bad', pct: 5, fill: '#ef4444' },
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

function VoteAnalyticsTab() {
  const stats = [
    { label: 'Total Votes', value: arenaStats.totalVotes.toLocaleString(), icon: Vote },
    { label: 'Unique Voters', value: arenaStats.uniqueVoters.toLocaleString(), icon: Users },
    { label: 'Avg Battles / Voter', value: arenaStats.avgBattlesPerVoter.toFixed(1), icon: BarChart3 },
    { label: "Krippendorff's \u03B1", value: arenaStats.interRaterAgreement.toFixed(2), icon: Scale },
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
              data={voteDistribution}
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
                {voteDistribution.map((entry) => (
                  <motion.rect key={entry.outcome} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-border-default">
          {voteDistribution.map((entry) => (
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

function MetricCorrelationsTab() {
  return (
    <motion.div
      key="correlations"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Correlation Table */}
      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h3 className="font-[family-name:var(--font-display)] text-lg text-text-primary mb-1">
          Correlation of Arena Score with Automated Metrics
        </h3>
        <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mb-6 max-w-2xl">
          Pearson correlation coefficient between human preference (BT score) and automated pipeline metrics
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Metric
                </th>
                <th className="text-right py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium w-24">
                  Pearson r
                </th>
                <th className="text-left py-3 px-3 text-text-faint font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] font-medium">
                  Strength
                </th>
              </tr>
            </thead>
            <tbody>
              {metricCorrelations.map((row, idx) => (
                <motion.tr
                  key={row.metric}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.07 }}
                  className="border-b border-border-default/50 last:border-0"
                >
                  <td className="py-3.5 px-3">
                    <div className="flex flex-col">
                      <span className="text-text-primary font-medium">{row.metric}</span>
                      <span className="text-text-faint text-xs">{row.label}</span>
                    </div>
                  </td>
                  <td className={`py-3.5 px-3 text-right font-[family-name:var(--font-mono)] font-medium ${correlationColor(row.pearson)}`}>
                    {row.pearson.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-bg-hover rounded-full overflow-hidden max-w-[200px]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: correlationBarColor(row.pearson) }}
                          initial={{ width: 0 }}
                          animate={{ width: `${row.pearson * 100}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.07 + 0.2, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
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
          Neural MOS metrics (UTMOS, NISQA) correlate better with human preference
          than acoustic metrics (WER, SECS) — suggesting perceptual quality dominates
          functional accuracy in user preference.
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
          Our research paper on Voice Loop Arena will be submitted to Interspeech 2026.
        </p>
      </div>
    </motion.div>
  )
}

function DatasetTab() {
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
          Dataset Download
        </h3>
        <p className="text-text-body text-sm max-w-md leading-relaxed mb-6">
          Voice Loop Arena dataset (CC-BY-4.0) — Coming with Phase 3 launch
        </p>
        <button
          disabled
          className="inline-flex items-center gap-2 bg-bg-hover border border-border-default text-text-faint font-[family-name:var(--font-mono)] text-sm px-6 py-3 rounded-lg cursor-not-allowed opacity-50"
        >
          <Download className="h-4 w-4" />
          Download Dataset (.tar.gz)
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('votes')

  function renderTab() {
    switch (activeTab) {
      case 'votes':
        return <VoteAnalyticsTab />
      case 'correlations':
        return <MetricCorrelationsTab />
      case 'fairness':
        return <FairnessTab />
      case 'papers':
        return <PapersTab />
      case 'dataset':
        return <DatasetTab />
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
