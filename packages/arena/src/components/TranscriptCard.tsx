import { motion } from 'framer-motion'

interface DiffItem {
  word: string | null
  ref_word: string | null
  type: 'correct' | 'insertion' | 'deletion' | 'substitution'
}

interface TranscriptCardProps {
  label: string
  color: string
  transcript: string
  wordCount: number
  latencyMs: number
  revealed: boolean
  provider?: string
  modelName?: string
  wer?: number | null
  cer?: number | null
  diff?: DiffItem[] | null
}

export default function TranscriptCard({
  label,
  color,
  transcript,
  wordCount,
  latencyMs,
  revealed,
  provider,
  modelName,
  wer,
  cer,
  diff,
}: TranscriptCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border-default bg-bg-secondary p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-text-primary">
            {label}
          </span>
          {revealed && modelName && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-text-body"
            >
              {modelName}
            </motion.span>
          )}
        </div>
        {revealed && provider && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider bg-bg-tertiary px-2 py-0.5 rounded"
          >
            {provider}
          </motion.span>
        )}
      </div>

      {/* Transcript text */}
      <div className="min-h-[100px] max-h-[200px] overflow-y-auto mb-3 scrollbar-thin">
        {revealed && diff ? (
          <p className="font-[family-name:var(--font-mono)] text-sm leading-relaxed text-text-body">
            {diff.map((item, i) => {
              if (item.type === 'correct') {
                return <span key={i}>{item.word} </span>
              }
              if (item.type === 'insertion') {
                return (
                  <span key={i} className="bg-emerald-500/20 text-emerald-400 rounded px-0.5">
                    {item.word}{' '}
                  </span>
                )
              }
              if (item.type === 'deletion') {
                return (
                  <span key={i} className="bg-red-500/20 text-red-400 line-through rounded px-0.5">
                    {item.ref_word}{' '}
                  </span>
                )
              }
              if (item.type === 'substitution') {
                return (
                  <span key={i} className="bg-amber-500/20 text-amber-400 rounded px-0.5" title={`Expected: ${item.ref_word}`}>
                    {item.word}{' '}
                  </span>
                )
              }
              return null
            })}
          </p>
        ) : (
          <p className="font-[family-name:var(--font-mono)] text-sm leading-relaxed text-text-body">
            {transcript}
          </p>
        )}
      </div>

      {/* Metrics footer */}
      <div className="flex items-center gap-3 text-[10px] font-[family-name:var(--font-mono)] text-text-faint">
        <span>{wordCount} words</span>
        <span>{(latencyMs / 1000).toFixed(1)}s</span>
        {revealed && wer != null && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`px-1.5 py-0.5 rounded ${wer < 0.05 ? 'bg-emerald-500/20 text-emerald-400' : wer < 0.15 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}
          >
            WER: {(wer * 100).toFixed(1)}%
          </motion.span>
        )}
        {revealed && cer != null && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-text-faint"
          >
            CER: {(cer * 100).toFixed(1)}%
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}
