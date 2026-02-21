import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Volume2, AudioLines, Mic, Bot } from 'lucide-react'

export type BattleMode = 'tts' | 's2s' | 'stt' | 'agent'

interface ModeOption {
  key: BattleMode
  label: string
  icon: ReactNode
  subtitle: string
  enabled: boolean
}

const MODES: ModeOption[] = [
  {
    key: 'tts',
    label: 'TTS',
    icon: <Volume2 size={18} />,
    subtitle: 'Compare how different models speak the same text',
    enabled: true,
  },
  {
    key: 's2s',
    label: 'S2S',
    icon: <AudioLines size={18} />,
    subtitle: 'Speak to models and compare their spoken responses',
    enabled: true,
  },
  {
    key: 'stt',
    label: 'STT',
    icon: <Mic size={18} />,
    subtitle: 'Compare how different models transcribe the same audio',
    enabled: true,
  },
  {
    key: 'agent',
    label: 'Agent',
    icon: <Bot size={18} />,
    subtitle: 'Have a conversation with two agents and judge who handles it better',
    enabled: true,
  },
]

const STORAGE_KEY = 'arena-battle-mode'

export function getStoredMode(): BattleMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && MODES.some((m) => m.key === stored && m.enabled)) {
      return stored as BattleMode
    }
  } catch {}
  return 'tts'
}

export function ModeSelector({
  active,
  onChange,
}: {
  active: BattleMode
  onChange: (mode: BattleMode) => void
}) {
  function handleSelect(mode: BattleMode) {
    localStorage.setItem(STORAGE_KEY, mode)
    onChange(mode)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {MODES.map((mode) => {
        const isActive = active === mode.key
        return (
          <button
            key={mode.key}
            onClick={() => mode.enabled && handleSelect(mode.key)}
            disabled={!mode.enabled}
            className={`relative group text-left rounded-xl p-4 border transition-all duration-200 ${
              isActive
                ? 'bg-accent/8 border-accent/40 shadow-[0_0_20px_rgba(45,212,168,0.08)]'
                : mode.enabled
                  ? 'bg-white/[0.02] border-border-default hover:bg-white/[0.04] hover:border-border-strong cursor-pointer'
                  : 'bg-white/[0.01] border-border-default opacity-40 cursor-not-allowed'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 rounded-xl border border-accent/40 bg-accent/5"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : mode.enabled
                        ? 'bg-white/5 text-text-body group-hover:text-text-primary'
                        : 'bg-white/5 text-text-faint'
                  }`}
                >
                  {mode.icon}
                </div>
                {!mode.enabled && (
                  <span className="text-[9px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-text-faint bg-white/5 px-1.5 py-0.5 rounded">
                    soon
                  </span>
                )}
              </div>
              <span
                className={`block text-sm font-semibold font-[family-name:var(--font-mono)] uppercase tracking-[0.1em] mb-1 transition-colors ${
                  isActive ? 'text-accent' : mode.enabled ? 'text-text-primary' : 'text-text-faint'
                }`}
              >
                {mode.label}
              </span>
              <span className="block text-[11px] leading-relaxed text-text-faint">
                {mode.subtitle}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
