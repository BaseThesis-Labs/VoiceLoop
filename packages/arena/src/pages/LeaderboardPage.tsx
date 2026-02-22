import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, ExternalLink } from 'lucide-react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { Link } from 'react-router-dom'
import { api, type LeaderboardEntry, type MetricConfig, type LeaderboardResponse } from '../api/client'
import { ModeSelector, getStoredMode, type BattleMode } from '../components/ModeSelector'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function normalize(
  value: number,
  min: number,
  max: number,
  invert: boolean = false,
): number {
  if (max === min) return 50
  const norm = ((value - min) / (max - min)) * 100
  return invert ? 100 - norm : norm
}

function formatMetric(val: number, format: string): string {
  switch (format) {
    case 'ms':
      return `${val.toFixed(0)}ms`
    case 'decimal_2':
      return val.toFixed(2)
    case 'percent':
      return `${(val * 100).toFixed(1)}%`
    case 'score_5':
      return (val * 5).toFixed(2)
    default:
      return val.toFixed(2)
  }
}

// ---------------------------------------------------------------------------
// Radar chart data builder
// ---------------------------------------------------------------------------

const radarColors = [
  { stroke: '#2DD4A8', fill: '#2DD4A8' },
  { stroke: '#6366f1', fill: '#6366f1' },
  { stroke: '#f59e0b', fill: '#f59e0b' },
]

interface RadarDimension {
  dimension: string
  fullMark: number
  [modelKey: string]: string | number
}

function buildRadarData(
  topEntries: LeaderboardEntry[],
  allEntries: LeaderboardEntry[],
  metricsConfig: MetricConfig[],
): RadarDimension[] {
  if (allEntries.length === 0) return []

  const dims: { dimension: string; key: string; invert: boolean; fromMetrics: boolean }[] = [
    { dimension: 'ELO Rating', key: 'elo_rating', invert: false, fromMetrics: false },
    { dimension: 'Win Rate', key: 'win_rate', invert: false, fromMetrics: false },
    ...metricsConfig.map((mc) => ({
      dimension: mc.label,
      key: mc.key,
      invert: !mc.higher_is_better,
      fromMetrics: true,
    })),
  ]

  return dims.map((d) => {
    const vals = allEntries
      .map((e) => d.fromMetrics ? e.metrics[d.key] : (e as Record<string, unknown>)[d.key] as number | null)
      .filter((v): v is number => v != null)
    if (vals.length === 0) {
      const row: RadarDimension = { dimension: d.dimension, fullMark: 100 }
      topEntries.forEach((_, i) => { row[`model${i}`] = 50 })
      return row
    }
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const row: RadarDimension = { dimension: d.dimension, fullMark: 100 }
    topEntries.forEach((e, i) => {
      const raw = (d.fromMetrics ? e.metrics[d.key] : (e as Record<string, unknown>)[d.key] as number | null) ?? (d.invert ? max : min)
      row[`model${i}`] = Math.round(normalize(raw as number, min, max, d.invert))
    })
    return row
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Leaderboard Table
// ---------------------------------------------------------------------------

function LeaderboardTable({ entries, metricsConfig }: { entries: LeaderboardEntry[]; metricsConfig: MetricConfig[] }) {
  const maxElo = Math.max(...entries.map((e) => e.elo_rating))

  return (
    <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-bg-surface-header text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">
              <th className="text-left pl-5 pr-2 py-3 w-12">#</th>
              <th className="text-left px-3 py-3">Model</th>
              <th className="text-left px-3 py-3">Provider</th>
              <th className="text-left px-3 py-3">ELO Rating</th>
              <th className="text-right px-3 py-3">Battles</th>
              <th className="text-right px-3 py-3">Win Rate</th>
              {metricsConfig.map((mc, i) => (
                <th key={mc.key} className={`text-right px-3 py-3 ${i === metricsConfig.length - 1 ? 'pr-5' : ''}`}>
                  {mc.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
              {entries.map((entry, idx) => {
                const rank = idx + 1
                const barWidth = (entry.elo_rating / maxElo) * 100

                return (
                  <motion.tr
                    key={entry.model_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: idx * 0.03, duration: 0.25 }}
                    className={`group border-t border-border-default hover:bg-bg-hover transition-colors ${
                      idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="pl-5 pr-2 py-3 text-sm font-[family-name:var(--font-mono)]">
                      {rank === 1 ? (
                        <Trophy size={15} className="text-accent" />
                      ) : (
                        <span className="text-text-faint">{rank}</span>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3">
                      <Link
                        to={`/model/${entry.model_id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:text-accent transition-colors"
                      >
                        {entry.model_name}
                        <ExternalLink
                          size={11}
                          className="text-text-faint opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </Link>
                    </td>

                    {/* Provider */}
                    <td className="px-3 py-3 text-sm text-text-body capitalize">
                      {entry.provider}
                    </td>

                    {/* ELO Rating with background bar */}
                    <td className="px-3 py-3">
                      <div className="relative flex items-center">
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 rounded bg-accent/[0.08]"
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="relative z-10 text-sm font-semibold text-text-primary font-[family-name:var(--font-mono)]">
                          {Math.round(entry.elo_rating)}
                        </span>
                      </div>
                    </td>

                    {/* Battles */}
                    <td className="px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-body">
                      {formatNumber(entry.total_battles)}
                    </td>

                    {/* Win Rate */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              entry.win_rate >= 0.6
                                ? 'bg-accent'
                                : 'bg-text-body'
                            }`}
                            style={{ width: `${entry.win_rate * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-sm font-[family-name:var(--font-mono)] ${
                            entry.win_rate >= 0.6
                              ? 'text-accent'
                              : 'text-text-body'
                          }`}
                        >
                          {entry.total_battles > 0 ? pct(entry.win_rate) : '—'}
                        </span>
                      </div>
                    </td>

                    {/* Dynamic metric columns */}
                    {metricsConfig.map((mc, i) => {
                      const val = entry.metrics[mc.key]
                      return (
                        <td
                          key={mc.key}
                          className={`px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-body ${
                            i === metricsConfig.length - 1 ? 'pr-5' : ''
                          }`}
                        >
                          {val != null ? formatMetric(val, mc.format) : '—'}
                        </td>
                      )
                    })}
                  </motion.tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Radar Comparison Section
// ---------------------------------------------------------------------------

function RadarComparison({
  topEntries,
  allEntries,
  metricsConfig,
}: {
  topEntries: LeaderboardEntry[]
  allEntries: LeaderboardEntry[]
  metricsConfig: MetricConfig[]
}) {
  const data = buildRadarData(topEntries, allEntries, metricsConfig)

  if (data.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text-primary font-[family-name:var(--font-display)]">
          Model Comparison
        </h2>
        <p className="text-sm text-text-body mt-1">
          Top 3 models compared across dimensions
        </p>
      </div>

      <div className="bg-bg-surface rounded-xl border border-border-default p-6">
        <div className="w-full h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
              <PolarGrid stroke="#1C1E2E" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{
                  fill: '#4E4E5E',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              {topEntries.map((entry, i) => (
                <Radar
                  key={entry.model_id}
                  name={entry.model_name}
                  dataKey={`model${i}`}
                  stroke={radarColors[i].stroke}
                  fill={radarColors[i].fill}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          {topEntries.map((entry, i) => (
            <div key={entry.model_id} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: radarColors[i].stroke }}
              />
              <span className="text-xs text-text-body">{entry.model_name}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const [activeMode, setActiveMode] = useState<BattleMode>(getStoredMode)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [metricsConfig, setMetricsConfig] = useState<MetricConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.leaderboard
      .current(activeMode)
      .then((data) => {
        setEntries(data.entries)
        setMetricsConfig(data.metrics_config)
      })
      .catch(() => {
        // API unavailable — show empty state
      })
      .finally(() => setLoading(false))
  }, [activeMode])

  // Top 3 entries with battles for radar
  const radarEntries = useMemo(() => {
    return entries
      .filter((e) => e.total_battles > 0)
      .sort((a, b) => b.elo_rating - a.elo_rating)
      .slice(0, 3)
  }, [entries])

  return (
    <main className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-6xl mx-auto px-6 pt-12">
        {/* ---- Page Header ---- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] text-text-primary tracking-tight">
            Leaderboard
          </h1>
          <p className="text-text-body mt-2 text-base">
            Live ELO rankings from blind A/B voice battles
          </p>
        </motion.div>

        {/* ---- Mode Selector ---- */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mb-6"
        >
          <ModeSelector active={activeMode} onChange={setActiveMode} />
        </motion.div>

        {/* ---- Main Leaderboard Table ---- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-16"
        >
          {loading ? (
            <div className="bg-bg-surface rounded-xl border border-border-default p-12 text-center">
              <p className="text-text-faint text-sm font-[family-name:var(--font-mono)]">
                Loading leaderboard...
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-bg-surface rounded-xl border border-border-default p-12 text-center">
              <p className="text-text-faint text-sm">
                No models ranked yet. Start some battles first!
              </p>
            </div>
          ) : (
            <LeaderboardTable entries={entries} metricsConfig={metricsConfig} />
          )}
        </motion.div>

        {/* ---- Radar Chart ---- */}
        {radarEntries.length >= 2 && (
          <div className="mb-16">
            <RadarComparison
              topEntries={radarEntries}
              allEntries={entries}
              metricsConfig={metricsConfig}
            />
          </div>
        )}
      </div>
    </main>
  )
}
