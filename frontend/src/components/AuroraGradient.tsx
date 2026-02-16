interface AuroraGradientProps {
  className?: string;
  variant?: 'hero' | 'section' | 'card';
}

export default function AuroraGradient({
  className = '',
  variant = 'hero',
}: AuroraGradientProps) {
  if (variant === 'hero') {
    return (
      <div
        className={`relative w-full h-[400px] pointer-events-none ${className}`}
        aria-hidden="true"
      >
        {/* Layer 1 — Primary teal wash, large ellipse */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 50% 60%, rgba(45, 212, 168, 0.18), transparent 70%)',
            animation: 'aurora-pulse 8s ease-in-out infinite',
          }}
        />

        {/* Layer 2 — Emerald shift, offset right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 45% at 70% 50%, rgba(52, 211, 153, 0.14), transparent 65%)',
            animation: 'aurora-drift 12s ease-in-out infinite',
          }}
        />

        {/* Layer 3 — Cyan accent, offset left */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 30% 45%, rgba(6, 182, 212, 0.12), transparent 60%)',
            animation: 'aurora-pulse 8s ease-in-out infinite 2s',
          }}
        />

        {/* Layer 4 — Dark green grounding, wide and low */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 30% at 50% 85%, rgba(10, 61, 46, 0.25), transparent 70%)',
            animation: 'aurora-drift 12s ease-in-out infinite 4s',
          }}
        />

        {/* Layer 5 — Waveform undulation, very wide flattened ellipse */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 120% 18% at 50% 70%, rgba(45, 212, 168, 0.1), transparent 60%)',
            animation: 'aurora-pulse 8s ease-in-out infinite 4s',
          }}
        />

        {/* Soft blur overlay to blend layers */}
        <div
          className="absolute inset-0 backdrop-blur-[1px]"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 55%, rgba(45, 212, 168, 0.04), transparent 70%)',
          }}
        />
      </div>
    );
  }

  if (variant === 'section') {
    return (
      <div
        className={`relative w-full h-[200px] pointer-events-none ${className}`}
        aria-hidden="true"
      >
        {/* Layer 1 — Teal ambient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 55%, rgba(45, 212, 168, 0.1), transparent 65%)',
            animation: 'aurora-pulse 8s ease-in-out infinite',
          }}
        />

        {/* Layer 2 — Cyan secondary */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 40% at 60% 50%, rgba(6, 182, 212, 0.07), transparent 60%)',
            animation: 'aurora-drift 12s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  // Card variant
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Compact teal glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(45, 212, 168, 0.12), transparent 70%)',
          animation: 'aurora-pulse 8s ease-in-out infinite',
        }}
      />

      {/* Subtle emerald accent */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 65% 55%, rgba(52, 211, 153, 0.08), transparent 60%)',
          animation: 'aurora-drift 12s ease-in-out infinite',
        }}
      />
    </div>
  );
}
