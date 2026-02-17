import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Send,
  Play,
  Pause,
  RotateCcw,
  Search,
  Radio,
  Keyboard,
  BarChart3,
  Waves,
} from 'lucide-react'
import { models } from '../data/mockData'
import WaveformVisualizer from '../components/WaveformVisualizer'

// ---- Types ----
type Mode = 'voice' | 'tts' | 'metrics'
type PlaybackSpeed = 0.5 | 1 | 1.5 | 2

// ---- Constants ----
const MODE_TABS: { id: Mode; label: string; icon: typeof Mic }[] = [
  { id: 'voice', label: 'Voice Chat', icon: Mic },
  { id: 'tts', label: 'Text-to-Speech', icon: Keyboard },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
]

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 1, 1.5, 2]

const LIVE_METRICS = [
  { key: 'ttfb', label: 'TTFB', value: '180ms', isFast: true },
  { key: 'duration', label: 'Duration', value: '8.1s', isFast: false },
  { key: 'rtf', label: 'RTF', value: '0.23', isFast: false },
  { key: 'utmos', label: 'UTMOS', value: '4.21', isFast: false },
  { key: 'nisqa', label: 'NISQA', value: '4.05', isFast: false },
  { key: 'wer', label: 'WER', value: '3.2%', isFast: false },
]

const TYPE_LABELS: Record<string, string> = {
  tts: 'TTS',
  asr: 'ASR',
  s2s: 'S2S',
  agent: 'Agent',
  speech_llm: 'LLM',
}

const displayModels = models.slice(0, 6)

// ---- Fade animation variant ----
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

// ---- Component ----
export default function PlaygroundPage() {
  const [activeMode, setActiveMode] = useState<Mode>('tts')
  const [selectedModel, setSelectedModel] = useState(models[0].id)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputText, setInputText] = useState(
    'Welcome to Voice Loop Arena. The future of voice AI evaluation starts here.'
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const [showSpectrogram, setShowSpectrogram] = useState(false)

  const filteredModels = displayModels.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* ================================ */}
        {/* Page Header                      */}
        {/* ================================ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
          className="mb-10"
        >
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-text-primary mb-3">
            Playground
          </h1>
          <p className="text-text-body text-[15px] leading-relaxed">
            Test voice models in a sandbox — no competition, just exploration
          </p>
        </motion.div>

        {/* ================================ */}
        {/* Mode Tabs                        */}
        {/* ================================ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-2 mb-8 bg-bg-surface rounded-lg border border-border-default p-1.5"
        >
          {MODE_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeMode === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                  isActive
                    ? 'text-accent'
                    : 'text-text-body hover:text-text-primary'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mode-tab-bg"
                    className="absolute inset-0 rounded-md bg-accent/10 border border-accent/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            )
          })}
        </motion.div>

        {/* ================================ */}
        {/* Mode Content                     */}
        {/* ================================ */}
        <AnimatePresence mode="wait">
          {activeMode === 'tts' && (
            <motion.div key="tts" {...fadeIn} className="space-y-6">
              {/* ---- Model Selector ---- */}
              <ModelSelector
                models={filteredModels}
                selectedModel={selectedModel}
                onSelect={setSelectedModel}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              {/* ---- Input Section ---- */}
              <div className="bg-bg-surface rounded-xl border border-border-default p-6">
                <label className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint block mb-4">
                  Input
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type text to synthesize..."
                  rows={3}
                  className="w-full bg-bg-hover border border-border-default rounded-lg px-4 py-3 text-text-primary text-sm placeholder:text-text-faint/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all resize-none"
                />
                <div className="flex items-center justify-between mt-4">
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    className="w-10 h-10 rounded-lg border border-border-default bg-bg-hover flex items-center justify-center text-text-body hover:text-text-primary hover:border-border-strong transition-colors"
                  >
                    <Mic size={16} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 bg-accent text-bg-primary font-medium rounded-lg px-5 py-2.5 text-sm hover:brightness-110 transition-all"
                  >
                    <Send size={14} />
                    Generate
                  </motion.button>
                </div>
              </div>

              {/* ---- Output Section ---- */}
              <div className="bg-bg-surface rounded-xl border border-border-default p-6">
                <label className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint block mb-5">
                  Output
                </label>

                {/* Waveform */}
                <div className="mb-6">
                  <WaveformVisualizer
                    bars={32}
                    height={56}
                    playing={isPlaying}
                    className="w-full"
                  />
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-4">
                  {/* Play/Pause */}
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`relative w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                      isPlaying
                        ? 'border-accent bg-accent/10'
                        : 'border-border-strong bg-transparent hover:border-accent/40'
                    }`}
                  >
                    {isPlaying && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-accent"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    {isPlaying ? (
                      <Pause size={16} className="text-accent relative z-10" />
                    ) : (
                      <Play size={16} className="text-text-body ml-0.5 relative z-10" />
                    )}
                  </motion.button>

                  {/* Progress Bar */}
                  <div className="flex-1 min-w-0">
                    <div className="w-full h-1.5 rounded-full bg-bg-hover overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-accent"
                        initial={{ width: '0%' }}
                        animate={{ width: isPlaying ? '60%' : '40%' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  {/* Time */}
                  <span className="font-[family-name:var(--font-mono)] text-xs text-text-faint shrink-0">
                    3.4s / 8.1s
                  </span>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-default">
                  <div className="flex items-center gap-2">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-2.5 py-1 rounded-md text-xs font-[family-name:var(--font-mono)] transition-all ${
                          playbackSpeed === speed
                            ? 'bg-accent/10 text-accent border border-accent/20'
                            : 'text-text-faint hover:text-text-body border border-transparent'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94, rotate: -90 }}
                    onClick={() => setIsPlaying(false)}
                    className="flex items-center gap-1.5 text-xs text-text-faint hover:text-text-body transition-colors"
                  >
                    <RotateCcw size={13} />
                    Reset
                  </motion.button>
                </div>
              </div>

              {/* ---- Live Metrics Panel ---- */}
              <div className="bg-bg-surface rounded-xl border border-border-default p-6">
                <label className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint block mb-5">
                  Live Metrics
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {LIVE_METRICS.map((metric, i) => (
                    <motion.div
                      key={metric.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] as const }}
                      className="bg-bg-hover rounded-lg p-3"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {metric.isFast && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                        )}
                        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-text-faint">
                          {metric.label}
                        </span>
                      </div>
                      <p className="font-[family-name:var(--font-mono)] text-lg text-text-primary">
                        {metric.value}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ---- Spectrogram Toggle ---- */}
              <div>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setShowSpectrogram(!showSpectrogram)}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border-default bg-bg-surface hover:border-border-strong text-sm text-text-body hover:text-text-primary transition-all w-full"
                >
                  <Waves size={15} className="text-text-faint" />
                  <span>{showSpectrogram ? 'Hide' : 'Show'} Spectrogram</span>
                  <motion.span
                    animate={{ rotate: showSpectrogram ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="ml-auto text-text-faint"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3.5 5.25L7 8.75L10.5 5.25"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.span>
                </motion.button>

                <AnimatePresence>
                  {showSpectrogram && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 relative bg-bg-hover rounded-lg h-32 flex items-center justify-center overflow-hidden">
                        {/* Spectrogram gradient simulation */}
                        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent" />
                        <div className="absolute inset-0">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div
                              key={i}
                              className="absolute w-full"
                              style={{
                                top: `${10 + i * 12}%`,
                                height: '2px',
                                background: `linear-gradient(90deg, transparent 0%, rgba(45,212,168,${0.03 + Math.random() * 0.06}) ${20 + Math.random() * 30}%, rgba(45,212,168,${0.04 + Math.random() * 0.08}) ${50 + Math.random() * 20}%, transparent 100%)`,
                              }}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-accent/[0.03] via-accent/[0.07] to-transparent" />
                        <span className="relative z-10 font-[family-name:var(--font-mono)] text-xs text-text-faint">
                          Mel spectrogram visualization
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeMode === 'voice' && (
            <motion.div key="voice" {...fadeIn}>
              <div className="bg-bg-surface rounded-xl border border-border-default p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-hover border border-border-default flex items-center justify-center mx-auto mb-5">
                  <Radio size={24} className="text-accent" />
                </div>
                <h3 className="text-text-primary text-lg font-medium mb-2">
                  Voice Chat Mode
                </h3>
                <p className="text-text-body text-sm leading-relaxed max-w-md mx-auto mb-6">
                  Have a real-time voice conversation with a selected model.
                  Speak naturally and hear the model respond live.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center group"
                  >
                    <Mic
                      size={24}
                      className="text-accent group-hover:scale-110 transition-transform"
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-accent/20"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </motion.button>
                </div>
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-faint mt-5 uppercase tracking-widest">
                  Tap to start recording
                </p>
              </div>
            </motion.div>
          )}

          {activeMode === 'metrics' && (
            <motion.div key="metrics" {...fadeIn}>
              <div className="bg-bg-surface rounded-xl border border-border-default p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-hover border border-border-default flex items-center justify-center mx-auto mb-5">
                  <BarChart3 size={24} className="text-accent" />
                </div>
                <h3 className="text-text-primary text-lg font-medium mb-2">
                  Metrics Explorer
                </h3>
                <p className="text-text-body text-sm leading-relaxed max-w-md mx-auto mb-6">
                  Dive deep into model performance metrics. Compare UTMOS,
                  NISQA, WER, latency, and more across all models in one view.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                  {['UTMOS', 'NISQA', 'WER'].map((m, i) => (
                    <motion.div
                      key={m}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.08 }}
                      className="bg-bg-hover rounded-lg p-3 border border-border-default"
                    >
                      <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-faint uppercase tracking-wider mb-1">
                        {m}
                      </p>
                      <p className="font-[family-name:var(--font-mono)] text-lg text-text-primary">
                        {m === 'WER' ? '2.8%' : m === 'UTMOS' ? '4.34' : '4.18'}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-faint mt-6 uppercase tracking-widest">
                  Full metrics dashboard coming soon
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================================
// ModelSelector
// ============================================================
function ModelSelector({
  models: modelList,
  selectedModel,
  onSelect,
  searchQuery,
  onSearchChange,
}: {
  models: typeof models
  selectedModel: string
  onSelect: (id: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  return (
    <div className="bg-bg-surface rounded-xl border border-border-default p-6">
      <label className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-text-faint block mb-4">
        Select Model
      </label>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search models..."
          className="w-full bg-bg-hover border border-border-default rounded-lg pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-faint/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
        />
      </div>

      {/* Model Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {modelList.map((model) => {
          const isSelected = selectedModel === model.id
          return (
            <motion.button
              key={model.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(model.id)}
              className={`relative text-left rounded-lg p-3 border transition-all ${
                isSelected
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-border-default bg-bg-hover/50 hover:border-border-strong hover:bg-bg-hover'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'border-accent' : 'border-border-strong'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="w-2 h-2 rounded-full bg-accent"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium truncate ${
                        isSelected ? 'text-text-primary' : 'text-text-body'
                      }`}
                    >
                      {model.name}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider ${
                        isSelected
                          ? 'bg-accent/10 text-accent'
                          : 'bg-bg-hover text-text-faint'
                      }`}
                    >
                      {TYPE_LABELS[model.type] || model.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-text-faint mt-0.5">{model.provider}</p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {modelList.length === 0 && (
        <p className="text-center text-text-faint text-sm py-6">
          No models match your search
        </p>
      )}
    </div>
  )
}
