import { motion } from 'framer-motion'

interface VoteButtonProps {
  label: string
  active: boolean
  color: string
  disabled: boolean
  onClick: () => void
}

export default function VoteButton({
  label,
  active,
  color,
  disabled,
  onClick,
}: VoteButtonProps) {
  const borderColor = active ? color : '#282A3A'
  const bgColor = active ? `${color}18` : 'transparent'

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.04 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
      }`}
      style={{
        borderColor,
        backgroundColor: bgColor,
        color: active ? color : '#888899',
      }}
    >
      {active && (
        <motion.div
          layoutId="vote-highlight"
          className="absolute inset-0 rounded-lg"
          style={{ boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}08` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </motion.button>
  )
}
