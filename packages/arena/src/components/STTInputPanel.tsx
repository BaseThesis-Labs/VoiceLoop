import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Check } from 'lucide-react'
import AudioRecorder from './AudioRecorder'

export interface AudioClip {
  id: string
  text: string
  category: string
  difficulty: string
  audio_url: string
  duration_seconds: number | null
}

interface STTInputPanelProps {
  curatedClips: AudioClip[]
  onSubmitAudio: (audio: Blob | null, curatedClipId: string | null) => void
  disabled?: boolean
}

type InputTab = 'record' | 'curated'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400',
  medium: 'bg-amber-500/20 text-amber-400',
  hard: 'bg-red-500/20 text-red-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  clean_speech: 'Clean Speech',
  noisy: 'Noisy Environment',
  accented: 'Accented Speech',
  fast_speech: 'Fast Speech',
  domain_jargon: 'Domain Jargon',
  numbers_entities: 'Numbers & Entities',
}

export default function STTInputPanel({
  curatedClips,
  onSubmitAudio,
  disabled = false,
}: STTInputPanelProps) {
  const [activeTab, setActiveTab] = useState<InputTab>('curated')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null)

  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordedUrlRef = useRef<string | null>(null)
  const [recordingPlaying, setRecordingPlaying] = useState(false)

  function handleRecordingComplete(blob: Blob, durationMs: number) {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current)
    }
    setRecordedBlob(blob)
    setRecordedDuration(durationMs)
    const url = URL.createObjectURL(blob)
    recordedUrlRef.current = url
  }

  function handleSubmitRecording() {
    if (recordedBlob) {
      onSubmitAudio(recordedBlob, null)
    }
  }

  function handleSubmitClip() {
    if (selectedClipId) {
      onSubmitAudio(null, selectedClipId)
    }
  }

  function togglePreview(clipId: string, audioUrl: string) {
    const audio = previewAudioRef.current
    if (!audio) return
    if (previewPlaying === clipId) {
      audio.pause()
      setPreviewPlaying(null)
    } else {
      audio.src = audioUrl
      audio.play()
      setPreviewPlaying(clipId)
    }
  }

  // Group clips by category
  const grouped = curatedClips.reduce<Record<string, AudioClip[]>>((acc, clip) => {
    acc[clip.category] = acc[clip.category] || []
    acc[clip.category].push(clip)
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <audio ref={previewAudioRef} onEnded={() => setPreviewPlaying(null)} />

      {/* Tabs */}
      <div className="flex border-b border-border-default">
        {(['curated', 'record'] as InputTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-[family-name:var(--font-mono)] transition-colors relative ${
              activeTab === tab
                ? 'text-accent'
                : 'text-text-faint hover:text-text-body'
            }`}
          >
            {tab === 'curated' ? 'Use a curated clip' : 'Record your own'}
            {activeTab === tab && (
              <motion.div
                layoutId="stt-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'record' ? (
          <div className="space-y-4">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              maxDurationMs={15000}
              disabled={disabled}
            />
            {recordedBlob && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!recordedAudioRef.current) {
                      recordedAudioRef.current = new Audio(recordedUrlRef.current!)
                      recordedAudioRef.current.onended = () => setRecordingPlaying(false)
                    }
                    if (recordingPlaying) {
                      recordedAudioRef.current.pause()
                      setRecordingPlaying(false)
                    } else {
                      recordedAudioRef.current.play()
                      setRecordingPlaying(true)
                    }
                  }}
                  className="text-text-faint hover:text-text-body"
                >
                  {recordingPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <span className="text-xs font-[family-name:var(--font-mono)] text-text-faint">
                  {(recordedDuration / 1000).toFixed(1)}s recorded
                </span>
                <button
                  onClick={handleSubmitRecording}
                  disabled={disabled}
                  className="ml-auto px-4 py-2 bg-accent text-bg-primary rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  Transcribe this
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin">
            {Object.entries(grouped).map(([category, clips]) => (
              <div key={category}>
                <h4 className="text-xs font-[family-name:var(--font-mono)] text-text-faint uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <div className="space-y-2">
                  {clips.map((clip) => {
                    const isSelected = selectedClipId === clip.id
                    return (
                      <button
                        key={clip.id}
                        onClick={() => setSelectedClipId(clip.id)}
                        disabled={disabled}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-accent/30 bg-accent/5'
                            : 'border-border-default hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-text-body leading-relaxed line-clamp-2">
                            {clip.text}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-[family-name:var(--font-mono)] px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[clip.difficulty] || ''}`}>
                              {clip.difficulty}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePreview(clip.id, clip.audio_url)
                              }}
                              className="text-text-faint hover:text-text-body"
                            >
                              {previewPlaying === clip.id ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                          </div>
                        </div>
                        {clip.duration_seconds && (
                          <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint mt-1 block">
                            {clip.duration_seconds.toFixed(1)}s
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {selectedClipId && (
              <div className="sticky bottom-0 pt-3 bg-bg-secondary">
                <button
                  onClick={handleSubmitClip}
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-accent text-bg-primary rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Check size={14} className="inline mr-2" />
                  Transcribe this clip
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
