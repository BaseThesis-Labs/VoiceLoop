import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Mic,
  Layers,
  Bot,
  FlaskConical,
  ArrowRight,
  Swords,
  Trophy,
  Users,
  BarChart3,
  Zap,
  Equal,
} from 'lucide-react'
import { recentBattles as mockBattles, arenaStats as mockStats, models, agents, scenarios } from '../data/mockData'
import WaveformVisualizer from '../components/WaveformVisualizer'
import AuroraGradient from '../components/AuroraGradient'
import { api } from '../api/client'

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
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

// ---------------------------------------------------------------------------
// Tier card data
// ---------------------------------------------------------------------------

const tierCards = [
  {
    icon: Layers,
    title: 'Voice Models',
    description:
      'Compare ASR, TTS, and Speech LLMs at the component level. Blind A/B tests powered by human judges and automatic metrics.',
    link: '/leaderboard?tier=model',
    linkLabel: 'Explore Models',
  },
  {
    icon: Bot,
    title: 'Voice Agents',
    description:
      'Compare end-to-end pipeline systems like Retell, Vapi, and Bland. Full-conversation evaluations across real-world tasks.',
    link: '/leaderboard?tier=agent',
    linkLabel: 'Explore Agents',
  },
  {
    icon: FlaskConical,
    title: 'Voice Scenarios',
    description:
      'Domain-specific stress tests across Medical, Financial, Technical Support, Adversarial, and Multilingual contexts.',
    link: '/leaderboard?tier=scenario',
    linkLabel: 'Explore Scenarios',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return n.toLocaleString()
}

function tierIcon(tier: 'model' | 'agent' | 'scenario') {
  switch (tier) {
    case 'model':
      return <Layers className="h-3.5 w-3.5 text-accent" />
    case 'agent':
      return <Bot className="h-3.5 w-3.5 text-indigo-400" />
    case 'scenario':
      return <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
  }
}

function tierLabel(tier: 'model' | 'agent' | 'scenario') {
  switch (tier) {
    case 'model':
      return 'Model'
    case 'agent':
      return 'Agent'
    case 'scenario':
      return 'Scenario'
  }
}

// ---------------------------------------------------------------------------
// Section wrapper with useInView
// ---------------------------------------------------------------------------

function AnimatedSection({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.section>
  )
}

// ---------------------------------------------------------------------------
// ArenaLanding
// ---------------------------------------------------------------------------

export default function ArenaLanding() {
  const [arenaStats, setArenaStats] = useState(mockStats)
  const [recentBattles] = useState(mockBattles)

  useEffect(() => {
    api.analytics.summary().then((summary) => {
      setArenaStats({
        totalBattles: summary.total_battles,
        totalModels: summary.total_models,
        totalAgents: 0,
        totalScenarios: summary.total_scenarios,
        totalVotes: 0,
        uniqueVoters: 0,
        avgBattlesPerVoter: 0,
        interRaterAgreement: 0,
      })
    }).catch(() => {
      // Fallback to mock stats
    })
  }, [])

  return (
    <main className="relative overflow-hidden">
      {/* ================================================================ */}
      {/* 1. HERO SECTION                                                  */}
      {/* ================================================================ */}
      <section className="relative min-h-[90vh] flex items-center justify-center dot-grid">
        <AuroraGradient variant="hero" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-28 text-center">
          {/* Waveform */}
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex justify-center mb-8"
          >
            <WaveformVisualizer bars={32} playing height={48} color="#2DD4A8" />
          </motion.div>

          {/* Mono label */}
          <motion.p
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="font-[family-name:var(--font-mono)] text-xs tracking-[0.25em] uppercase text-accent mb-6"
          >
            KoeCode Arena
          </motion.p>

          {/* Display heading */}
          <motion.h1
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1] text-text-primary max-w-4xl mx-auto mb-6"
          >
            The first arena that evaluates voice AI the way you actually experience it.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-text-body text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Blind head-to-head battles. Human judges. Real-world scenarios. Compare voice
            models, agents, and pipelines on the metrics that actually matter.
          </motion.p>

          {/* CTA button */}
          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Link
              to="/battle"
              className="group inline-flex items-center gap-2.5 bg-accent text-bg-primary font-semibold px-7 py-3.5 rounded-lg text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(45,212,168,0.3)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Mic className="h-4 w-4" />
              Enter the Arena
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
          >
            {[
              { value: arenaStats.totalBattles, label: 'Battles' },
              { value: models.length + agents.length, label: 'Models' },
              { value: agents.length, label: 'Agents' },
              { value: scenarios.length, label: 'Scenarios' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-[family-name:var(--font-mono)] text-2xl sm:text-3xl text-text-primary font-medium">
                  {formatNumber(stat.value)}
                </p>
                <p className="text-text-faint text-xs uppercase tracking-wider mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 2. THREE TIER CARDS                                              */}
      {/* ================================================================ */}
      <AnimatedSection className="max-w-6xl mx-auto px-6 py-24">
        <motion.div variants={staggerChild}>
          <p className="font-[family-name:var(--font-mono)] text-xs tracking-[0.25em] uppercase text-accent text-center mb-3">
            Three Evaluation Tiers
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-text-primary text-center mb-16">
            Every layer of the voice stack, tested.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tierCards.map((card) => (
            <motion.div
              key={card.title}
              variants={staggerChild}
              className="group relative bg-bg-surface border border-border-default rounded-xl p-8 dot-border-top transition-all duration-300 hover:border-border-strong"
            >
              <div className="h-10 w-10 rounded-lg bg-bg-hover border border-border-default flex items-center justify-center mb-5">
                <card.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-text-primary text-lg font-semibold mb-3">
                {card.title}
              </h3>
              <p className="text-text-body text-sm leading-relaxed mb-6">
                {card.description}
              </p>
              <Link
                to={card.link}
                className="inline-flex items-center gap-1.5 text-accent text-sm font-medium transition-all duration-200 group-hover:gap-2.5"
              >
                {card.linkLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>

      {/* ================================================================ */}
      {/* 3. LIVE STATS BAR                                                */}
      {/* ================================================================ */}
      <AnimatedSection className="bg-bg-surface border-y border-border-default">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-border-default">
            {[
              { icon: Swords, value: arenaStats.totalBattles, label: 'Total Battles' },
              { icon: Trophy, value: arenaStats.totalModels, label: 'Models Ranked' },
              { icon: Users, value: arenaStats.totalAgents, label: 'Agents Ranked' },
              { icon: BarChart3, value: arenaStats.totalScenarios, label: 'Active Scenarios' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={staggerChild}
                className="flex flex-col items-center text-center md:px-8"
              >
                <stat.icon className="h-5 w-5 text-text-faint mb-3" />
                <p className="font-[family-name:var(--font-mono)] text-3xl sm:text-4xl font-medium text-text-primary">
                  {formatNumber(stat.value)}
                </p>
                <p className="text-text-faint text-xs uppercase tracking-wider mt-2">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ================================================================ */}
      {/* 4. RECENT BATTLE FEED                                            */}
      {/* ================================================================ */}
      <AnimatedSection className="max-w-6xl mx-auto px-6 py-24">
        <motion.div variants={staggerChild} className="flex items-center gap-3 mb-10">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              style={{ animation: 'pulse-live 2s ease-in-out infinite' }}
            />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-text-primary">
            Live Battle Feed
          </h2>
        </motion.div>

        <div className="space-y-3">
          {recentBattles.map((battle) => {
            const winnerName =
              battle.winner === 'a'
                ? battle.modelA
                : battle.winner === 'b'
                  ? battle.modelB
                  : null
            const loserName =
              battle.winner === 'a'
                ? battle.modelB
                : battle.winner === 'b'
                  ? battle.modelA
                  : null
            const isTie = battle.winner === 'tie'

            return (
              <motion.div
                key={battle.id}
                variants={staggerChild}
                className="group flex items-start gap-4 bg-bg-surface border border-border-default rounded-xl px-5 py-4 transition-all duration-200 hover:border-border-strong hover:bg-bg-hover"
              >
                {/* Tier icon */}
                <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-lg bg-bg-hover border border-border-default flex items-center justify-center">
                  {tierIcon(battle.tier)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-relaxed">
                    {isTie ? (
                      <>
                        <span className="text-text-primary font-medium">{battle.modelA}</span>
                        <span className="inline-flex items-center gap-1 text-text-faint">
                          <Equal className="h-3 w-3" />
                          tied
                        </span>
                        <span className="text-text-primary font-medium">{battle.modelB}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-accent font-medium">{winnerName}</span>
                        <span className="text-text-faint">beat</span>
                        <span className="text-text-body">{loserName}</span>
                      </>
                    )}
                    <span className="text-text-faint">in</span>
                    <span className="text-text-body font-medium">{battle.category}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-text-faint bg-bg-hover border border-border-default rounded px-1.5 py-0.5">
                      {tierIcon(battle.tier)}
                      {tierLabel(battle.tier)}
                    </span>
                    {isTie && (
                      <span className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-text-faint bg-bg-hover border border-border-default rounded px-1.5 py-0.5">
                        Draw
                      </span>
                    )}
                    {!isTie && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-accent/70">
                        <Zap className="h-3 w-3" />
                        Win
                      </span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <span className="flex-shrink-0 text-text-faint text-xs font-[family-name:var(--font-mono)] mt-1">
                  {battle.timeAgo}
                </span>
              </motion.div>
            )
          })}
        </div>
      </AnimatedSection>

      {/* ================================================================ */}
      {/* 5. BOTTOM CTA                                                    */}
      {/* ================================================================ */}
      <section className="relative py-28 overflow-hidden">
        <AuroraGradient variant="section" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="font-[family-name:var(--font-mono)] text-xs tracking-[0.25em] uppercase text-accent mb-4"
          >
            Your Vote Shapes the Leaderboard
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl md:text-6xl text-text-primary mb-6"
          >
            Ready to judge?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-text-body text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Listen to two voice outputs side by side. Pick the one that sounds better. It
            takes 30 seconds and helps the entire voice AI community.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link
              to="/battle"
              className="group inline-flex items-center gap-2.5 bg-accent text-bg-primary font-semibold px-8 py-4 rounded-lg text-base transition-all duration-300 hover:shadow-[0_0_40px_rgba(45,212,168,0.3)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Swords className="h-5 w-5" />
              Start a Battle
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
