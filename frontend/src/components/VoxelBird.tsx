import { useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════
// GRID
// ═══════════════════════════════════════════════════════
const VOXEL = 5;
const GAP = 1;
const CELL = VOXEL + GAP;
const W = 400;
const H = 300;
const COLS = Math.floor(W / CELL); // 66
const ROWS = Math.floor(H / CELL); // 50

// ═══════════════════════════════════════════════════════
// BIRD SCALE & TRAJECTORY
// ═══════════════════════════════════════════════════════
const SCALE = 0.40;
const TRAJ_SPEED = 0.00038;
const TRAJ_AX = 12; // horizontal amplitude (grid cells)
const TRAJ_AY = 7;  // vertical amplitude

// ═══════════════════════════════════════════════════════
// BAYER 8×8 ORDERED DITHER MATRIX
// ═══════════════════════════════════════════════════════
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map((r) => r.map((v) => v / 64));

// ═══════════════════════════════════════════════════════
// COLOR PALETTE
// ═══════════════════════════════════════════════════════
type RGB = [number, number, number];

const PAL = {
  d3: [5, 48, 48] as RGB,
  d2: [10, 85, 78] as RGB,
  d1: [16, 135, 120] as RGB,
  m: [28, 175, 155] as RGB,
  l1: [45, 205, 178] as RGB,
  l2: [80, 225, 202] as RGB,
  l3: [140, 242, 225] as RGB,
  eye: [8, 15, 18] as RGB,
  eyeH: [200, 248, 238] as RGB,
  beak: [32, 48, 50] as RGB,
  beakT: [18, 28, 30] as RGB,
};

function mix(a: RGB, b: RGB, t: number): RGB {
  const s = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * s,
    a[1] + (b[1] - a[1]) * s,
    a[2] + (b[2] - a[2]) * s,
  ];
}

// ═══════════════════════════════════════════════════════
// SDF HELPERS
// ═══════════════════════════════════════════════════════
function eDist(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
}

function reDist(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number
) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const dx = x - cx,
    dy = y - cy;
  return ((c * dx + s * dy) / rx) ** 2 + ((-s * dx + c * dy) / ry) ** 2;
}

// ═══════════════════════════════════════════════════════
// INTENSITY — solid core, dithered edges only
// ═══════════════════════════════════════════════════════
function edgeI(dist: number): number {
  if (dist <= 0.55) return 0.98;
  if (dist <= 0.80) return 0.98 - ((dist - 0.55) / 0.25) * 0.18;
  if (dist <= 1.00) return 0.80 - ((dist - 0.80) / 0.20) * 0.40;
  if (dist <= 1.15) return 0.40 - ((dist - 1.00) / 0.15) * 0.28;
  if (dist <= 1.30) return 0.12 - ((dist - 1.15) / 0.15) * 0.10;
  return 0;
}

// ═══════════════════════════════════════════════════════
// BIRD SAMPLER — operates in bird-local space (0,0 = center)
// ═══════════════════════════════════════════════════════
interface Sample {
  color: RGB;
  intensity: number;
}

function sampleBird(x: number, y: number, wf: number): Sample | null {
  if (x < -46 || x > 34 || y < -38 || y > 30) return null;

  const bodyD = eDist(x, y, 0, 0, 15, 9);
  const chestD = eDist(x, y, -8, 3, 10, 7);
  const headD = eDist(x, y, -18, -5, 9, 8.5);
  const crownD = eDist(x, y, -20, -11, 5.5, 3);
  const neckD = eDist(x, y, -9, -2, 8, 6);
  const gorgetD = eDist(x, y, -13, 1, 6.5, 4.5);

  const bkBase = -26,
    bkTip = -42,
    bkCY = -6.5;
  const bkLen = bkBase - bkTip;
  const bkProg = Math.max(0, Math.min(1, (bkBase - x) / bkLen));
  const bkW = 2.5 * (1 - bkProg * 0.85);
  const inBeak = x <= bkBase && x >= bkTip && Math.abs(y - bkCY) <= bkW;

  const eyeD = eDist(x, y, -21, -7, 2, 2);
  const eyeHD = eDist(x, y, -22, -7.8, 0.7, 0.7);

  const wAng = -0.3 + wf * 0.85;
  const wY = -7 - wf * 14;
  const covD = reDist(x, y, 3, wY, 14, 6, wAng);
  const secD = reDist(x, y, 5, wY - 2, 18, 4.5, wAng - 0.12);
  const priD = reDist(x, y, 7, wY - 4, 22, 3.5, wAng - 0.25);

  const w2Ang = 0.2 - wf * 0.45;
  const w2Y = 5 + wf * 8;
  const lcD = reDist(x, y, 4, w2Y, 12, 5, w2Ang);
  const lpD = reDist(x, y, 6, w2Y + 2, 16, 3.5, w2Ang - 0.1);

  const tcD = reDist(x, y, 16, 1, 14, 3, 0.04);
  const tuD = reDist(x, y, 16, -1.5, 13, 2.5, -0.1);
  const tlD = reDist(x, y, 16, 3.5, 13, 2.5, 0.1);

  const mainD = Math.min(bodyD, chestD, headD, crownD, neckD);
  const wingD = Math.min(covD, secD, priD);
  const wing2D = Math.min(lcD, lpD);
  const tailD = Math.min(
    x > 7 ? tcD : 99,
    x > 9 ? tuD : 99,
    x > 9 ? tlD : 99
  );

  if (eyeHD <= 1) return { color: PAL.eyeH, intensity: 1 };
  if (eyeD <= 1.2) return { color: PAL.eye, intensity: edgeI(eyeD) };

  if (inBeak) {
    const normD = Math.abs(y - bkCY) / Math.max(0.1, bkW);
    return {
      color: mix(PAL.beak, PAL.beakT, bkProg),
      intensity: edgeI(normD * 0.55),
    };
  }

  if (mainD <= 1.30) {
    const intensity = edgeI(mainD);
    let color: RGB;

    if (gorgetD < 0.95 && mainD < 1.1) {
      const gs = Math.max(0, 1 - gorgetD);
      color = mix(PAL.l1, PAL.l2, gs * 0.8);
    } else if (
      crownD < headD &&
      crownD < bodyD &&
      crownD < chestD &&
      crownD < 1.3
    ) {
      color = mix(PAL.d3, PAL.d2, 0.25);
    } else if (headD < bodyD && headD < chestD && headD < neckD) {
      const g = Math.max(0, Math.min(1, (y + 5 + 8.5) / 17));
      color = mix(PAL.d2, PAL.d1, g * 0.6);
    } else if (neckD < bodyD && neckD < chestD) {
      const g = Math.max(0, Math.min(1, (y + 2 + 6) / 12));
      color = mix(PAL.d2, PAL.m, g * 0.4);
    } else if (chestD < bodyD) {
      const t = Math.max(0, Math.min(1, (y + 4) / 14));
      color = mix(PAL.d2, PAL.m, t * 0.55);
    } else {
      const vert = Math.max(0, Math.min(1, (y + 9) / 18));
      const horiz = Math.max(0, Math.min(1, (x + 15) / 30));
      const t = vert * 0.6 + horiz * 0.4;
      color = mix(PAL.d3, PAL.m, t);
    }

    return { color, intensity };
  }

  if (wingD <= 1.30) {
    const t = Math.sqrt(Math.min(1, wingD));
    let color: RGB;
    if (priD <= secD && priD <= covD) {
      color = mix(PAL.m, PAL.l2, t * 0.6);
    } else if (secD <= covD) {
      color = mix(PAL.d1, PAL.l1, t * 0.5);
    } else {
      color = mix(PAL.d2, PAL.m, t * 0.45);
    }
    return { color, intensity: edgeI(wingD) };
  }

  if (wing2D <= 1.30) {
    const t = Math.sqrt(Math.min(1, wing2D));
    const color =
      lpD < lcD
        ? mix(PAL.d2, PAL.m, t * 0.5)
        : mix(PAL.d3, PAL.d1, t * 0.45);
    return { color, intensity: edgeI(wing2D) };
  }

  if (tailD <= 1.30) {
    const p = Math.min(1, (x - 7) / 22);
    const d = Math.min(tcD, tuD, tlD);
    const isCenter = tcD <= tuD && tcD <= tlD;
    const color = isCenter
      ? mix(PAL.d1, PAL.d3, p)
      : mix(PAL.d1, PAL.d2, Math.min(1, d));
    return { color, intensity: edgeI(tailD) };
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// TRAILING PARTICLES
// ═══════════════════════════════════════════════════════
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: RGB;
}

const PCOLS: RGB[] = [PAL.d1, PAL.m, PAL.l1, PAL.l2];

function spawnP(cx: number, cy: number): Particle {
  return {
    x: cx + (Math.random() - 0.5) * 10,
    y: cy + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 0.025,
    vy: (Math.random() - 0.5) * 0.02,
    life: 0,
    maxLife: 120 + Math.random() * 200,
    color: PCOLS[Math.floor(Math.random() * PCOLS.length)],
  };
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
export default function VoxelBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    particlesRef.current = Array.from({ length: 22 }, () =>
      spawnP(COLS / 2, ROWS / 2)
    );

    let raf: number;

    function render(t: number) {
      ctx.clearRect(0, 0, W, H);

      // ═══ WING PHASE ═══
      const wf = (Math.sin(t * 0.004) + 1) / 2;

      // ═══ TRAJECTORY — golden-ratio Lissajous (never repeats) ═══
      const pt = t * TRAJ_SPEED;
      const trajOX =
        Math.sin(pt) * TRAJ_AX + Math.sin(pt * 1.618) * 3.5;
      const trajOY =
        Math.sin(pt * 2) * TRAJ_AY + Math.cos(pt * 0.618) * 3;

      // ═══ VELOCITY for orientation ═══
      const velX =
        Math.cos(pt) * TRAJ_AX +
        Math.cos(pt * 1.618) * 3.5 * 1.618;
      const velY =
        Math.cos(pt * 2) * TRAJ_AY * 2 -
        Math.sin(pt * 0.618) * 3 * 0.618;

      const facingRight = velX > 0;
      const pitch = Math.atan2(velY, Math.abs(velX) + 10) * 0.22;

      const birdCX = COLS / 2 + trajOX;
      const birdCY = ROWS / 2 + trajOY;

      // ═══ PARTICLES ═══
      const parts = particlesRef.current;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (
          p.life > p.maxLife ||
          p.x < 0 ||
          p.x >= COLS ||
          p.y < 0 ||
          p.y >= ROWS
        ) {
          Object.assign(p, spawnP(birdCX, birdCY));
        }
        const fadeIn = Math.min(1, p.life / 30);
        const fadeOut = Math.max(0, 1 - p.life / p.maxLife);
        const alpha = fadeIn * fadeOut;
        const pgx = Math.floor(p.x),
          pgy = Math.floor(p.y);
        if (alpha < (BAYER[pgy % 8]?.[pgx % 8] ?? 0.5)) continue;

        const px = pgx * CELL,
          py = pgy * CELL;
        const [r, g, b] = p.color;
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(px, py, VOXEL, VOXEL);
      }

      ctx.globalAlpha = 1;

      // ═══ BIRD RENDERING ═══
      const RAD = Math.ceil(46 * SCALE) + 2;
      const gxMin = Math.max(0, Math.floor(birdCX - RAD));
      const gxMax = Math.min(COLS - 1, Math.ceil(birdCX + RAD));
      const gyMin = Math.max(0, Math.floor(birdCY - RAD));
      const gyMax = Math.min(ROWS - 1, Math.ceil(birdCY + RAD));

      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);

      for (let gy = gyMin; gy <= gyMax; gy++) {
        for (let gx = gxMin; gx <= gxMax; gx++) {
          let dx = gx - birdCX;
          let dy = gy - birdCY;

          if (facingRight) dx = -dx;

          const rx = cp * dx + sp * dy;
          const ry = -sp * dx + cp * dy;

          const bx = rx / SCALE;
          const by = ry / SCALE;

          const s = sampleBird(bx, by, wf);
          if (!s) continue;
          if (s.intensity < BAYER[gy % 8][gx % 8]) continue;

          const px = gx * CELL,
            py = gy * CELL;
          const [r, g, b] = s.color;

          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.fillRect(px, py, VOXEL, VOXEL);

          ctx.fillStyle = 'rgba(255,255,255,0.09)';
          ctx.fillRect(px, py, VOXEL, 1);
          ctx.fillRect(px, py, 1, VOXEL);
          ctx.fillStyle = 'rgba(0,0,0,0.11)';
          ctx.fillRect(px, py + VOXEL - 1, VOXEL, 1);
          ctx.fillRect(px + VOXEL - 1, py, 1, VOXEL);
        }
      }

      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto"
      style={{ maxWidth: W, imageRendering: 'pixelated' }}
      aria-hidden="true"
    />
  );
}
