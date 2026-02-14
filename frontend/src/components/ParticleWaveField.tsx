import { useRef, useEffect } from 'react';

/* ================================================================
   ParticleWaveField
   ----------------------------------------------------------------
   A dithered, voxel-style pixel-art animation of an undulating 3-D
   wave surface — inspired by a glowing particle-mesh image.

   Rendering: HTML Canvas + requestAnimationFrame
   Palette  : 6-stop teal → emerald → cyan (matches landing page)
   Dithering: 4×4 Bayer ordered dither for retro pixel-art gradients
   ================================================================ */

// ── Bayer 4×4 ordered-dithering matrix (values normalised 0 – 1) ──
const BAYER = [
  [ 0 / 16,  8 / 16,  2 / 16, 10 / 16],
  [12 / 16,  4 / 16, 14 / 16,  6 / 16],
  [ 3 / 16, 11 / 16,  1 / 16,  9 / 16],
  [15 / 16,  7 / 16, 13 / 16,  5 / 16],
];

// ── Colour palette: 6 stops from void → bright cyan ──
// Aligned with the landing-page accent system:
//   #14b8a6 (teal-500) · #34d399 (emerald-400) · #5eead4 (teal-300)
const PAL: [number, number, number][] = [
  [  8,  14,  22],   // 0 — void (near-background)
  [ 10,  45,  50],   // 1 — deep dark teal
  [ 14,  95,  90],   // 2 — dark teal
  [ 20, 184, 166],   // 3 — accent        #14b8a6
  [ 52, 211, 153],   // 4 — emerald        #34d399
  [ 94, 234, 212],   // 5 — bright cyan    #5eead4
];

// Pre-baked CSS colour strings (avoids per-frame string allocation)
const PAL_CSS = PAL.map(([r, g, b]) => `rgb(${r},${g},${b})`);
const GLOW_CSS = PAL.map(([r, g, b]) => `rgba(${r},${g},${b},0.6)`);

// ── Component ────────────────────────────────────────────────────

export default function ParticleWaveField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId    = useRef(0);
  const logical  = useRef({ w: 500, h: 400 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    /* ---- resize handler (DPR-aware) ---- */
    const fit = () => {
      const rect = el.parentElement!.getBoundingClientRect();
      const dpr  = devicePixelRatio || 1;
      logical.current = { w: rect.width, h: rect.height };
      el.width  = rect.width  * dpr;
      el.height = rect.height * dpr;
      el.style.width  = rect.width  + 'px';
      el.style.height = rect.height + 'px';
    };
    fit();
    addEventListener('resize', fit);

    /* ---- animation loop ---- */
    const frame = (ms: number) => {
      const ctx = el.getContext('2d');
      if (!ctx) return;

      const dpr = devicePixelRatio || 1;
      const { w: W, h: H } = logical.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const t = ms * 0.001;

      // ── Grid parameters (adaptive to container) ──
      const COLS = Math.max(52, Math.round(W / 5.5));
      const ROWS = Math.max(34, Math.round(H / 6));
      const PX   = 3;                        // base voxel size

      const CX   = W * 0.5;                  // screen center X
      const CY   = H * 0.48;                 // screen center Y (slightly above mid)
      const SPC  = W / (COLS - 1);           // horizontal grid spacing
      const RZ   = 5.5;                      // depth row spacing
      const TILT = 0.50;                     // perspective tilt
      const AMP  = 28;                       // wave amplitude

      // Two draw batches: dim pixels first, then glowing peaks
      type Dot = { x: number; y: number; s: number; ci: number };
      const dimBatch:  Dot[] = [];
      const glowBatch: Dot[] = [];

      for (let row = 0; row < ROWS; row++) {
        const rn = row / (ROWS - 1);          // 0 (back) → 1 (front)
        const depthScale = 0.50 + rn * 0.50;  // far rows compress
        const depthAlpha = 0.30 + rn * 0.70;  // far rows fade

        for (let col = 0; col < COLS; col++) {
          const cn = col / (COLS - 1);

          // World-space position
          const wx = (col - COLS / 2) * SPC * depthScale;
          const wz = row * RZ;

          // ── Wave function: 4 octaves for organic, flowing motion ──
          const wy =
            Math.sin(wz * 0.130 + t * 0.85) * 20 +                  // primary swell
            Math.sin(wx * 0.060 + wz * 0.070 + t * 0.55) * 11 +     // cross-wave
            Math.cos(wx * 0.110 - wz * 0.090 + t * 1.10) * 5.5 +    // ripple
            Math.sin((wx + wz * 2) * 0.040 + t * 0.70) * 4;         // interference

          // ── Isometric projection ──
          const sx = CX + wx;
          const sy = CY + (row - ROWS / 2) * RZ * TILT - wy * 0.72;

          // Cull off-screen
          if (sx < -PX || sx > W + PX || sy < -PX || sy > H + PX) continue;

          // Brightness from wave height (0 → 1)
          const brightness = Math.max(0, Math.min(1,
            (wy + AMP * 1.5) / (AMP * 3),
          ));

          // Edge vignette (smooth power falloff)
          const vx = 1 - Math.pow(Math.abs(cn - 0.5) * 2, 4) * 0.60;
          const vy = 1 - Math.pow(Math.abs(rn - 0.5) * 2, 4) * 0.50;
          const fb = brightness * vx * vy * depthAlpha;

          // ── Ordered dithering → palette index ──
          const palFloat = fb * (PAL.length - 1);
          const lo = Math.floor(palFloat);
          const hi = Math.min(lo + 1, PAL.length - 1);
          const ci = (palFloat - lo) > BAYER[row & 3][col & 3] ? hi : lo;

          if (ci <= 0) continue; // skip void pixels

          // Pixel size: depth-scaled + brightness-scaled
          const s = Math.max(1, Math.round(PX * depthScale * (0.50 + fb * 0.60)));
          const dot: Dot = {
            x: Math.round(sx - s / 2),
            y: Math.round(sy - s / 2),
            s,
            ci,
          };

          if (ci >= 4) glowBatch.push(dot);
          else         dimBatch.push(dot);
        }
      }

      // ── Batch 1: dim voxels (no shadow cost) ──
      ctx.shadowBlur = 0;
      for (let i = 0; i < dimBatch.length; i++) {
        const p = dimBatch[i];
        ctx.fillStyle = PAL_CSS[p.ci];
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }

      // ── Batch 2: bright voxels (glow halo) ──
      for (let i = 0; i < glowBatch.length; i++) {
        const p = glowBatch[i];
        ctx.shadowColor = GLOW_CSS[p.ci];
        ctx.shadowBlur  = p.ci >= 5 ? 14 : 7;
        ctx.fillStyle   = PAL_CSS[p.ci];
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }

      ctx.shadowBlur = 0;
      rafId.current = requestAnimationFrame(frame);
    };

    rafId.current = requestAnimationFrame(frame);

    return () => {
      removeEventListener('resize', fit);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[380px]" aria-hidden="true">
      {/* Ambient atmosphere glow behind the wave field */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 50% 52%, rgba(20,184,166,0.08), transparent 70%)',
            'radial-gradient(ellipse 35% 30% at 55% 48%, rgba(52,211,153,0.04), transparent 60%)',
          ].join(', '),
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
