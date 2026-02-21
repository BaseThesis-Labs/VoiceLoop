import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Check } from 'lucide-react'
import AudioRecorder from './AudioRecorder'

export interface CuratedPrompt {
  id: string
  text: string
  category: string
  audio_url: string
  duration_seconds: number | null
}

interface S2SInputPanelProps {
  curatedPrompts: CuratedPrompt[]
  onSubmitAudio: (audio: Blob | null, curatedPromptId: string | null) => void
  disabled?: boolean
}

type InputTab = 'record' | 'curated'

export default function S2SInputPanel({
  curatedPrompts,
  onSubmitAudio,
  disabled = false,
}: S2SInputPanelProps) {
  const [activeTab, setActiveTab] = useState<InputTab>('record')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null)

  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordedUrlRef = useRef<string | null>(null)
  const [recordingPlaying, setRecordingPlaying] = useState(false)

  function handleRecordingComplete(blob: Blob, durationMs: number) {
    // Revoke previous URL
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current)
    }
    const url = URL.createObjectURL(blob)
    recordedUrlRef.current = url
    setRecordedBlob(blob)
    setRecordedDuration(durationMs)
  }

  function handleSubmitRecording() {
    if (recordedBlob) {
      onSubmitAudio(recordedBlob, null)
    }
  }

  function handleSubmitCurated() {
    if (selectedPromptId) {
      onSubmitAudio(null, selectedPromptId)
    }
  }

  function togglePreview(promptId: string, audioUrl: string) {
    if (previewPlaying === promptId) {
      previewAudioRef.current?.pause()
      setPreviewPlaying(null)
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.src = audioUrl
        previewAudioRef.current.play()
        setPreviewPlaying(promptId)
      }
    }
  }

  function toggleRecordingPreview() {
    if (!recordedUrlRef.current) return
    if (recordingPlaying) {
      recordedAudioRef.current?.pause()
      setRecordingPlaying(false)
    } else {
      if (!recordedAudioRef.current) {
        recordedAudioRef.current = new Audio(recordedUrlRef.current)
        recordedAudioRef.current.onended = () => setRecordingPlaying(false)
      } else {
        recordedAudioRef.current.src = recordedUrlRef.current
      }
      recordedAudioRef.current.play()
      setRecordingPlaying(true)
    }
  }

  // Group curated prompts by category
  const byCategory: Record<string, CuratedPrompt[]> = {}
  for (const p of curatedPrompts) {
    ;(byCategory[p.category] ??= []).push(p)
  }

  return (
    <div className="bg-bg-surface rounded-xl border border-border-default p-6">
      {/* Hidden audio for curated preview */}
      <audio
        ref={previewAudioRef}
        preload="none"
        onEnded={() => setPreviewPlaying(null)}
      />

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 p-1 bg-bg-hover rounded-lg">
        {(['record', 'curated'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab
                ? 'bg-bg-surface text-accent border-b-2 border-accent shadow-sm'
                : 'text-text-faint hover:text-text-body'
            }`}
          >
            {tab === 'record' ? 'Speak your own' : 'Use a curated prompt'}
          </button>
        ))}
      </div>

      {/* Record tab */}
      {activeTab === 'record' && (
        <div className="flex flex-col items-center gap-4">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDurationMs={15000}
            disabled={disabled}
          />

          {/* Post-recording preview */}
          {recordedBlob && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-hover border border-border-default w-full max-w-sm"
            >
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleRecordingPreview}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-accent/30 bg-accent/10"
              >
                {recordingPlaying ? (
                  <Pause size={14} className="text-accent" />
                ) : (
                  <Play size={14} className="text-accent ml-0.5" />
                )}
              </motion.button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-body truncate">Your recording</p>
                <p className="text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
                  {(recordedDuration / 1000).toFixed(1)}s
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleSubmitRecording}
                disabled={disabled}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors disabled:opacity-40"
              >
                Submit
              </motion.button>
            </motion.div>
          )}
        </div>
      )}

      {/* Curated prompts tab */}
      {activeTab === 'curated' && (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([category, prompts]) => (
            <div key={category}>
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-text-faint mb-2">
                {category}
              </p>
              <div className="space-y-2">
                {prompts.map((prompt) => {
                  const isSelected = selectedPromptId === prompt.id
                  return (
                    <motion.button
                      key={prompt.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedPromptId(isSelected ? null : prompt.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-accent/40 bg-accent/5'
                          : 'border-border-default bg-bg-hover/50 hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Play preview */}
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePreview(prompt.id, prompt.audio_url)
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center border border-border-default bg-bg-surface shrink-0 mt-0.5 cursor-pointer"
                        >
                          {previewPlaying === prompt.id ? (
                            <Pause size={12} className="text-text-body" />
                          ) : (
                            <Play size={12} className="text-text-body ml-0.5" />
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary leading-snug">{prompt.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-text-faint px-1.5 py-0.5 rounded bg-bg-hover">
                              {prompt.category}
                            </span>
                            {prompt.duration_seconds && (
                              <span className="text-[11px] font-[family-name:var(--font-mono)] text-text-faint">
                                {prompt.duration_seconds.toFixed(1)}s
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={16} className="text-accent shrink-0 mt-1" />
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Submit button */}
          {selectedPromptId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center pt-2"
            >
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleSubmitCurated}
                disabled={disabled}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors disabled:opacity-40"
              >
                Use this prompt
              </motion.button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
