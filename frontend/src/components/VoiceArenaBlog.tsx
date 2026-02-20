/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, Line, ComposedChart, Area, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────────────

const arenaGrowthData = [
  { date: "May '23", votes: 4.7, event: "Launch" },
  { date: "Dec '23", votes: 300, event: "" },
  { date: "Jun '24", votes: 800, event: "Vision Arena" },
  { date: "Dec '24", votes: 1800, event: "WebDev Arena" },
  { date: "May '25", votes: 3500, event: "$100M seed" },
  { date: "Sep '25", votes: 4800, event: "Commercial launch" },
  { date: "Jan '26", votes: 6000, event: "$150M Series A" },
];

const arenaExpansionTimeline = [
  { arena: "Text", launch: "May 2023", votes: "6M+", models: "200+" },
  { arena: "Vision", launch: "Jun 2024", votes: "17K (2wk)", models: "60+" },
  { arena: "WebDev", launch: "Dec 2024", votes: "80K", models: "30+" },
  { arena: "Search", launch: "Apr 2024", votes: "N/A", models: "15+" },
  { arena: "TTS (HF)", launch: "2024", votes: "~50K", models: "15+" },
  { arena: "Voice Arena", launch: "Feb 2026", votes: "—", models: "20+" },
];



const compositeWeights = [
  { metric: "SeMaScore", weight: 30, fill: "#10B981", desc: "Semantic accuracy" },
  { metric: "1 − WER", weight: 25, fill: "#3B82F6", desc: "Transcription accuracy" },
  { metric: "Prosody", weight: 20, fill: "#F59E0B", desc: "Naturalness" },
  { metric: "Quality", weight: 15, fill: "#8B5CF6", desc: "UTMOS perceptual" },
  { metric: "1 − Latency", weight: 10, fill: "#EF4444", desc: "Speed" },
];

const pipelineStages = [
  { stage: "Audio load", group: "audio", ms: 50 },
  { stage: "Resampling", group: "audio", ms: 30 },
  { stage: "VAD", group: "audio", ms: 80 },
  { stage: "SNR estimation", group: "audio", ms: 20 },
  { stage: "Whisper transcribe", group: "asr", ms: 2200 },
  { stage: "WER/CER/MER", group: "asr", ms: 5 },
  { stage: "SeMaScore (BERT)", group: "asr", ms: 350 },
  { stage: "SAER (LaBSE)", group: "asr", ms: 300 },
  { stage: "ASD", group: "asr", ms: 120 },
  { stage: "UTMOS", group: "tts", ms: 450 },
  { stage: "NISQA", group: "tts", ms: 380 },
  { stage: "DNSMOS", group: "tts", ms: 200 },
  { stage: "Prosody (F0)", group: "tts", ms: 150 },
  { stage: "Speaker sim", group: "tts", ms: 280 },
  { stage: "Emotion2Vec", group: "tts", ms: 320 },
  { stage: "Diarization", group: "audio", ms: 1800 },
  { stage: "Latency calc", group: "latency", ms: 5 },
];

const radarData = [
  { dimension: "Transcription", voiceArena: 95, ttsArena: 0, voiceBench: 70 },
  { dimension: "Perceptual", voiceArena: 90, ttsArena: 80, voiceBench: 30 },
  { dimension: "Prosody", voiceArena: 85, ttsArena: 0, voiceBench: 0 },
  { dimension: "Agent", voiceArena: 80, ttsArena: 0, voiceBench: 75 },
  { dimension: "Latency", voiceArena: 90, ttsArena: 0, voiceBench: 40 },
  { dimension: "Human Pref", voiceArena: 95, ttsArena: 95, voiceBench: 0 },
];

const werVsSemaData = [
  { pair: "Pair 1", wer: 0.22, sema: 0.96, desc: "Paraphrase" },
  { pair: "Pair 2", wer: 0.33, sema: 0.91, desc: "Synonym swap" },
  { pair: "Pair 3", wer: 0.11, sema: 0.42, desc: "Meaning error" },
  { pair: "Pair 4", wer: 0.05, sema: 0.98, desc: "Near-perfect" },
  { pair: "Pair 5", wer: 0.45, sema: 0.88, desc: "Heavy paraphrase" },
  { pair: "Pair 6", wer: 0.08, sema: 0.55, desc: "Entity error" },
];

// ── Tooltip ──────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, suffix = "" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#1a1a1a", border: "1px solid #333",
        borderRadius: "6px", padding: "8px 12px", fontSize: "13px",
        color: "#e5e5e5", fontFamily: "'IBM Plex Mono', monospace"
      }}>
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>
          {label || payload[0]?.payload?.name || payload[0]?.payload?.stage || payload[0]?.payload?.pair}
        </p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ margin: 0, color: entry.color || entry.fill || "#10B981" }}>
            {entry.name || entry.dataKey}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ── FigureHeader ─────────────────────────────────────────────────────────

function FigureHeader({ num, title, caption }: { num: number; title: string; caption: string }) {
  return (
    <>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
        textTransform: "uppercase", letterSpacing: "1.5px",
        color: "#888", marginBottom: "6px"
      }}>Figure {num}</div>
      <h3 style={{
        fontFamily: "'Newsreader', Georgia, serif", fontSize: "20px",
        fontWeight: 500, color: "#e5e5e5", marginTop: 0, marginBottom: "4px"
      }}>{title}</h3>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px",
        color: "#777", marginBottom: "20px"
      }}>{caption}</p>
    </>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────

function ArenaGrowthChart() {
  return (
    <div style={{ margin: "32px 0" }}>
      <FigureHeader
        num={1}
        title="The arena effect: LMArena's trajectory from side project to $1.7B"
        caption="Cumulative votes (thousands). Key milestones annotated. 4.7K votes at launch → 6M+ in 32 months."
      />
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={arenaGrowthData} margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="date" tick={{ fill: '#999', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: '#333' }} tickLine={false} />
          <YAxis tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: '#333' }} tickLine={{ stroke: '#333' }}
            label={{ value: "Votes (K)", angle: -90, position: "insideLeft", style: { fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" } }} />
          <Tooltip content={<CustomTooltip suffix="K votes" />} />
          <Area type="monotone" dataKey="votes" fill="#10B98120" stroke="none" />
          <Line type="monotone" dataKey="votes" stroke="#10B981" strokeWidth={2.5} dot={{ r: 5, fill: "#10B981", stroke: "#0d0d0d", strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompositeWeightsChart() {
  return (
    <div style={{ margin: "32px 0" }}>
      <FigureHeader
        num={2}
        title="Voice Arena composite score decomposition"
        caption="Automated vote weight distribution. Semantic accuracy dominates; latency is a tiebreaker."
      />
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={compositeWeights} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
          <XAxis type="number" domain={[0, 35]} tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: '#333' }} tickLine={{ stroke: '#333' }}
            label={{ value: "Weight (%)", position: "insideBottom", offset: -5, style: { fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" } }} />
          <YAxis dataKey="metric" type="category" width={100} tick={{ fill: '#999', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip suffix="%" />} />
          <Bar dataKey="weight" radius={[0, 4, 4, 0]} barSize={24}>
            {compositeWeights.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WerVsSemaChart() {
  return (
    <div style={{ margin: "32px 0" }}>
      <FigureHeader
        num={3}
        title="WER vs. SeMaScore: the diagnostic delta"
        caption="Six hypothesis-reference pairs. Large WER–SeMaScore deltas (pairs 1, 2, 5) indicate paraphrasing; small deltas with low SeMaScore (pairs 3, 6) indicate meaning-destroying errors."
      />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={werVsSemaData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="pair" tick={{ fill: '#999', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: '#333' }} tickLine={false} />
          <YAxis tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: '#333' }} tickLine={{ stroke: '#333' }} domain={[0, 1]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }} />
          <Bar dataKey="wer" name="WER (lower = better)" fill="#EF4444" radius={[3, 3, 0, 0]} barSize={22} />
          <Bar dataKey="sema" name="SeMaScore (higher = better)" fill="#10B981" radius={[3, 3, 0, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CoverageRadar() {
  return (
    <div style={{ margin: "32px 0" }}>
      <FigureHeader
        num={4}
        title="Evaluation coverage: Voice Arena vs. existing platforms"
        caption="Percentage coverage across 6 evaluation dimensions. Voice Arena is the only platform that covers all six."
      />
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#999', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
          <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
          <Radar name="Voice Arena" dataKey="voiceArena" stroke="#10B981" fill="#10B981" fillOpacity={0.25} strokeWidth={2} />
          <Radar name="TTS Arena (HF)" dataKey="ttsArena" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 3" />
          <Radar name="VoiceBench" dataKey="voiceBench" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 3" />
          <Legend wrapperStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PipelineStagesChart() {
  const groupColors: Record<string, string> = { audio: "#6B7280", asr: "#F59E0B", tts: "#3B82F6", latency: "#EF4444" };
  return (
    <div style={{ margin: "32px 0" }}>
      <FigureHeader
        num={5}
        title="17 pipeline stages: where evaluation time goes"
        caption="Milliseconds per stage on a single A100. Whisper transcription dominates. Total: ~6.7s without diarization, ~8.5s with."
      />
      <ResponsiveContainer width="100%" height={480}>
        <BarChart data={pipelineStages} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: '#333' }} tickLine={{ stroke: '#333' }}
            label={{ value: "Time (ms)", position: "insideBottom", offset: -5, style: { fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" } }} />
          <YAxis dataKey="stage" type="category" width={140} tick={{ fill: '#999', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip suffix="ms" />} />
          <Bar dataKey="ms" radius={[0, 3, 3, 0]} barSize={16}>
            {pipelineStages.map((entry, i) => <Cell key={i} fill={groupColors[entry.group]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "12px", flexWrap: "wrap" }}>
        {[
          { color: "#6B7280", label: "Audio preprocessing" },
          { color: "#F59E0B", label: "ASR metrics" },
          { color: "#3B82F6", label: "TTS quality" },
          { color: "#EF4444", label: "Latency" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#888" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Architecture Diagram (SVG) ───────────────────────────────────────────

function GeneralArchitectureDiagram() {
  const font = "'IBM Plex Mono', monospace";

  return (
    <div style={{ margin: "32px 0" }}>
      <FigureHeader
        num={6}
        title="Voice Arena: three layers, one flywheel"
        caption="Each layer is independently useful. Together they create a reinforcing loop where more evaluations improve rankings and better rankings attract more evaluations."
      />
      <div style={{ background: "#111", border: "1px solid #252525", borderRadius: "6px", padding: "16px 8px", overflowX: "auto" }}>
        <svg viewBox="0 0 720 520" width="100%" style={{ maxWidth: "720px", display: "block", margin: "0 auto" }}>
          <defs>
            <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#888" />
            </marker>
            <marker id="ahG" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#10B981" />
            </marker>
          </defs>

          {/* ── Layer 3: Experiments (top — user-facing) ── */}
          <rect x="40" y="16" width="640" height="100" rx="6" fill="#111118" stroke="#8B5CF6" strokeWidth="1.2" />
          <text x="62" y="40" fill="#8B5CF6" fontSize="13" fontFamily={font} fontWeight="600">EXPERIMENTS LAYER</text>
          <text x="62" y="58" fill="#9580c8" fontSize="10.5" fontFamily={font}>Programmatic A/B testing for developers & CI/CD</text>

          <text x="82" y="82" fill="#777" fontSize="10" fontFamily={font}>Define experiment</text>
          <text x="250" y="82" fill="#777" fontSize="10" fontFamily={font}>→ N models × M prompts</text>
          <text x="440" y="82" fill="#777" fontSize="10" fontFamily={font}>→ Parallel trials</text>
          <text x="580" y="82" fill="#777" fontSize="10" fontFamily={font}>→ Ranked results</text>

          <rect x="82" y="92" width="100" height="14" rx="2" fill="#8B5CF620" stroke="none" />
          <text x="132" y="102" textAnchor="middle" fill="#a08de0" fontSize="8.5" fontFamily={font}>API + webhooks</text>
          <rect x="250" y="92" width="130" height="14" rx="2" fill="#8B5CF620" stroke="none" />
          <text x="315" y="102" textAnchor="middle" fill="#a08de0" fontSize="8.5" fontFamily={font}>scenario selection</text>
          <rect x="440" y="92" width="100" height="14" rx="2" fill="#8B5CF620" stroke="none" />
          <text x="490" y="102" textAnchor="middle" fill="#a08de0" fontSize="8.5" fontFamily={font}>TTS generation</text>
          <rect x="580" y="92" width="90" height="14" rx="2" fill="#8B5CF620" stroke="none" />
          <text x="625" y="102" textAnchor="middle" fill="#a08de0" fontSize="8.5" fontFamily={font}>win matrix</text>

          {/* ── Arrow down ── */}
          <line x1="360" y1="116" x2="360" y2="144" stroke="#888" strokeWidth="1" markerEnd="url(#ah)" />
          <text x="385" y="134" fill="#666" fontSize="9" fontFamily={font}>triggers</text>

          {/* ── Layer 2: Battle System ── */}
          <rect x="40" y="146" width="640" height="120" rx="6" fill="#0f1a14" stroke="#10B981" strokeWidth="1.2" />
          <text x="62" y="170" fill="#10B981" fontSize="13" fontFamily={font} fontWeight="600">BATTLE LAYER</text>
          <text x="62" y="188" fill="#0d9068" fontSize="10.5" fontFamily={font}>Blind human preference voting + ELO rankings</text>

          {/* Battle flow boxes */}
          <rect x="82" y="200" width="110" height="44" rx="4" fill="#0d0d0d" stroke="#10B98140" strokeWidth="1" />
          <text x="137" y="218" textAnchor="middle" fill="#ccc" fontSize="10" fontFamily={font} fontWeight="500">4-Model Blind</text>
          <text x="137" y="232" textAnchor="middle" fill="#888" fontSize="9" fontFamily={font}>Comparison</text>

          <line x1="192" y1="222" x2="225" y2="222" stroke="#555" strokeWidth="1" markerEnd="url(#ah)" />

          <rect x="228" y="200" width="100" height="44" rx="4" fill="#0d0d0d" stroke="#10B98140" strokeWidth="1" />
          <text x="278" y="218" textAnchor="middle" fill="#ccc" fontSize="10" fontFamily={font} fontWeight="500">Human Vote</text>
          <text x="278" y="232" textAnchor="middle" fill="#888" fontSize="9" fontFamily={font}>+ auto score</text>

          <line x1="328" y1="222" x2="361" y2="222" stroke="#555" strokeWidth="1" markerEnd="url(#ah)" />

          <rect x="364" y="200" width="100" height="44" rx="4" fill="#0d0d0d" stroke="#10B98140" strokeWidth="1" />
          <text x="414" y="218" textAnchor="middle" fill="#ccc" fontSize="10" fontFamily={font} fontWeight="500">Bradley-Terry</text>
          <text x="414" y="232" textAnchor="middle" fill="#888" fontSize="9" fontFamily={font}>ELO update</text>

          <line x1="464" y1="222" x2="497" y2="222" stroke="#555" strokeWidth="1" markerEnd="url(#ah)" />

          <rect x="500" y="200" width="140" height="44" rx="4" fill="#0d0d0d" stroke="#10B98140" strokeWidth="1" />
          <text x="570" y="218" textAnchor="middle" fill="#ccc" fontSize="10" fontFamily={font} fontWeight="500">Leaderboard</text>
          <text x="570" y="232" textAnchor="middle" fill="#888" fontSize="9" fontFamily={font}>rankings + trends</text>

          <text x="62" y="256" fill="#0a7050" fontSize="9" fontFamily={font}>Matchmaking: models within 200 ELO · scenario-aware · daily snapshots · category filtering</text>

          {/* ── Arrow down ── */}
          <line x1="360" y1="266" x2="360" y2="294" stroke="#888" strokeWidth="1" markerEnd="url(#ah)" />
          <text x="385" y="284" fill="#666" fontSize="9" fontFamily={font}>invokes</text>

          {/* ── Layer 1: Evaluation Engine ── */}
          <rect x="40" y="296" width="640" height="130" rx="6" fill="#1a1410" stroke="#F59E0B" strokeWidth="1.2" />
          <text x="62" y="320" fill="#F59E0B" fontSize="13" fontFamily={font} fontWeight="600">EVALUATION ENGINE</text>
          <text x="62" y="338" fill="#b38a20" fontSize="10.5" fontFamily={font}>17-stage automated metrics pipeline (standalone CLI or API)</text>

          {/* Four metric groups */}
          {[
            { x: 70, label: "ASR", sub: "WER · SeMaScore\nSAER · ASD · CER", color: "#F59E0B" },
            { x: 230, label: "TTS Quality", sub: "UTMOS · NISQA\nDNSMOS · Prosody", color: "#3B82F6" },
            { x: 400, label: "Agent", sub: "TSR · JGA\nCoherence · Recovery", color: "#10B981" },
            { x: 555, label: "Latency", sub: "RTFx · TTFB\nE2E · P50–P99", color: "#EF4444" },
          ].map(({ x, label, sub, color }) => (
            <g key={label}>
              <rect x={x} y="350" width="135" height="60" rx="4" fill="#0d0d0d" stroke={color + "50"} strokeWidth="1" />
              <text x={x + 67.5} y="368" textAnchor="middle" fill={color} fontSize="11" fontFamily={font} fontWeight="600">{label}</text>
              {sub.split("\n").map((line, i) => (
                <text key={i} x={x + 67.5} y={382 + i * 13} textAnchor="middle" fill="#888" fontSize="9" fontFamily={font}>{line}</text>
              ))}
            </g>
          ))}

          <text x="62" y="422" fill="#8a6d10" fontSize="9" fontFamily={font}>GPU-accelerated · lazy-loaded models · graceful degradation · structured JSON output</text>

          {/* ── Flywheel arrow (right side, curving back up) ── */}
          <path d="M 695 400 C 710 400 715 280 715 200 C 715 120 710 40 695 40" fill="none" stroke="#10B981" strokeWidth="1.2" strokeDasharray="5,4" markerEnd="url(#ahG)" />
          <text x="702" y="220" fill="#10B981" fontSize="9" fontFamily={font} transform="rotate(90, 702, 220)" textAnchor="middle">flywheel</text>

          {/* ── Data input (bottom) ── */}
          <rect x="180" y="448" width="360" height="48" rx="6" fill="#0d0d0d" stroke="#444" strokeWidth="1" strokeDasharray="4,3" />
          <text x="360" y="468" textAnchor="middle" fill="#aaa" fontSize="11" fontFamily={font} fontWeight="500">Audio Input</text>
          <text x="360" y="484" textAnchor="middle" fill="#666" fontSize="9.5" fontFamily={font}>raw recordings · TTS-generated · live agent calls · uploaded files</text>

          <line x1="360" y1="448" x2="360" y2="428" stroke="#888" strokeWidth="1" markerEnd="url(#ah)" />
        </svg>
      </div>
    </div>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ width: "100%", height: "1px", background: "linear-gradient(90deg, transparent, #333, transparent)", margin: "48px 0" }} />;
}

// ── Code Block ───────────────────────────────────────────────────────────

function Code({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ margin: "24px 0" }}>
      {title && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#888", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>{title}</div>}
      <pre style={{
        background: "#111", border: "1px solid #222", borderRadius: "8px",
        padding: "20px", overflowX: "auto", fontSize: "13px", lineHeight: 1.6,
        fontFamily: "'IBM Plex Mono', monospace", color: "#c5c5c5", margin: 0
      }}>{children}</pre>
    </div>
  );
}

// ── Callout Box ──────────────────────────────────────────────────────────

function Callout({ children, color = "#10B981" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      background: "#111", border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`,
      borderRadius: "0 8px 8px 0", padding: "20px 24px", margin: "28px 0",
      fontSize: "15px", lineHeight: 1.7
    }}>{children}</div>
  );
}

// ── Main Blog ─────────────────────────────────────────────────────────────

export default function VoiceArenaBlog() {
  return (
    <div style={{
      background: "#0d0d0d", color: "#d4d4d4", minHeight: "100vh",
      fontFamily: "'Newsreader', Georgia, serif", fontSize: "17px", lineHeight: 1.75
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "740px", margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px",
            textTransform: "uppercase", letterSpacing: "2px",
            color: "#10B981", marginBottom: "16px"
          }}>Technical Deep Dive · February 2026</div>

          <h1 style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: "clamp(32px, 5vw, 46px)", fontWeight: 400,
            lineHeight: 1.15, color: "#f5f5f5", margin: 0, letterSpacing: "-0.02em"
          }}>
            Voice Arena: Why the Voice AI Stack Needs an Arena — and How We Built One
          </h1>

          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#666", marginTop: "20px", lineHeight: 1.8 }}>
            <span style={{ color: "#ccc" }}>Siddhant Saxena</span>{" "}
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" style={{ color: "#10B981", textDecoration: "none", borderBottom: "1px solid #10B98140" }}>𝕏</a>
            {" · "}
            <span style={{ color: "#ccc" }}>BaseThesis Labs</span>
            {" · "}KoeCode{" · "}~30 min read
          </p>
        </div>

        <Divider />

        {/* ─── TL;DR ─── */}

        <Callout>
          <strong style={{ color: "#10B981" }}>TL;DR</strong><br />
          Voice Arena is a platform for blind, head-to-head evaluation of voice AI models — TTS, ASR, speech-to-speech, and full voice agents — across real-world scenarios. It combines a 17-metric automated evaluation pipeline with human preference voting in a blind 4-model comparison interface, ranks models using Bradley-Terry ELO with hybrid scoring, and exposes an Experiments API for programmatic CI/CD testing. The evaluation code is open-source. This post explains <em>why</em> the arena model works — drawing from LMArena's trajectory from 4.7K votes to a $1.7B valuation — and <em>how</em> we built each layer, with implementation-level detail.
        </Callout>

        <Divider />

        {/* ─── Section 1: Why Arenas Work ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>The arena thesis: what LMArena proved</h2>

        <p>
          In May 2023, a group of UC Berkeley PhD students launched a side project. The concept was
          almost trivially simple: show a user two anonymous LLM outputs, let them pick the better
          one, and aggregate the results into an ELO ranking. Chatbot Arena collected 4,700 votes
          in its first week.
        </p>

        <p>
          Thirty-two months later, the platform — now called LMArena — had accumulated over 6 million
          human preference votes, evaluated more than 200 models, raised $250M in total funding, and
          reached a $1.7 billion valuation. Its commercial evaluation service hit $30M annualized
          revenue within four months of launch. Every major model lab — OpenAI, Google, Anthropic,
          Meta — now treats arena rankings as a first-class signal. DeepSeek tested prototype models
          on Arena months before R1 gained attention. OpenAI previewed GPT-5 under the codename "summit."
        </p>

        <ArenaGrowthChart />

        <p>
          This trajectory isn't an anomaly. It reveals something structural about how evaluation
          works in rapidly commoditizing AI markets. Three dynamics drove it, and all three apply
          directly to voice AI.
        </p>

        <p>
          <strong>First, static benchmarks saturate.</strong> By 2024, top LLMs were scoring near-perfectly on
          MMLU, HumanEval, and most academic benchmarks. The numbers stopped being informative. Arena-style
          evaluation resists saturation because the prompts are drawn from real user behavior — the
          distribution shifts continuously as models improve and user expectations evolve. Scale's 2024
          Zeitgeist report found that 72% of enterprises had built their own internal evaluation pipelines,
          a direct response to the inadequacy of published benchmarks. Arenas address this at the
          community level.
        </p>

        <p>
          <strong>Second, human preference captures what metrics miss.</strong> A model can score perfectly
          on every quantitative benchmark and still produce outputs that feel wrong — wrong tone, wrong
          structure, wrong emphasis. This is even more pronounced in voice, where the relevant quality
          signal is perceptual: how the speech <em>sounds</em>, not just what it transcribes to. You
          cannot automate the full judgment. But you can scale human preference data collection by
          making it engaging, fast, and anonymous.
        </p>

        <p>
          <strong>Third, arenas create flywheel effects.</strong> Labs use arena results to calibrate
          models → they submit new models to the arena → more battles generate more data → rankings
          become more accurate → labs trust them more. LMArena expanded from text to vision, coding,
          search, and video within 18 months. Each new modality bootstrapped quickly because the
          infrastructure — the voting UI, the ELO system, the statistical framework — was already
          proven.
        </p>

        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: "8px",
          padding: "20px 24px", margin: "32px 0", overflowX: "auto"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#888", fontWeight: 600 }}>Arena</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#888", fontWeight: 600 }}>Launch</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "#888", fontWeight: 600 }}>Votes</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "#888", fontWeight: 600 }}>Models</th>
              </tr>
            </thead>
            <tbody>
              {arenaExpansionTimeline.map((row) => (
                <tr key={row.arena} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "8px 12px", color: row.arena === "Voice Arena" ? "#10B981" : "#ccc", fontWeight: row.arena === "Voice Arena" ? 600 : 400 }}>{row.arena}</td>
                  <td style={{ padding: "8px 12px", color: "#999" }}>{row.launch}</td>
                  <td style={{ padding: "8px 12px", color: "#999", textAlign: "right" }}>{row.votes}</td>
                  <td style={{ padding: "8px 12px", color: "#999", textAlign: "right" }}>{row.models}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          The missing row in this expansion is voice. TTS Arena on Hugging Face exists, but it evaluates
          only single-utterance preference — no ASR, no latency, no agent metrics, no scenario-based
          stress testing. Artificial Analysis ranks speech models, but without automated quality signals
          or controlled evaluation conditions. Neither evaluates full voice agents performing multi-turn
          tasks under adversarial conditions.
        </p>

        <p>
          Voice AI needs an arena that covers the complete stack. That is what Voice Arena is.
        </p>

        <Divider />

        {/* ─── Section 2: The Gap ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>The evaluation gap in voice AI</h2>

        <p>
          Voice AI evaluation today has two structural problems that the arena model is uniquely
          positioned to solve.
        </p>

        <p>
          <strong>Problem 1: Metric fragmentation.</strong> When someone says "this TTS model is good,"
          they might mean it scores well on WER (a transcription metric that tells you nothing about
          speech quality), or that it has low TTFB (which tells you about speed but not naturalness),
          or that listeners preferred it in a blind test (which tells you preference but not <em>why</em>).
          No existing platform evaluates across all these dimensions simultaneously.
        </p>

        <CoverageRadar />

        <p>
          <strong>Problem 2: Ecological validity.</strong> Benchmarking a TTS model on "Hello, how can
          I help you today?" tells you nothing about how it handles the prosodic demands of "Your
          account balance is four hundred and twenty dollars and thirty-seven cents" or the emotional
          weight of "I understand this has been frustrating, and I'm going to make this right." Real
          voice AI operates across customer service, healthcare, financial services, and entertainment —
          domains where the failure modes are domain-specific and the quality bar is context-dependent.
        </p>

        <p>
          Voice Arena addresses both. It evaluates models across all layers of the voice stack —
          transcription accuracy, synthesis quality, prosodic naturalness, agent behavior, and latency —
          using curated scenarios that stress-test the exact failure modes you encounter in production.
        </p>

        <Divider />

        {/* ─── Section 3: Evaluation Pipeline Deep Dive ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>The evaluation pipeline: 17 stages, 4 metric groups</h2>

        <p>
          The core of Voice Arena is <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: "3px", fontSize: "15px", fontFamily: "'IBM Plex Mono', monospace" }}>voice_evals</code>,
          a modular Python framework designed as both a standalone CLI tool and the engine powering the
          Arena API. It evaluates audio across four metric groups — ASR, TTS, Agent, and Latency —
          each implemented as an independent module with lazy-loaded dependencies.
          The pipeline orchestrator runs each group in isolation — a missing dependency for
          diarization doesn't crash ASR metrics, a failed model load doesn't block prosody
          analysis. Each group degrades gracefully, so you always get partial results rather
          than a pipeline-wide failure.
        </p>

        <PipelineStagesChart />

        <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: "22px", fontWeight: 500, color: "#e5e5e5" }}>
          ASR: beyond WER
        </h3>

        <p>
          Word Error Rate is the default ASR metric, and also the least informative one for production
          use. A WER of 0.08 tells you almost nothing about <em>what kind</em> of errors the system is
          making. Voice Arena computes six ASR metrics, each addressing a different diagnostic question:
        </p>

        <p>
          <strong>WER, CER, MER</strong> are the string-distance baselines. MER is bounded to [0, 1] —
          unlike WER which can exceed 1.0 when the hypothesis is longer than the reference — giving a
          more interpretable error signal for open-ended speech.
        </p>

        <p>
          <strong>SeMaScore</strong> is a BERT-based semantic similarity metric with MER penalty. It
          measures whether <em>meaning</em> was preserved even when surface forms differ. "I'd like to
          book a flight" and "I want to book a flight" have non-zero WER but near-perfect SeMaScore.
        </p>

        <p>
          <strong>SAER</strong> uses LaBSE embeddings for multilingual and code-switching evaluation.
          When a speaker mixes Hindi and English mid-sentence — which billions of people do daily —
          standard WER breaks down. SAER handles this natively.
        </p>

        <p>
          <strong>ASD</strong> (Aligned Semantic Distance) captures meaning drift at the phrase level,
          not just the whole-utterance level, providing fine-grained error localization.
        </p>

        <WerVsSemaChart />

        <Callout color="#F59E0B">
          <strong style={{ color: "#F59E0B" }}>Key insight:</strong> The delta between WER and
          SeMaScore is itself a diagnostic signal. A large delta (high WER, high SeMaScore) means the
          ASR system is paraphrasing — surface-level errors without meaning loss. A small delta with
          low SeMaScore indicates meaning-destroying errors like entity substitutions. Models with
          consistently large deltas may be acceptable for NLU pipelines that only need intent
          extraction, even if their WER looks poor on paper.
        </Callout>

        <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: "22px", fontWeight: 500, color: "#e5e5e5" }}>
          TTS: multi-dimensional perceptual scoring
        </h3>

        <p>
          TTS evaluation uses three complementary quality prediction models. <strong>UTMOS</strong> (UTokyo-SaruLab,
          trained on VoiceMOS Challenge data) predicts MOS on a 1–5 scale and is the strongest single predictor
          of human preference we've tested — its rankings correlate at r {">"} 0.85 with our human vote outcomes.
          <strong> NISQA</strong> outputs five dimensions: overall quality, noisiness, coloration, discontinuity,
          and loudness. Where UTMOS gives you a scalar, NISQA tells you <em>why</em> audio sounds bad.
          <strong> DNSMOS</strong> predicts ITU-T P.835 scores for signal quality, background noise, and
          overall quality — especially informative for models that introduce processing artifacts.
        </p>

        <p>
          Beyond perceptual quality, we measure <strong>prosodic fidelity</strong>: F0-RMSE (pitch deviation),
          pace analysis, intonation contours, and a composite prosody score normalized to [0, 1].
          Prosody is where most TTS models fail in practice. They produce phonetically accurate,
          pleasant-sounding speech that is prosodically flat — which kills perceived naturalness in
          multi-sentence utterances. We also compute <strong>speaker similarity</strong> (SECS via WavLM
          cosine similarity) for voice cloning evaluation and <strong>emotion detection</strong> via
          Emotion2Vec.
        </p>

        <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: "22px", fontWeight: 500, color: "#e5e5e5" }}>
          Agent metrics: measuring task completion
        </h3>

        <p>
          Voice Arena evaluates full voice agents using behavioral metrics: <strong>Task Success
          Rate</strong> (did the agent accomplish the goal?), <strong>Containment</strong> (resolved
          without human escalation?), <strong>Intent Accuracy</strong> and <strong>Joint Goal
          Accuracy</strong> (deterministic NLU evaluation — JGA is 1.0 only if every expected slot
          is correctly filled), <strong>Coherence Score</strong> (LLM-as-judge), and <strong>Error
          Recovery Rate</strong>.
        </p>

        <p>
          These are evaluated against curated scenarios spanning five categories (Customer Service,
          Support, Scheduling, Sales, Entertainment) at three difficulty levels. Hard scenarios test
          emotional resilience: an angry customer demanding a refund, a complaint escalation with
          repeated billing errors. Easy scenarios test baseline competence: booking an appointment,
          answering FAQs. The scenario design is deliberate — it maps directly to the failure modes
          that production deployments encounter.
        </p>

        <Divider />

        {/* ─── Section 4: Battle System ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>The battle system: blind comparison at scale</h2>

        <p>
          Raw metrics are useful but insufficient. They don't capture the holistic quality judgment
          that humans make when they <em>hear</em> speech. Voice Arena combines automated metrics
          with blind human preference voting, drawing directly from the methodology that made LMArena
          the industry standard for LLM evaluation.
        </p>

        <p>
          Each battle presents four audio samples — labeled Model A, B, C, D — generated from the
          same prompt text using different voice models. Users must listen to all four before voting
          is enabled. After voting, model identities are revealed alongside their full automated
          metric scores — creating a feedback loop where users calibrate their perceptual judgments
          against objective measurements.
        </p>

        <p>
          Votes feed into a <strong>Bradley-Terry ELO system</strong> — the same statistical
          framework that powers LMArena's text rankings. All models start at 1500. Three
          vote sources contribute: automated votes derived from composite metric scores,
          human votes from blind preference battles, and hybrid votes (the default) where
          both sources contribute with human judgments weighted 1.5× relative to automated ones.
        </p>

        <CompositeWeightsChart />

        <p>
          The composite score formula is: 30% SeMaScore + 25% (1 − WER) + 20% prosody + 15%
          quality + 10% (1 − normalized latency). Tie declared if difference falls below 0.02.
          Weights are configurable per deployment.
        </p>

        <p>
          <strong>Matchmaking</strong> pairs models within 200 ELO points of each other, with random
          scenario selection within the chosen category. This avoids uninformative blowout matches
          and concentrates battles where they are most discriminating — precisely the matchmaking
          insight that made chess ELO effective. Daily leaderboard snapshots capture ELO, win rate,
          and average metrics per model for trend analysis.
        </p>

        <Divider />

        {/* ─── Section 5: Architecture ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>How Voice Arena works: the system in motion</h2>

        <p>
          Voice Arena is designed around a simple loop: audio goes in, structured quality signals
          come out, and those signals accumulate into rankings that get more accurate over time.
          The system has three layers, each independently useful.
        </p>

        <GeneralArchitectureDiagram />

        <p>
          The <strong>evaluation engine</strong> is the foundation. It accepts raw audio (or generates
          it from text via connected TTS providers), runs it through the 17-stage metric pipeline,
          and produces a structured quality report covering ASR accuracy, TTS quality, agent behavior,
          and latency. This layer works standalone — you can evaluate audio from the command line
          without any of the other layers.
        </p>

        <p>
          The <strong>battle layer</strong> sits on top of the evaluation engine and adds human
          judgment. It orchestrates blind comparisons, collects preference votes, and combines
          automated scores with human preferences into ELO rankings using a hybrid weighting scheme.
          The battle layer is what makes Voice Arena an arena rather than just a metrics dashboard —
          it's where the ecological validity comes from.
        </p>

        <p>
          The <strong>experiments layer</strong> exposes both underlying layers as a programmatic API.
          Developers define experiments (N models × M prompts × a scenario), the system generates and
          evaluates all trials in parallel, and returns aggregated results with statistical significance
          testing. This is the CI/CD integration point — the layer that makes voice evaluation a
          continuous process rather than a one-off activity.
        </p>

        <p>
          The key architectural principle: <strong>each layer adds value without requiring the others.</strong> The
          evaluation engine is useful by itself. The battle layer is useful without the experiments
          API. But when all three layers work together, they create a flywheel: experiments generate
          evaluation data → evaluation data feeds battles → battles produce human preference signals
          → preference signals improve the composite scoring model → better scoring makes experiments
          more informative.
        </p>

        <Divider />

        {/* ─── Section 6: Experiments API ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>Experiments API: programmatic A/B testing for voice</h2>

        <p>
          The Experiments API turns Voice Arena into a developer-facing platform for
          programmatic voice AI A/B testing. Think Wingify/VWO for voice AI. Developers submit
          text prompts, specify models to compare, choose a scenario, and the API generates audio,
          runs evaluations, and returns ranked results with statistical significance.
        </p>

        <Code title="Create an experiment">
{`curl -X POST https://api.koecode.io/v1/experiments \\
  -H "Authorization: Bearer vl_..." \\
  -d '{
    "name": "Q3 IVR voice test",
    "scenario": "customer_support",
    "eval_mode": "automated",
    "models": [
      {"provider": "cartesia", "voice_id": "abc123"},
      {"provider": "deepgram"},
      {"provider": "elevenlabs", "voice_id": "def456"}
    ],
    "prompts": [
      "Thank you for calling. How can I help you today?",
      "Your account balance is four hundred and twenty dollars.",
      "I understand this has been frustrating. Let me fix this."
    ],
    "webhook_url": "https://example.com/webhook"
  }'`}
        </Code>

        <p>
          An experiment with 3 models and 10 prompts produces 30 trials. Each trial captures
          generated audio, TTFB, total generation time, audio duration, and silence ratio.
          Aggregated results include per-model mean and standard deviation, a composite score,
          a head-to-head win matrix, and an overall ranking with confidence intervals. A winner
          is declared only if the result is statistically significant.
        </p>

        <p>
          The critical design choice: <strong>CI/CD integration</strong>. A voice agent team can
          run an experiment on every PR that modifies the prompt or model configuration, catch
          quality regressions before they ship, and maintain a history of experiment results for
          audit. This is the voice equivalent of what LMArena's commercial API provides for text —
          but with automated quality metrics that go far beyond human preference alone.
        </p>

        <Divider />

        {/* ─── Section 7: Why This Matters Now ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>Why voice evaluation infrastructure matters now</h2>

        <p>
          LMArena's journey offers a clear lesson: <strong>evaluation infrastructure becomes
          critical exactly when the model layer commoditizes.</strong> In 2022, you picked GPT-4
          because nothing else came close. By 2025, GPT-5, Claude, Gemini, DeepSeek, and Llama
          all competed within narrow margins — and the question shifted from "which model is best?"
          to "which model is best <em>for my use case</em>?" That shift created a $1.7B company.
        </p>

        <p>
          Voice AI is at precisely this inflection. Cartesia's Sonic Turbo delivers 40ms TTFB.
          Resemble AI's Chatterbox (MIT license, 350M params) beats ElevenLabs in blind tests.
          Fish Audio's OpenAudio S1 tops TTS-Arena2. At least six providers offer production-grade
          TTS under 100ms. The model layer is commoditizing fast — and when an MIT-licensed model
          beats an $11B company, the value in the stack has to be somewhere else.
        </p>

        <p>
          That somewhere else is evaluation, testing, and observability. Three structural shifts
          define the opportunity:
        </p>

        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "28px 28px 12px", margin: "32px 0" }}>
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#10B981", marginTop: 0, marginBottom: "8px" }}>
              1. Open-source reached commercial quality
            </h4>
            <p style={{ margin: 0 }}>
              When Chatterbox beats ElevenLabs and Fish Audio S1 tops TTS-Arena2, the model layer isn't
              where durable value accrues. The value shifts to infrastructure: testing frameworks,
              evaluation standards, observability platforms.
            </p>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#10B981", marginTop: 0, marginBottom: "8px" }}>
              2. Cascaded pipelines aren't going away
            </h4>
            <p style={{ margin: 0 }}>
              S2S models will coexist with STT→LLM→TTS for years because enterprises need
              controllability, debuggability, and compliance guarantees that intermediate text provides.
              Infrastructure that makes the cascade faster, more observable, and more testable has
              durable value.
            </p>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#10B981", marginTop: 0, marginBottom: "8px" }}>
              3. "Can we operate reliably at scale?" is the new question
            </h4>
            <p style={{ margin: 0 }}>
              The industry is moving from "can we build a voice agent?" to "can we operate voice agents
              reliably at scale?" Most teams manually call their agents after each prompt change. Manual
              QA breaks down beyond ~100 daily calls. Voice Arena's Experiments API is the beginning
              of what automated regression testing looks like for voice.
            </p>
          </div>
        </div>

        <Divider />

        {/* ─── Conclusion ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px",
          fontWeight: 500, color: "#f5f5f5", marginTop: 0
        }}>What's next</h2>

        <p>
          Voice Arena is deliberately modular. The evaluation pipeline, the battle interface, and the
          experiments API are independently useful — you can run{" "}
          <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: "3px", fontSize: "15px", fontFamily: "'IBM Plex Mono', monospace" }}>
            voice-evals evaluate audio.wav --groups asr tts
          </code>{" "}
          from the command line without touching the Arena frontend, or use the Experiments API
          without ever interacting with the battle page.
        </p>

        <p>
          Three directions we're actively working on:
        </p>

        <p>
          <strong>MOS prediction at scale.</strong> UTMOS and NISQA are strong but not perfect
          predictors of human preference. We're collecting paired data (automated scores + human
          votes) to train a domain-specific preference model calibrated to real voice AI use cases
          rather than general speech quality. The same data flywheel that made LMArena's rankings
          improve over time will apply here.
        </p>

        <p>
          <strong>Multi-turn agent evaluation.</strong> Current agent metrics evaluate single-turn
          or short dialogue segments. Production voice agents run multi-turn conversations spanning
          5–15 minutes. We're building scenario harnesses that evaluate agent behavior across full
          conversation arcs — tracking how quality degrades (or improves) over extended interactions.
        </p>

        <p>
          <strong>Open leaderboard.</strong> The current leaderboard is populated by our internal
          evaluations. We're opening submissions so any provider can submit their model for evaluation
          against the full scenario battery under controlled conditions — just as LMArena opened its
          platform to every model lab.
        </p>

        <p>
          LMArena proved that evaluation infrastructure becomes essential when the model layer
          commoditizes. Voice AI is at that inflection right now. The models got good. Now someone
          needs to build the roads.
        </p>

        <p>
          Voice Arena is our attempt to build them in the open.
        </p>

        <Divider />

        {/* ─── Footer ─── */}
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#555", lineHeight: 1.8 }}>
          <p style={{ marginBottom: "8px" }}>
            <strong style={{ color: "#888" }}>Technical details:</strong> All system design drawn from
            our implementation documents. Pipeline timings measured on a single NVIDIA A100. ELO
            parameters: K=32, initial rating 1500, matchmaking within 200 ELO. Composite score
            weights configurable per deployment. LMArena data sourced from public filings,
            Wikipedia, and Contrary Research (Sep 2025).
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "#888" }}>About:</strong> KoeCode builds evaluation infrastructure
            for voice AI. The <code>voice_evals</code> pipeline is open-source. Arena frontend,
            backend API, and Experiments API documentation available at koecode.io/arena.
          </p>
        </div>

      </div>
    </div>
  );
}
