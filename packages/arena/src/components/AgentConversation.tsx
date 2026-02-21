import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'
import WaveformVisualizer from './WaveformVisualizer'
import type { AgentConversationEnd } from '../api/client'

interface AgentConversationProps {
  wsUrl: string
  label: string
  color: string
  maxDuration: number
  onConversationEnd: (data: AgentConversationEnd) => void
  onError: (error: string) => void
}

type ConvState = 'connecting' | 'active' | 'ending' | 'ended'

export default function AgentConversation({
  wsUrl,
  label,
  color,
  maxDuration,
  onConversationEnd,
  onError,
}: AgentConversationProps) {
  const [state, setState] = useState<ConvState>('connecting')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([])
  const [isMuted, setIsMuted] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playbackQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const isMutedRef = useRef(false)

  // Keep muted ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const endConversation = useCallback(() => {
    if (state === 'ending' || state === 'ended') return
    setState('ending')
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_conversation' }))
    }
  }, [state])

  // Play agent audio from queue
  const playNextChunk = useCallback(() => {
    if (!audioContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false
      return
    }
    isPlayingRef.current = true
    const samples = playbackQueueRef.current.shift()!
    const buffer = audioContextRef.current.createBuffer(1, samples.length, 16000)
    buffer.copyToChannel(new Float32Array(samples.buffer.slice(0) as ArrayBuffer), 0)
    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(audioContextRef.current.destination)
    source.onended = () => playNextChunk()
    source.start()
  }, [])

  // Initialize WebSocket + audio
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Get mic access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
        })
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream

        // Create AudioContext
        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx

        // Connect mic to ScriptProcessorNode for raw PCM capture
        const source = ctx.createMediaStreamSource(stream)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
          const inputData = e.inputBuffer.getChannelData(0)
          // Convert float32 to int16
          const int16 = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          wsRef.current.send(int16.buffer)
        }
        source.connect(processor)
        processor.connect(ctx.destination) // Required for ScriptProcessor to work

        // Open WebSocket
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        ws.binaryType = 'arraybuffer'

        ws.onopen = () => {
          if (!mounted) return
          setState('active')
          // Start elapsed timer
          timerRef.current = setInterval(() => {
            setElapsedMs((prev) => {
              const next = prev + 100
              if (next >= maxDuration * 1000) {
                endConversation()
              }
              return next
            })
          }, 100)
        }

        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Agent audio — PCM16 bytes
            const int16 = new Int16Array(event.data)
            const float32 = new Float32Array(int16.length)
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 0x8000
            }
            playbackQueueRef.current.push(float32)
            if (!isPlayingRef.current) playNextChunk()
          } else {
            // JSON control message
            try {
              const msg = JSON.parse(event.data)
              if (msg.type === 'session_started') {
                // Session confirmed
              } else if (msg.type === 'transcript') {
                setTranscript((prev) => [...prev, { role: msg.role, text: msg.text }])
              } else if (msg.type === 'clear') {
                // Interrupt — clear playback queue
                playbackQueueRef.current = []
              } else if (msg.type === 'conversation_ended') {
                setState('ended')
                cleanup()
                onConversationEnd(msg as AgentConversationEnd)
              } else if (msg.type === 'timeout') {
                setState('ended')
                cleanup()
                onConversationEnd({
                  type: 'conversation_ended',
                  conversation_id: '',
                  total_turns: transcript.length,
                  duration_seconds: elapsedMs / 1000,
                  transcript,
                })
              } else if (msg.type === 'error') {
                onError(msg.message || 'Connection error')
                cleanup()
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        ws.onerror = () => {
          if (mounted) onError('WebSocket connection failed')
        }

        ws.onclose = () => {
          if (mounted && state !== 'ended') {
            setState('ended')
            cleanup()
          }
        }
      } catch (e) {
        if (mounted) {
          onError(e instanceof Error ? e.message : 'Failed to access microphone')
        }
      }
    }

    init()

    return () => {
      mounted = false
      cleanup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000)
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins}:${rem.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden"
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: `2px solid ${color}30` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-text-primary">{label}</span>
          {state === 'connecting' && (
            <Loader2 size={14} className="animate-spin text-text-faint" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-[family-name:var(--font-mono)] text-text-faint">
            {formatTime(elapsedMs)}
          </span>
          {state === 'active' && (
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-accent uppercase tracking-wider animate-pulse">
              Live
            </span>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div className="px-5 py-4 flex justify-center">
        <WaveformVisualizer
          playing={state === 'active'}
          color={color}
          height={50}
          bars={32}
        />
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="px-5 max-h-[200px] overflow-y-auto space-y-2"
      >
        {transcript.map((turn, i) => (
          <div key={i} className="flex gap-2">
            <span
              className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider shrink-0 mt-0.5"
              style={{ color: turn.role === 'agent' ? color : '#888899' }}
            >
              {turn.role === 'agent' ? 'Agent' : 'You'}
            </span>
            <p className="text-xs text-text-body leading-relaxed">{turn.text}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
            isMuted
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-bg-primary text-text-body border border-border-default hover:border-border-strong'
          }`}
          disabled={state !== 'active'}
        >
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          onClick={endConversation}
          disabled={state !== 'active'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-40"
        >
          <PhoneOff size={14} />
          End Conversation
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-primary">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${Math.min((elapsedMs / (maxDuration * 1000)) * 100, 100)}%`,
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      </div>
    </motion.div>
  )
}
