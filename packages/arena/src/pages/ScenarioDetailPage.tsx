import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Mic,
  Shield,
  Clock,
  Target,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { scenarios, agents } from '../data/mockData'

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
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

const tableRowVariant = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      delay: i * 0.1,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  }),
}

// ---------------------------------------------------------------------------
// Domain icon mapping
// ---------------------------------------------------------------------------

function domainIcon(domain: string) {
  switch (domain) {
    case 'Healthcare':
      return <Shield className="h-4 w-4" />
    case 'Security':
      return <AlertTriangle className="h-4 w-4" />
    default:
      return <Target className="h-4 w-4" />
  }
}

// ---------------------------------------------------------------------------
// Mock leaderboard data for scenario
// ---------------------------------------------------------------------------

interface ScenarioLeaderboardEntry {
  agent: (typeof agents)[0]
  score: number
  metrics: number[]
}

function getScenarioLeaderboard(): ScenarioLeaderboardEntry[] {
  const topAgents = [...agents]
    .sort((a, b) => b.arenaScore - a.arenaScore)
    .slice(0, 4)

  const mockScores = [1234, 1198, 1156, 1121]
  const mockMetrics = [
    [4.1, 94, 0.89, 92],
    [5.7, 91, 0.92, 88],
    [3.8, 87, 0.81, 85],
    [6.2, 83, 0.76, 81],
  ]

  return topAgents.map((agent, i) => ({
    agent,
    score: mockScores[i],
    metrics: mockMetrics[i],
  }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString()
  }
  return n.toString()
}

function findBestInColumn(
  entries: ScenarioLeaderboardEntry[],
  colIndex: number
): number {
  // For column 0 (score), higher is better
  // For metric columns, we need to determine direction:
  //   - Columns with "WER", "rate", "error" -> lower is better
  //   - Others -> higher is better
  // Simplification: col 0 (score) highest, col 1 (WER-like) lowest, rest highest
  if (colIndex === 0) {
    return Math.max(...entries.map((e) => e.score))
  }
  const metricIdx = colIndex - 1
  const values = entries.map((e) => e.metrics[metricIdx])
  // First metric column tends to be error-type (lower is better), rest higher is better
  if (metricIdx === 0) {
    return Math.min(...values)
  }
  return Math.max(...values)
}

function isMetricBest(
  value: number,
  entries: ScenarioLeaderboardEntry[],
  colIndex: number
): boolean {
  return value === findBestInColumn(entries, colIndex)
}

function formatMetricValue(value: number, metricIdx: number): string {
  if (metricIdx === 0) {
    // Error rate like WER — show as percentage
    return `${value}%`
  }
  if (metricIdx === 1) {
    // Compliance / accuracy — show as percentage
    return `${value}%`
  }
  if (metricIdx === 2) {
    // Score-type metric — show decimal
    return value.toFixed(2)
  }
  // Task completion — show as percentage
  return `${value}%`
}

// ---------------------------------------------------------------------------
// ScenarioDetailPage
// ---------------------------------------------------------------------------

export default function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const scenario = scenarios.find((s) => s.id === id) ?? scenarios[0]
  const leaderboard = getScenarioLeaderboard()

  return (
    <main className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        {/* ================================================================ */}
        {/* Back Link                                                        */}
        {/* ================================================================ */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 text-text-body text-sm hover:text-accent transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scenarios
          </Link>
        </motion.div>

        {/* ================================================================ */}
        {/* Scenario Header Card                                             */}
        {/* ================================================================ */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="bg-bg-surface rounded-xl border border-border-default p-8 mb-12"
        >
          {/* Name and domain pill */}
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-text-primary">
              {scenario.name}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-accent text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider bg-accent/10 border border-accent/20 rounded-full px-3 py-1 mt-1.5">
              {domainIcon(scenario.domain)}
              {scenario.domain}
            </span>
          </div>

          {/* Description */}
          <p className="text-text-body text-sm sm:text-base leading-relaxed mb-8 max-w-3xl">
            {scenario.description}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-8 mb-8 pb-8 border-b border-border-default">
            {/* Difficulty */}
            <div className="flex flex-col gap-1.5">
              <span className="text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
                Difficulty
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      i < scenario.difficulty
                        ? 'bg-accent'
                        : 'bg-text-faint/30'
                    }`}
                  />
                ))}
                <span className="text-text-body text-sm ml-1.5 font-[family-name:var(--font-mono)]">
                  {scenario.difficulty}/5
                </span>
              </div>
            </div>

            {/* Avg Duration */}
            <div className="flex flex-col gap-1.5">
              <span className="text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
                Avg Battle Duration
              </span>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-text-faint" />
                <span className="text-text-primary text-sm font-[family-name:var(--font-mono)]">
                  {scenario.avgDuration}
                </span>
              </div>
            </div>

            {/* Battles Run */}
            <div className="flex flex-col gap-1.5">
              <span className="text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
                Battles Run
              </span>
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-text-faint" />
                <span className="text-text-primary text-sm font-[family-name:var(--font-mono)]">
                  {formatNumber(scenario.battlesRun)}
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div>
            <span className="text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-3 block">
              Key Metrics
            </span>
            <div className="flex flex-wrap gap-2">
              {scenario.keyMetrics.map((metric) => (
                <span
                  key={metric}
                  className="text-text-body text-xs font-[family-name:var(--font-mono)] bg-bg-hover border border-border-default rounded-lg px-3 py-1.5"
                >
                  {metric}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ================================================================ */}
        {/* Challenge Variants                                               */}
        {/* ================================================================ */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mb-12"
        >
          <motion.div variants={staggerChild} className="mb-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl text-text-primary font-semibold mb-1.5">
              Challenge Variants
            </h2>
            <p className="text-text-body text-sm">
              Each variant tests a different dimension of voice AI capability
            </p>
          </motion.div>

          <div className="space-y-3">
            {scenario.challengeVariants.map((variant, i) => (
              <motion.div
                key={i}
                variants={staggerChild}
                className="group flex items-center gap-4 bg-bg-surface rounded-lg border border-border-default p-4 transition-all duration-200 hover:border-border-strong hover:bg-bg-hover"
              >
                <span className="flex-shrink-0 font-[family-name:var(--font-mono)] text-accent text-sm font-semibold w-7">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-text-body text-sm leading-relaxed flex-1">
                  {variant}
                </span>
                <ChevronRight className="h-4 w-4 text-text-faint opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ================================================================ */}
        {/* Scenario Leaderboard                                             */}
        {/* ================================================================ */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mb-12"
        >
          <motion.div variants={staggerChild} className="mb-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl text-text-primary font-semibold mb-1.5">
              Scenario Leaderboard
            </h2>
            <p className="text-text-body text-sm">
              Which agents perform best on this scenario
            </p>
          </motion.div>

          <motion.div
            variants={staggerChild}
            className="bg-bg-surface rounded-xl border border-border-default overflow-hidden"
          >
            {/* Desktop table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0B0D14]">
                    <th className="text-left text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider px-5 py-3.5 w-16">
                      Rank
                    </th>
                    <th className="text-left text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider px-5 py-3.5">
                      Agent
                    </th>
                    <th className="text-right text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider px-5 py-3.5">
                      Arena Score
                    </th>
                    {scenario.keyMetrics.map((metric) => (
                      <th
                        key={metric}
                        className="text-right text-text-faint text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider px-5 py-3.5 hidden sm:table-cell"
                      >
                        {metric}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {leaderboard.map((entry, i) => (
                    <motion.tr
                      key={entry.agent.id}
                      custom={i}
                      variants={tableRowVariant}
                      initial="hidden"
                      animate="visible"
                      className="group transition-colors duration-200 hover:bg-bg-hover"
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${
                            i === 0
                              ? 'text-accent'
                              : i === 1
                                ? 'text-text-body'
                                : 'text-text-faint'
                          }`}
                        >
                          #{i + 1}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          to={`/model/${entry.agent.id}`}
                          className="flex items-center gap-3 group/link"
                        >
                          <div className="h-8 w-8 rounded-lg bg-bg-hover border border-border-default flex items-center justify-center flex-shrink-0">
                            <span className="font-[family-name:var(--font-mono)] text-xs text-accent font-semibold">
                              {entry.agent.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-primary font-medium group-hover/link:text-accent transition-colors duration-200">
                              {entry.agent.name}
                            </span>
                            <span className="block text-text-faint text-xs">
                              {entry.agent.provider}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={`font-[family-name:var(--font-mono)] font-semibold ${
                            isMetricBest(entry.score, leaderboard, 0)
                              ? 'text-accent'
                              : 'text-text-primary'
                          }`}
                        >
                          {entry.score}
                        </span>
                      </td>
                      {entry.metrics.map((value, mIdx) => (
                        <td
                          key={mIdx}
                          className="px-5 py-4 text-right hidden sm:table-cell"
                        >
                          <span
                            className={`font-[family-name:var(--font-mono)] ${
                              isMetricBest(value, leaderboard, mIdx + 1)
                                ? 'text-accent'
                                : 'text-text-body'
                            }`}
                          >
                            {formatMetricValue(value, mIdx)}
                          </span>
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.section>

        {/* ================================================================ */}
        {/* Battle CTA                                                       */}
        {/* ================================================================ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-bg-surface rounded-xl border border-accent/20 p-8 text-center"
        >
          <div className="flex justify-center mb-5">
            <div className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Mic className="h-7 w-7 text-accent" />
            </div>
          </div>

          <h3 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl text-text-primary mb-2">
            Battle in this scenario
          </h3>
          <p className="text-text-body text-sm mb-6 max-w-md mx-auto">
            Put two agents head-to-head on {scenario.name}
          </p>

          <Link
            to="/battle"
            className="group inline-flex items-center gap-2.5 bg-accent text-bg-primary font-semibold rounded-lg px-6 py-3 text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(45,212,168,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <Mic className="h-4 w-4" />
            Start Battle
            <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
