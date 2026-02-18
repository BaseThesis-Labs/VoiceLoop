import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Volume2, RotateCcw } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

const PROMPT_TEXT =
  'Hi, I need to cancel my flight to Denver. My booking ref is AB1234. Can you help me with that?';
const RESPONSE_A =
  'Looking up your booking now. Found flight to Denver. Processing the cancellation for you.';
const RESPONSE_B =
  'Booking A B twelve thirty-four located. Cancellation confirmed. Refund is processing.';

const TYPING_SPEED = 32;
const VOICE_A_DURATION = 3000;
const VOICE_B_DURATION = 3200;

type Phase = 'idle' | 'typing' | 'voiceA' | 'voiceB' | 'results';

/* ── Light-card color tokens (for white bg cards on dark page) ──── */
const C = {
  cardBg: '#ffffff',
  cardBorder: '#e2e4ea',
  divider: '#eef0f4',
  surfaceMuted: '#f5f6f9',
  surfaceHover: '#edf0f5',
  textPrimary: '#1a1b2e',
  textSecondary: '#4a4b5c',
  textMuted: '#8b8d9e',
  textFaint: '#b0b2be',
  barTrack: '#e4e6ec',
  barA: '#c0c2cc',
  accent: '#0d9e7e',
  accentBg: '#e8faf4',
} as const;

/* ═══════════════════════════════════════════════════════════════════
   Speech helpers
   ═══════════════════════════════════════════════════════════════════ */

function speak(text: string, voiceIndex: number, volume = 0.35): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.rate = 1.05;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    if (voices[voiceIndex]) utterance.voice = voices[voiceIndex];
    speechSynthesis.speak(utterance);
  } catch {
    // silent fallback
  }
}

function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Count-up hook
   ═══════════════════════════════════════════════════════════════════ */

function useCountUp(target: number, decimals: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Number((eased * target).toFixed(decimals)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, decimals, duration]);
  return value;
}

/* ═══════════════════════════════════════════════════════════════════
   Waveform bars
   ═══════════════════════════════════════════════════════════════════ */

function WaveformBars({
  bars = 26,
  playing = false,
  color = '#2DD4A8',
  height = 28,
  progress = 0,
}: {
  bars?: number;
  playing?: boolean;
  color?: string;
  height?: number;
  progress?: number;
}) {
  return (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const baseH = Math.sin((i / bars) * Math.PI) * 0.65 + 0.35;
        const isPast = i / bars <= progress;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: 3,
              backgroundColor: color,
              opacity: playing ? (isPast ? 0.9 : 0.25) : 0.18,
            }}
            animate={
              playing
                ? {
                    height: [
                      height * baseH * 0.25,
                      height * baseH,
                      height * baseH * 0.45,
                      height * baseH * 0.85,
                      height * baseH * 0.25,
                    ],
                  }
                : { height: height * baseH * 0.25 }
            }
            transition={
              playing
                ? {
                    duration: 0.85 + Math.random() * 0.3,
                    repeat: Infinity,
                    delay: (i / bars) * 0.5,
                    ease: 'easeInOut',
                  }
                : { duration: 0.4 }
            }
          />
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Metric bar (phase-driven, light palette)
   ═══════════════════════════════════════════════════════════════════ */

function MetricBar({
  percent,
  variant,
  delay,
  active,
}: {
  percent: number;
  variant: 'a' | 'b';
  delay: number;
  active: boolean;
}) {
  return (
    <div
      className="h-[6px] rounded-full w-full overflow-hidden"
      style={{ backgroundColor: C.barTrack }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: variant === 'b' ? C.accent : C.barA }}
        initial={{ width: 0 }}
        animate={active ? { width: `${percent}%` } : { width: 0 }}
        transition={{ duration: 0.8, delay: active ? delay : 0, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Orchestrated showcase
   ═══════════════════════════════════════════════════════════════════ */

function AnimatedShowcase() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typedText, setTypedText] = useState('');
  const [voiceAProgress, setVoiceAProgress] = useState(0);
  const [voiceBProgress, setVoiceBProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef as React.RefObject<Element>, { margin: '-18%' });
  const hasTriggered = useRef(false);
  const isVisible = useRef(false);

  // Pre-load speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
      const h = () => speechSynthesis.getVoices();
      speechSynthesis.addEventListener('voiceschanged', h);
      return () => speechSynthesis.removeEventListener('voiceschanged', h);
    }
  }, []);

  useEffect(() => {
    isVisible.current = isInView;
    if (!isInView) stopSpeech();
  }, [isInView]);

  useEffect(() => {
    if (isInView && !hasTriggered.current && phase === 'idle') {
      hasTriggered.current = true;
      const t = setTimeout(() => setPhase('typing'), 500);
      return () => clearTimeout(t);
    }
  }, [isInView, phase]);

  /* ── Phase: typing ── */
  useEffect(() => {
    if (phase !== 'typing') return;
    let idx = 0;
    setTypedText('');
    const iv = setInterval(() => {
      idx++;
      setTypedText(PROMPT_TEXT.slice(0, idx));
      if (idx >= PROMPT_TEXT.length) {
        clearInterval(iv);
        const t = setTimeout(() => setPhase('voiceA'), 600);
        return () => clearTimeout(t);
      }
    }, TYPING_SPEED);
    return () => clearInterval(iv);
  }, [phase]);

  /* ── Phase: voiceA ── */
  useEffect(() => {
    if (phase !== 'voiceA') return;
    setVoiceAProgress(0);
    if (isVisible.current) speak(RESPONSE_A, 0);
    const start = performance.now();
    let raf: number;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = (now: number) => {
      const p = Math.min((now - start) / VOICE_A_DURATION, 1);
      setVoiceAProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else timeout = setTimeout(() => setPhase('voiceB'), 400);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); stopSpeech(); };
  }, [phase]);

  /* ── Phase: voiceB ── */
  useEffect(() => {
    if (phase !== 'voiceB') return;
    setVoiceBProgress(0);
    if (isVisible.current) speak(RESPONSE_B, 1);
    const start = performance.now();
    let raf: number;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = (now: number) => {
      const p = Math.min((now - start) / VOICE_B_DURATION, 1);
      setVoiceBProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else timeout = setTimeout(() => setPhase('results'), 800);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); stopSpeech(); };
  }, [phase]);

  const handleReplay = () => {
    stopSpeech();
    setPhase('idle');
    setTypedText('');
    setVoiceAProgress(0);
    setVoiceBProgress(0);
    hasTriggered.current = false;
    setTimeout(() => { hasTriggered.current = true; setPhase('typing'); }, 400);
  };

  const scoreA = useCountUp(78.2, 1, 1.8, phase === 'results');
  const scoreB = useCountUp(91.4, 1, 2.0, phase === 'results');

  const metricsA = [
    { label: 'Empathy', value: '0.72', percent: 72 },
    { label: 'Resolution', value: '0.85', percent: 85 },
    { label: 'Latency', value: '340ms', percent: 53 },
    { label: 'Escalations', value: '3', percent: 30 },
  ];
  const metricsB = [
    { label: 'Empathy', value: '0.89', percent: 89, winner: true },
    { label: 'Resolution', value: '0.91', percent: 91, winner: true },
    { label: 'Latency', value: '285ms', percent: 72, winner: true },
    { label: 'Escalations', value: '1', percent: 90, winner: true },
  ];

  const showResults = phase === 'results';
  const showVoiceA = phase === 'voiceA' || phase === 'voiceB';
  const showVoiceB = phase === 'voiceB';

  /* shared card wrapper classes */
  const cardClass =
    'rounded-3xl overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.28)]';

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-[640px]"
    >
      <AnimatePresence mode="wait">
        {/* ═══════════════════════════════════════════════════════════
           PROMPT TESTING CARD
           ═══════════════════════════════════════════════════════════ */}
        {!showResults ? (
          <motion.div
            key="prompt-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)', y: -8 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cardClass}
            style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-3.5"
              style={{ borderBottom: `1px solid ${C.divider}` }}
            >
              <div className="flex items-center gap-2.5">
                <Volume2 className="h-4 w-4" style={{ color: C.textMuted }} />
                <span
                  className="text-[12px] font-[family-name:var(--font-mono)] tracking-wide"
                  style={{ color: C.textMuted }}
                >
                  Prompt Testing
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: C.accent, animation: 'pulse-live 2s ease-in-out infinite' }}
                />
                <span
                  className="text-[11px] font-[family-name:var(--font-mono)] font-medium"
                  style={{ color: C.accent }}
                >
                  live
                </span>
              </div>
            </div>

            {/* Scenario prompt with typewriter */}
            <div className="px-7 pt-5 pb-4">
              <div
                className="rounded-xl px-5 py-4 min-h-[110px]"
                style={{ backgroundColor: C.surfaceMuted, border: `1px solid ${C.divider}` }}
              >
                <span
                  className="text-[10px] font-[family-name:var(--font-mono)] block mb-2 uppercase tracking-widest font-semibold"
                  style={{ color: C.textFaint }}
                >
                  Scenario
                </span>
                <p
                  className="text-[14px] leading-relaxed font-[family-name:var(--font-mono)]"
                  style={{ color: C.textSecondary }}
                >
                  {phase === 'idle' ? (
                    <span style={{ color: C.textFaint }}>Generating prompt...</span>
                  ) : (
                    <>
                      &ldquo;{typedText}
                      {phase === 'typing' && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                          style={{ color: C.accent }}
                        >
                          |
                        </motion.span>
                      )}
                      {typedText.length === PROMPT_TEXT.length && <>&rdquo;</>}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Voice A */}
            <AnimatePresence>
              {showVoiceA && (
                <motion.div
                  key="voice-a-row"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="px-7 overflow-hidden"
                >
                  <div
                    className="flex items-center gap-4 rounded-xl px-5 py-3.5 mb-1.5"
                    style={{ backgroundColor: C.surfaceMuted, border: `1px solid ${C.divider}` }}
                  >
                    <div
                      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300`}
                      style={{
                        backgroundColor: phase === 'voiceA' ? '#6366f1' : 'rgba(99,102,241,0.12)',
                        boxShadow: phase === 'voiceA' ? '0 0 20px rgba(99,102,241,0.35)' : 'none',
                      }}
                    >
                      {phase === 'voiceA' ? (
                        <motion.div className="flex gap-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {[0, 1, 2].map((j) => (
                            <motion.div
                              key={j}
                              className="w-[3px] rounded-full bg-white"
                              animate={{ height: [5, 14, 5] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15, ease: 'easeInOut' }}
                            />
                          ))}
                        </motion.div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#6366f1" className="ml-0.5">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <WaveformBars bars={28} playing={phase === 'voiceA'} color="#6366f1" height={28} progress={voiceAProgress} />
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="block text-[12px] font-[family-name:var(--font-mono)] font-medium" style={{ color: C.textPrimary }}>
                        Voice A
                      </span>
                      <span className="block text-[10px] font-[family-name:var(--font-mono)]" style={{ color: C.textMuted }}>
                        ElevenLabs v2
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-2 pb-3">
                    <span className="text-[10px] font-[family-name:var(--font-mono)]" style={{ color: C.textFaint }}>3.0s</span>
                    <span className="text-[10px]" style={{ color: C.textFaint }}>&middot;</span>
                    <span className="text-[10px] font-[family-name:var(--font-mono)]" style={{ color: C.textFaint }}>TTFB 180ms</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: C.barTrack }}>
                      <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${voiceAProgress * 100}%`, backgroundColor: 'rgba(99,102,241,0.5)' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice B */}
            <AnimatePresence>
              {showVoiceB && (
                <motion.div
                  key="voice-b-row"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="px-7 pb-5 overflow-hidden"
                >
                  <div
                    className="flex items-center gap-4 rounded-xl px-5 py-3.5 mb-1.5"
                    style={{ backgroundColor: C.surfaceMuted, border: `1px solid ${C.divider}` }}
                  >
                    <div
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                      style={{
                        backgroundColor: phase === 'voiceB' ? '#f59e0b' : 'rgba(245,158,11,0.12)',
                        boxShadow: phase === 'voiceB' ? '0 0 20px rgba(245,158,11,0.35)' : 'none',
                      }}
                    >
                      {phase === 'voiceB' ? (
                        <motion.div className="flex gap-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {[0, 1, 2].map((j) => (
                            <motion.div
                              key={j}
                              className="w-[3px] rounded-full bg-white"
                              animate={{ height: [5, 14, 5] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15, ease: 'easeInOut' }}
                            />
                          ))}
                        </motion.div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" className="ml-0.5">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <WaveformBars bars={28} playing={phase === 'voiceB'} color="#f59e0b" height={28} progress={voiceBProgress} />
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="block text-[12px] font-[family-name:var(--font-mono)] font-medium" style={{ color: C.textPrimary }}>
                        Voice B
                      </span>
                      <span className="block text-[10px] font-[family-name:var(--font-mono)]" style={{ color: C.textMuted }}>
                        PlayHT 3.0
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-2">
                    <span className="text-[10px] font-[family-name:var(--font-mono)]" style={{ color: C.textFaint }}>3.2s</span>
                    <span className="text-[10px]" style={{ color: C.textFaint }}>&middot;</span>
                    <span className="text-[10px] font-[family-name:var(--font-mono)]" style={{ color: C.textFaint }}>TTFB 220ms</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: C.barTrack }}>
                      <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${voiceBProgress * 100}%`, backgroundColor: 'rgba(245,158,11,0.5)' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showVoiceA && <div className="h-5" />}
          </motion.div>
        ) : (
          /* ═══════════════════════════════════════════════════════════
             ARENA MATCH #47 RESULTS CARD
             ═══════════════════════════════════════════════════════════ */
          <motion.div
            key="results-card"
            initial={{ opacity: 0, scale: 1.03, filter: 'blur(6px)', y: 8 }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cardClass}
            style={{
              backgroundColor: C.cardBg,
              border: `1px solid ${C.cardBorder}`,
              animation: 'float-gentle 6s ease-in-out infinite',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-3.5"
              style={{ borderBottom: `1px solid ${C.divider}` }}
            >
              <span
                className="text-[12px] font-[family-name:var(--font-mono)] tracking-wide"
                style={{ color: C.textMuted }}
              >
                Arena Match #47
              </span>
              <motion.span
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="rounded-full px-3 py-1 text-[11px] font-[family-name:var(--font-mono)] font-medium"
                style={{ color: C.accent, backgroundColor: C.accentBg }}
              >
                completed
              </motion.span>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-2">
              {/* Column A */}
              <div className="p-7" style={{ borderRight: `1px solid ${C.divider}` }}>
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="text-[13px] font-[family-name:var(--font-mono)] font-medium" style={{ color: C.textPrimary }}>
                    Agent A
                  </span>
                  <span
                    className="text-[10px] font-[family-name:var(--font-mono)] px-2 py-0.5 rounded"
                    style={{ color: C.textMuted, backgroundColor: C.surfaceMuted }}
                  >
                    v3.1
                  </span>
                </div>
                <div className="space-y-3.5">
                  {metricsA.map((m, i) => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-[family-name:var(--font-mono)]" style={{ color: C.textMuted }}>
                          {m.label}
                        </span>
                        <span className="text-[11px] font-[family-name:var(--font-mono)] font-medium" style={{ color: C.textSecondary }}>
                          {m.value}
                        </span>
                      </div>
                      <MetricBar percent={m.percent} variant="a" delay={0.2 + i * 0.1} active={phase === 'results'} />
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${C.divider}` }}>
                  <span
                    className="text-[32px] font-semibold font-[family-name:var(--font-mono)] tabular-nums"
                    style={{ color: C.textSecondary }}
                  >
                    {scoreA.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Column B */}
              <div className="p-7">
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="text-[13px] font-[family-name:var(--font-mono)] font-medium" style={{ color: C.accent }}>
                    Agent B
                  </span>
                  <span
                    className="text-[10px] font-[family-name:var(--font-mono)] px-2 py-0.5 rounded"
                    style={{ color: C.textMuted, backgroundColor: C.surfaceMuted }}
                  >
                    v3.2
                  </span>
                  <span
                    className="text-[10px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-full"
                    style={{ color: C.accent, backgroundColor: C.accentBg }}
                  >
                    challenger
                  </span>
                </div>
                <div className="space-y-3.5">
                  {metricsB.map((m, i) => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-[family-name:var(--font-mono)]" style={{ color: C.textMuted }}>
                          {m.label}
                        </span>
                        <span
                          className="text-[11px] font-[family-name:var(--font-mono)] font-medium"
                          style={{ color: m.winner ? C.accent : C.textSecondary }}
                        >
                          {m.value}
                          {m.winner && <span className="ml-0.5 text-[10px]">{'\u2713'}</span>}
                        </span>
                      </div>
                      <MetricBar percent={m.percent} variant="b" delay={0.2 + i * 0.1} active={phase === 'results'} />
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 flex items-center gap-2" style={{ borderTop: `1px solid ${C.divider}` }}>
                  <span
                    className="text-[32px] font-semibold font-[family-name:var(--font-mono)] tabular-nums"
                    style={{ color: C.accent }}
                  >
                    {scoreB.toFixed(1)}
                  </span>
                  <motion.svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="mt-1"
                    style={{ color: C.accent }}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.5, delay: 1.6, type: 'spring', stiffness: 200 }}
                  >
                    <path
                      d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z"
                      fill="currentColor"
                      opacity="0.8"
                    />
                  </motion.svg>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-7 py-3.5 flex items-center justify-between"
              style={{ borderTop: `1px solid ${C.divider}` }}
            >
              <span className="text-[11px] font-[family-name:var(--font-mono)] font-medium" style={{ color: C.accent }}>
                Champion: Agent B v3.2
              </span>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-[family-name:var(--font-mono)]" style={{ color: C.textFaint }}>
                  promoted to production
                </span>
                <button
                  onClick={handleReplay}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: C.textFaint }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = C.surfaceMuted;
                    e.currentTarget.style.color = C.textSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = C.textFaint;
                  }}
                  title="Replay animation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase indicator dots */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        {(['typing', 'voiceA', 'voiceB', 'results'] as Phase[]).map((p) => {
          const phaseOrder: Record<Phase, number> = { idle: 0, typing: 1, voiceA: 2, voiceB: 3, results: 4 };
          const isActive = phaseOrder[phase] >= phaseOrder[p];
          return (
            <motion.div
              key={p}
              className="rounded-full"
              animate={{
                width: phase === p ? 18 : 6,
                height: 6,
                backgroundColor: isActive ? '#2DD4A8' : '#2a2c3a',
              }}
              transition={{ duration: 0.3 }}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Detail bullet list
   ═══════════════════════════════════════════════════════════════════ */

function DetailBullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
          className="flex items-center gap-2.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          <span className="text-[13px] font-[family-name:var(--font-mono)] text-text-body">
            {item}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════════════════ */

export default function EvalsArenaSection() {
  const details = [
    'Side-by-side agent comparison',
    'Scenario-based stress testing',
    'Statistical significance scoring',
    'Automated regression detection',
  ];

  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] max-w-[600px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 800px 600px at 65% 30%, rgba(20, 184, 166, 0.06), transparent),
            radial-gradient(ellipse 600px 500px at 25% 70%, rgba(6, 182, 212, 0.04), transparent),
            radial-gradient(ellipse 400px 300px at 80% 80%, rgba(99, 102, 241, 0.03), transparent)
          `,
        }}
      />

      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">
          {/* ── Left side: text content ── */}
          <div className="max-w-[460px] lg:pt-8">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5"
            >
              Voice Evals Arena
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="font-[family-name:var(--font-display)] text-4xl lg:text-[52px] text-text-primary tracking-[-0.02em] leading-[1.08] mb-6"
            >
              Pit your agents against each other
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-[16px] text-text-body leading-relaxed mb-8"
            >
              Run head-to-head evaluations of different agent configurations,
              strategies, and prompt versions. See which one handles edge cases,
              maintains composure under frustration, and drives outcomes. An arena for
              voice agent quality.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.24 }}
            >
              <DetailBullets items={details} />
            </motion.div>

            <motion.a
              href="/arena/"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.36 }}
              className="mt-10 inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold rounded-lg bg-accent text-bg-primary hover:shadow-[0_0_30px_rgba(45,212,168,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-bg-primary"
                style={{ animation: 'pulse-live 2s ease-in-out infinite' }}
              />
              Enter the Arena
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.a>
          </div>

          {/* ── Right side: animated showcase ── */}
          <div className="flex-1 flex justify-center lg:justify-end min-w-0 lg:pt-16">
            <AnimatedShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}
