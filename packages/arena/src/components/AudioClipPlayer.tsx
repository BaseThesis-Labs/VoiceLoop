import { useState, useRef, useEffect } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import WaveformVisualizer from './WaveformVisualizer'

interface AudioClipPlayerProps {
  audioUrl: string
  color?: string
}

export default function AudioClipPlayer({ audioUrl, color = '#2DD4A8' }: AudioClipPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [loop, setLoop] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
    }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => {
      if (!loop) setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [loop])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
  }

  function cycleSpeed() {
    const speeds = [0.5, 1, 1.5]
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length]
    setPlaybackRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <audio ref={audioRef} src={audioUrl} preload="auto" loop={loop} />
      <div className="flex items-center gap-3">
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-colors"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        {/* Waveform / progress */}
        <div className="flex-1">
          <WaveformVisualizer playing={isPlaying} color={color} height={32} bars={32} />
          <div
            className="h-1 bg-border-default rounded-full mt-1 cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Time */}
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint min-w-[60px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          className="text-[10px] font-[family-name:var(--font-mono)] text-text-faint hover:text-text-body px-1.5 py-0.5 rounded border border-border-default"
        >
          {playbackRate}x
        </button>

        {/* Loop */}
        <button
          onClick={() => setLoop(!loop)}
          className={`p-1 rounded ${loop ? 'text-accent' : 'text-text-faint hover:text-text-body'}`}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )
}
