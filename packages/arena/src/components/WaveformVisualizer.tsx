import { motion } from 'framer-motion'

interface WaveformVisualizerProps {
  bars?: number
  playing?: boolean
  color?: string
  height?: number
  className?: string
}

export default function WaveformVisualizer({
  bars = 24,
  playing = false,
  color = '#2DD4A8',
  height = 40,
  className = '',
}: WaveformVisualizerProps) {
  return (
    <div
      className={`flex items-center justify-center gap-[2px] ${className}`}
      style={{ height }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const baseHeight = Math.sin((i / bars) * Math.PI) * 0.7 + 0.3
        const delay = (i / bars) * 0.8

        return playing ? (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: Math.max(2, 3 - bars / 20),
              backgroundColor: color,
              opacity: 0.8,
            }}
            animate={{
              height: [
                height * baseHeight * 0.3,
                height * baseHeight,
                height * baseHeight * 0.5,
                height * baseHeight * 0.9,
                height * baseHeight * 0.3,
              ],
            }}
            transition={{
              duration: 1.2 + Math.random() * 0.4,
              repeat: Infinity,
              delay,
              ease: 'easeInOut',
            }}
          />
        ) : (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: Math.max(2, 3 - bars / 20),
              height: height * baseHeight * 0.3,
              backgroundColor: color,
              opacity: 0.3,
            }}
          />
        )
      })}
    </div>
  )
}

// Compact inline waveform for cards and lists
export function WaveformInline({
  playing = false,
  color = '#2DD4A8',
}: {
  playing?: boolean
  color?: string
}) {
  return (
    <WaveformVisualizer
      bars={8}
      playing={playing}
      color={color}
      height={16}
    />
  )
}
