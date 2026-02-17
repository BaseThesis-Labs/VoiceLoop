interface AuroraGradientProps {
  variant?: 'hero' | 'section' | 'card'
  className?: string
}

export default function AuroraGradient({ variant = 'section', className = '' }: AuroraGradientProps) {
  if (variant === 'hero') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <div
          className="absolute top-[-30%] left-[10%] w-[600px] h-[400px] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(45,212,168,0.15) 0%, transparent 70%)',
            animation: 'aurora-pulse 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-[-20%] right-[5%] w-[500px] h-[350px] rounded-full blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
            animation: 'aurora-drift 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-[10%] left-[30%] w-[400px] h-[300px] rounded-full blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)',
            animation: 'aurora-pulse 10s ease-in-out infinite 2s',
          }}
        />
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <div
          className="absolute top-[-50%] left-[20%] w-[200px] h-[150px] rounded-full blur-[60px]"
          style={{
            background: 'radial-gradient(circle, rgba(45,212,168,0.12) 0%, transparent 70%)',
            animation: 'aurora-pulse 6s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div
        className="absolute top-[-40%] left-[15%] w-[500px] h-[200px] rounded-full blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(45,212,168,0.1) 0%, transparent 70%)',
          animation: 'aurora-pulse 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-[-30%] right-[10%] w-[400px] h-[180px] rounded-full blur-[80px]"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)',
          animation: 'aurora-drift 10s ease-in-out infinite',
        }}
      />
    </div>
  )
}
