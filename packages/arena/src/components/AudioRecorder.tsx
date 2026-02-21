import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, AlertCircle } from 'lucide-react'
import WaveformVisualizer from './WaveformVisualizer'

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, durationMs: number) => void
  maxDurationMs?: number
  disabled?: boolean
}

export default function AudioRecorder({
  onRecordingComplete,
  maxDurationMs = 15000,
  disabled = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    setPermissionError(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size > 0) {
          onRecordingComplete(blob, duration)
        }
      }

      startTimeRef.current = Date.now()
      recorder.start(100)
      setIsRecording(true)
      setElapsedMs(0)

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current
        setElapsedMs(elapsed)
        if (elapsed >= maxDurationMs) {
          stopRecording()
        }
      }, 100)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermissionError('Microphone access denied. Please allow microphone access in your browser settings.')
      } else {
        setPermissionError('Could not access microphone. Please check your device settings.')
      }
    }
  }, [maxDurationMs, onRecordingComplete, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  function handleToggle() {
    if (disabled) return
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const tenths = Math.floor((ms % 1000) / 100)
    return `${seconds}.${tenths}s`
  }

  const progressRatio = elapsedMs / maxDurationMs

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Permission error */}
      <AnimatePresence>
        {permissionError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
          >
            <AlertCircle size={14} />
            <span>{permissionError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform visualizer */}
      <div className="w-full h-12">
        <WaveformVisualizer
          bars={24}
          playing={isRecording}
          color={isRecording ? '#ef4444' : '#888899'}
          height={48}
          className="w-full"
        />
      </div>

      {/* Record button */}
      <motion.button
        whileHover={!disabled ? { scale: 1.06 } : {}}
        whileTap={!disabled ? { scale: 0.94 } : {}}
        onClick={handleToggle}
        disabled={disabled}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-border-default'
            : isRecording
              ? 'border-red-500 bg-red-500/15 cursor-pointer'
              : 'border-accent/50 bg-accent/10 hover:bg-accent/15 cursor-pointer'
        }`}
      >
        {/* Pulse animation when recording */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-500/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {isRecording ? (
          <Square size={20} className="text-red-400" />
        ) : (
          <Mic size={22} className="text-accent" />
        )}
      </motion.button>

      {/* Timer / Instructions */}
      <div className="text-center">
        {isRecording ? (
          <div className="flex flex-col items-center gap-1">
            <span className="font-[family-name:var(--font-mono)] text-sm text-red-400">
              {formatTime(elapsedMs)}
            </span>
            {/* Progress bar */}
            <div className="w-32 h-1 rounded-full bg-bg-hover overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-red-400"
                animate={{ width: `${progressRatio * 100}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
            <span className="text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
              Release or tap to stop
            </span>
          </div>
        ) : (
          <span className="text-xs text-text-faint font-[family-name:var(--font-mono)]">
            Tap to record (max {maxDurationMs / 1000}s)
          </span>
        )}
      </div>
    </div>
  )
}
