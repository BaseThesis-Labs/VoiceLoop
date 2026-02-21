import { motion } from 'framer-motion'

export type BattleMode = 'tts' | 's2s' | 'stt' | 'agent'

interface ModeOption {
  key: BattleMode
  label: string
  icon: string
  subtitle: string
  enabled: boolean
}

const MODES: ModeOption[] = [
  {
    key: 'tts',
    label: 'TTS',
    icon: '🔊',
    subtitle: 'Compare how different models speak the same text',
    enabled: true,
  },
  {
    key: 's2s',
    label: 'S2S',
    icon: '🔄',
    subtitle: 'Speak to models and compare their spoken responses',
    enabled: true,
  },
  {
    key: 'stt',
    label: 'STT',
    icon: '🎤',
    subtitle: 'Compare how different models transcribe the same audio',
    enabled: false,
  },
  {
    key: 'agent',
    label: 'Agent',
    icon: '🤖',
    subtitle: 'Have a conversation with two agents and judge who handles it better',
    enabled: false,
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
  const activeMode = MODES.find((m) => m.key === active) ?? MODES[0]

  function handleSelect(mode: BattleMode) {
    localStorage.setItem(STORAGE_KEY, mode)
    onChange(mode)
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {MODES.map((mode) => {
          const isActive = active === mode.key
          return (
            <button
              key={mode.key}
              onClick={() => mode.enabled && handleSelect(mode.key)}
              disabled={!mode.enabled}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                isActive
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : mode.enabled
                    ? 'text-text-body border-border-default hover:text-text-primary hover:border-border-strong cursor-pointer'
                    : 'text-text-faint border-border-default opacity-40 cursor-not-allowed'
              }`}
            >
              <span>{mode.icon}</span>
              <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.1em]">
                {mode.label}
              </span>
              {!mode.enabled && (
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint">
                  soon
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="mode-indicator"
                  className="absolute inset-0 rounded-lg border border-accent/30"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>
      <p className="text-text-faint text-xs font-[family-name:var(--font-mono)] mt-2">
        {activeMode.subtitle}
      </p>
    </div>
  )
}
