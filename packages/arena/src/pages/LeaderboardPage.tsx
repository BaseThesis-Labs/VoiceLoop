import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, ChevronDown, ArrowUpDown, ExternalLink, Star } from 'lucide-react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { Link } from 'react-router-dom'
import { models, agents } from '../data/mockData'
import type { Model } from '../data/mockData'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 'models' | 'agents'
type Category = 'all' | 'tts' | 'asr' | 's2s' | 'conversational'

const tierLabels: { key: Tier; label: string }[] = [
  { key: 'models', label: 'Models' },
  { key: 'agents', label: 'Agents' },
]

const categoryLabels: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tts', label: 'TTS' },
  { key: 'asr', label: 'ASR' },
  { key: 's2s', label: 'S2S' },
  { key: 'conversational', label: 'Conversational' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

// Normalize a value into 0-100 given min/max of the dataset.
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

function buildRadarData(topModels: Model[]): RadarDimension[] {
  // Gather ranges for normalization from all models in the dataset
  const allModels = models.filter(
    (m) =>
      m.metrics.utmos !== undefined &&
      m.metrics.nisqa !== undefined &&
      m.metrics.wer !== undefined &&
      m.metrics.ttfb !== undefined &&
      m.metrics.secs !== undefined,
  )

  if (allModels.length === 0) return []

  const utmosVals = allModels.map((m) => m.metrics.utmos)
  const werVals = allModels.map((m) => m.metrics.wer)
  const ttfbVals = allModels.map((m) => m.metrics.ttfb)
  const f0rmseVals = allModels.map((m) => m.metrics.f0rmse ?? 10)
  const nisqaVals = allModels.map((m) => m.metrics.nisqa)
  const secsVals = allModels.map((m) => m.metrics.secs)

  const dims = [
    {
      dimension: 'Naturalness',
      key: 'utmos',
      vals: utmosVals,
      invert: false,
    },
    {
      dimension: 'Intelligibility',
      key: 'wer',
      vals: werVals,
      invert: true,
    },
    { dimension: 'Latency', key: 'ttfb', vals: ttfbVals, invert: true },
    {
      dimension: 'Expressiveness',
      key: 'f0rmse',
      vals: f0rmseVals,
      invert: true,
    },
    { dimension: 'Quality', key: 'nisqa', vals: nisqaVals, invert: false },
    {
      dimension: 'Similarity',
      key: 'secs',
      vals: secsVals,
      invert: false,
    },
  ]

  return dims.map((d) => {
    const min = Math.min(...d.vals)
    const max = Math.max(...d.vals)
    const row: RadarDimension = { dimension: d.dimension, fullMark: 100 }
    topModels.forEach((m, i) => {
      const raw = m.metrics[d.key] ?? (d.invert ? max : min)
      row[`model${i}`] = Math.round(normalize(raw, min, max, d.invert))
    })
    return row
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierToggle({
  active,
  onChange,
}: {
  active: Tier
  onChange: (t: Tier) => void
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-surface border border-border-default">
      {tierLabels.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            active === t.key
              ? 'text-accent'
              : 'text-text-body hover:text-text-primary'
          }`}
        >
          {active === t.key && (
            <motion.div
              layoutId="tier-pill"
              className="absolute inset-0 rounded-md bg-accent/10 border border-accent/20"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

function CategoryPills({
  active,
  onChange,
}: {
  active: Category
  onChange: (c: Category) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {categoryLabels.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            active === c.key
              ? 'bg-accent/10 text-accent border-accent/20'
              : 'text-text-body border-border-default hover:text-text-primary hover:border-border-strong'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

function SortButton() {
  return (
    <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-body rounded-lg border border-border-default hover:text-text-primary hover:border-border-strong transition-colors">
      <ArrowUpDown size={13} />
      <span className="font-[family-name:var(--font-mono)]">Arena Score</span>
      <ChevronDown size={13} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Model Leaderboard Table
// ---------------------------------------------------------------------------

function ModelTable({ items, tier }: { items: Model[]; tier: Tier }) {
  const maxScore = Math.max(...items.map((m) => m.arenaScore))

  const isAgent = tier === 'agents'

  return (
    <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-bg-surface-header text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">
              <th className="text-left pl-5 pr-2 py-3 w-12">#</th>
              <th className="text-left px-3 py-3">
                {isAgent ? 'Agent' : 'Model'}
              </th>
              <th className="text-left px-3 py-3">Provider</th>
              <th className="text-left px-3 py-3">Arena Score</th>
              {isAgent ? (
                <>
                  <th className="text-right px-3 py-3">Task Compl.%</th>
                  <th className="text-right px-3 py-3">Med. Latency</th>
                  <th className="text-right px-3 py-3">Barge-in</th>
                </>
              ) : (
                <>
                  <th className="text-right px-3 py-3">95% CI</th>
                  <th className="text-right px-3 py-3">Votes</th>
                </>
              )}
              <th className="text-right px-3 pr-5 py-3">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {items.map((item, idx) => {
                const rank = idx + 1
                const ci =
                  ((item.ciUpper - item.ciLower) / 2).toFixed(1)
                const barWidth = (item.arenaScore / maxScore) * 100

                return (
                  <motion.tr
                    key={item.id}
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
                        to={`/model/${item.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:text-accent transition-colors"
                      >
                        {item.name}
                        {item.isOpenSource && (
                          <Star
                            size={12}
                            className="text-accent/60 fill-accent/30"
                          />
                        )}
                        <ExternalLink
                          size={11}
                          className="text-text-faint opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </Link>
                    </td>

                    {/* Provider */}
                    <td className="px-3 py-3 text-sm text-text-body">
                      {item.provider}
                    </td>

                    {/* Arena Score with background bar */}
                    <td className="px-3 py-3">
                      <div className="relative flex items-center">
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 rounded bg-accent/[0.08]"
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="relative z-10 text-sm font-semibold text-text-primary font-[family-name:var(--font-mono)]">
                          {item.arenaScore}
                        </span>
                      </div>
                    </td>

                    {isAgent ? (
                      <>
                        {/* Task Completion */}
                        <td className="px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-body">
                          {item.metrics.taskCompletion ?? '—'}%
                        </td>
                        {/* Median Latency */}
                        <td className="px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-body">
                          {item.metrics.medianLatency ?? '—'}ms
                        </td>
                        {/* Barge-in Score */}
                        <td className="px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-body">
                          {item.metrics.bargeIn != null
                            ? (item.metrics.bargeIn * 100).toFixed(0) + '%'
                            : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        {/* 95% CI */}
                        <td className="px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-faint">
                          &plusmn;{ci}
                        </td>
                        {/* Votes */}
                        <td className="px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] text-text-body">
                          {formatNumber(item.totalBattles)}
                        </td>
                      </>
                    )}

                    {/* Win Rate */}
                    <td className="px-3 pr-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.winRate >= 0.6
                                ? 'bg-accent'
                                : 'bg-text-body'
                            }`}
                            style={{ width: `${item.winRate * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-sm font-[family-name:var(--font-mono)] ${
                            item.winRate >= 0.6
                              ? 'text-accent'
                              : 'text-text-body'
                          }`}
                        >
                          {pct(item.winRate)}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Radar Comparison Section
// ---------------------------------------------------------------------------

function RadarComparison({ topModels }: { topModels: Model[] }) {
  const data = buildRadarData(topModels)

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
          Select 2-5 models to compare across dimensions
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
              {topModels.map((_, i) => (
                <Radar
                  key={i}
                  name={topModels[i].name}
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
          {topModels.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: radarColors[i].stroke }}
              />
              <span className="text-xs text-text-body">{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ---------------------------------------------------------------------------
// Automated Metrics Table
// ---------------------------------------------------------------------------

function AutomatedMetricsTable({ items }: { items: Model[] }) {
  // Only show models that have the TTS metrics
  const metricsModels = items.filter(
    (m) =>
      m.metrics.utmos !== undefined &&
      m.metrics.nisqa !== undefined &&
      m.metrics.wer !== undefined &&
      m.metrics.ttfb !== undefined &&
      m.metrics.secs !== undefined,
  )

  if (metricsModels.length === 0) return null

  // Find best (min/max) per column
  const bestUtmos = Math.max(...metricsModels.map((m) => m.metrics.utmos))
  const bestNisqa = Math.max(...metricsModels.map((m) => m.metrics.nisqa))
  const bestWer = Math.min(...metricsModels.map((m) => m.metrics.wer))
  const bestTtfb = Math.min(...metricsModels.map((m) => m.metrics.ttfb))
  const bestSecs = Math.max(...metricsModels.map((m) => m.metrics.secs))

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text-primary font-[family-name:var(--font-display)]">
          Automated Pipeline Metrics
        </h2>
        <p className="text-sm text-text-body mt-1">
          Objective benchmarks from our automated evaluation pipeline
        </p>
      </div>

      <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-bg-surface-header text-text-faint font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">
                <th className="text-left pl-5 px-3 py-3">Model</th>
                <th className="text-right px-3 py-3">
                  UTMOS <span className="text-accent/60">&uarr;</span>
                </th>
                <th className="text-right px-3 py-3">
                  NISQA <span className="text-accent/60">&uarr;</span>
                </th>
                <th className="text-right px-3 py-3">
                  WER% <span className="text-red-400/60">&darr;</span>
                </th>
                <th className="text-right px-3 py-3">
                  TTFB ms <span className="text-red-400/60">&darr;</span>
                </th>
                <th className="text-right px-3 pr-5 py-3">
                  SECS <span className="text-accent/60">&uarr;</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {metricsModels.map((m, idx) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  className={`border-t border-border-default hover:bg-bg-hover transition-colors ${
                    idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <td className="pl-5 px-3 py-3 text-sm font-medium text-text-primary">
                    {m.name}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] ${
                      m.metrics.utmos === bestUtmos
                        ? 'text-accent font-semibold'
                        : 'text-text-body'
                    }`}
                  >
                    {m.metrics.utmos.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] ${
                      m.metrics.nisqa === bestNisqa
                        ? 'text-accent font-semibold'
                        : 'text-text-body'
                    }`}
                  >
                    {m.metrics.nisqa.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] ${
                      m.metrics.wer === bestWer
                        ? 'text-accent font-semibold'
                        : 'text-text-body'
                    }`}
                  >
                    {m.metrics.wer.toFixed(1)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-sm font-[family-name:var(--font-mono)] ${
                      m.metrics.ttfb === bestTtfb
                        ? 'text-accent font-semibold'
                        : 'text-text-body'
                    }`}
                  >
                    {m.metrics.ttfb}
                  </td>
                  <td
                    className={`px-3 pr-5 py-3 text-right text-sm font-[family-name:var(--font-mono)] ${
                      m.metrics.secs === bestSecs
                        ? 'text-accent font-semibold'
                        : 'text-text-body'
                    }`}
                  >
                    {m.metrics.secs.toFixed(2)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const [activeTier, setActiveTier] = useState<Tier>('models')
  const [activeCategory, setActiveCategory] = useState<Category>('all')

  // Filter items based on tier and category
  const items = useMemo(() => {
    const source = activeTier === 'models' ? models : agents
    if (activeCategory === 'all') return source

    const categoryMap: Record<Category, string[]> = {
      all: [],
      tts: ['tts'],
      asr: ['asr'],
      s2s: ['s2s', 'speech_llm'],
      conversational: ['agent'],
    }
    const types = categoryMap[activeCategory]
    const filtered = source.filter((m) => types.includes(m.type))
    return filtered.length > 0 ? filtered : source
  }, [activeTier, activeCategory])

  // Top 3 models for radar (only when model tier is active)
  const radarModels = useMemo(() => {
    return models
      .filter(
        (m) =>
          m.metrics.utmos !== undefined &&
          m.metrics.nisqa !== undefined &&
          m.metrics.wer !== undefined &&
          m.metrics.ttfb !== undefined &&
          m.metrics.secs !== undefined,
      )
      .sort((a, b) => b.arenaScore - a.arenaScore)
      .slice(0, 3)
  }, [])

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
            Multi-dimensional rankings across voice models and agents
          </p>
        </motion.div>

        {/* ---- Filter Bar ---- */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6"
        >
          <TierToggle
            active={activeTier}
            onChange={(t) => {
              setActiveTier(t)
              setActiveCategory('all')
            }}
          />

          <div className="hidden sm:block w-px h-6 bg-border-default" />

          <CategoryPills
            active={activeCategory}
            onChange={setActiveCategory}
          />

          <div className="sm:ml-auto">
            <SortButton />
          </div>
        </motion.div>

        {/* ---- Main Leaderboard Table ---- */}
        <motion.div
          key={activeTier}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-16"
        >
          <ModelTable items={items} tier={activeTier} />
        </motion.div>

        {/* ---- Radar Chart — only for models tier ---- */}
        {activeTier === 'models' && radarModels.length >= 2 && (
          <div className="mb-16">
            <RadarComparison topModels={radarModels} />
          </div>
        )}

        {/* ---- Automated Metrics — only for models tier ---- */}
        {activeTier === 'models' && (
          <div className="mb-16">
            <AutomatedMetricsTable items={models} />
          </div>
        )}
      </div>
    </main>
  )
}
