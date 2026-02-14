import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, PieChart, Pie,
  ComposedChart, Area
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────────────

const latencyBreakdown = [
  { step: "Audio → Edge", ms: 40, fill: "#6B7280" },
  { step: "Buffering", ms: 30, fill: "#9CA3AF" },
  { step: "Decoding", ms: 25, fill: "#D1D5DB" },
  { step: "STT", ms: 350, fill: "#F59E0B" },
  { step: "LLM", ms: 375, fill: "#EF4444" },
  { step: "TTS", ms: 100, fill: "#3B82F6" },
  { step: "Service hops", ms: 30, fill: "#D1D5DB" },
];

const ttsLatency = [
  { name: "Cartesia Sonic Turbo", ms: 40, fill: "#10B981" },
  { name: "Murf Falcon", ms: 55, fill: "#34D399" },
  { name: "Rime Mist v2", ms: 70, fill: "#6EE7B7" },
  { name: "ElevenLabs Flash v2.5", ms: 75, fill: "#FCD34D" },
  { name: "Cartesia Sonic 3", ms: 90, fill: "#FBBF24" },
  { name: "Hume Octave 2", ms: 100, fill: "#F59E0B" },
  { name: "Deepgram Aura-2", ms: 150, fill: "#F97316" },
];

const fundingData = [
  { name: "ElevenLabs", y2024: 1100, y2025: 3300, y2026: 11000 },
  { name: "Sesame", y2024: 0, y2025: 1000, y2026: 1000 },
  { name: "PolyAI", y2024: 500, y2025: 750, y2026: 750 },
  { name: "Vapi", y2024: 0, y2025: 130, y2026: 130 },
  { name: "Cartesia", y2024: 27, y2025: 100, y2026: 100 },
];

const productionVsDemo = [
  { metric: "Demo latency\n(avg)", demo: 450, production: 0 },
  { metric: "Production latency\n(median)", demo: 0, production: 1550 },
  { metric: "Human\nthreshold", demo: 0, production: 0, human: 250 },
];

const realWorldGaps = [
  { problem: "Emotion recognition", lab: 92, realWorld: 67 },
  { problem: "Long-term memory", lab: 100, realWorld: 44 },
  { problem: "Code-switched ASR", lab: 85, realWorld: 68 },
  { problem: "Telephony WER", lab: 5.6, realWorld: 30 },
];

// ── Custom Tooltip ────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, suffix = "ms" }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "13px",
        color: "#e5e5e5",
        fontFamily: "'IBM Plex Mono', monospace"
      }}>
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{label || payload[0]?.payload?.name}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ margin: 0, color: entry.color || entry.fill || "#10B981" }}>
            {entry.name || entry.dataKey}: {entry.value}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ── Chart Components ──────────────────────────────────────────────────────

function LatencyWaterfall() {
  const total = latencyBreakdown.reduce((s, d) => s + d.ms, 0);
  let cumulative = 0;
  const waterfallData = latencyBreakdown.map(d => {
    const start = cumulative;
    cumulative += d.ms;
    return { ...d, start, end: cumulative, pct: ((d.ms / total) * 100).toFixed(0) };
  });

  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "#888",
        marginBottom: "6px"
      }}>
        Figure 1
      </div>
      <h3 style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: "20px",
        fontWeight: 500,
        color: "#e5e5e5",
        marginTop: 0,
        marginBottom: "4px"
      }}>
        Where 1,100ms goes in a typical voice agent pipeline
      </h3>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        color: "#777",
        marginBottom: "20px"
      }}>
        Unoptimized mouth-to-ear latency breakdown. Source: Twilio, Nov 2025. The LLM alone accounts for 34% of total time.
      </p>

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={waterfallData} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1000]}
            tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={{ stroke: '#333' }}
            tickLine={{ stroke: '#333' }}
            label={{ value: "Cumulative latency (ms)", position: "insideBottom", offset: -5, style: { fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}}
          />
          <YAxis
            dataKey="step"
            type="category"
            width={100}
            tick={{ fill: '#999', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Invisible offset */}
          <Bar dataKey="start" stackId="a" fill="transparent" />
          <Bar dataKey="ms" stackId="a" radius={[0, 4, 4, 0]}>
            {waterfallData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{
        display: "flex",
        gap: "16px",
        justifyContent: "center",
        marginTop: "12px",
        flexWrap: "wrap"
      }}>
        {[
          { color: "#EF4444", label: "LLM (375ms, 34%)" },
          { color: "#F59E0B", label: "STT (350ms, 32%)" },
          { color: "#3B82F6", label: "TTS (100ms, 9%)" },
          { color: "#9CA3AF", label: "Network/infra (125ms, 25%)" },
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

function TTSLatencyChart() {
  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "#888",
        marginBottom: "6px"
      }}>
        Figure 2
      </div>
      <h3 style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: "20px",
        fontWeight: 500,
        color: "#e5e5e5",
        marginTop: 0,
        marginBottom: "4px"
      }}>
        TTS time-to-first-byte across production providers
      </h3>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        color: "#777",
        marginBottom: "20px"
      }}>
        Lower is better. SSM-based architectures (Cartesia) lead; human conversational threshold is ~200ms total pipeline.
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={ttsLatency} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 180]}
            tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={{ stroke: '#333' }}
            tickLine={{ stroke: '#333' }}
            label={{ value: "TTFB (ms)", position: "insideBottom", offset: -5, style: { fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={170}
            tick={{ fill: '#999', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="ms" radius={[0, 4, 4, 0]} barSize={22}>
            {ttsLatency.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FundingChart() {
  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "#888",
        marginBottom: "6px"
      }}>
        Figure 3
      </div>
      <h3 style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: "20px",
        fontWeight: 500,
        color: "#e5e5e5",
        marginTop: 0,
        marginBottom: "4px"
      }}>
        Voice AI valuations: 2024 → 2026
      </h3>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        color: "#777",
        marginBottom: "20px"
      }}>
        ElevenLabs 10×'d in two years. Valuations in $M. Total VC into voice AI: $315M (2022) → $2.1B (2024) → accelerating.
      </p>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={fundingData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#999', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={{ stroke: '#333' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={{ stroke: '#333' }}
            tickLine={{ stroke: '#333' }}
            label={{ value: "Valuation ($M)", angle: -90, position: "insideLeft", style: { fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}}
          />
          <Tooltip content={<CustomTooltip suffix="M" />} />
          <Legend
            wrapperStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}
          />
          <Bar dataKey="y2024" name="Jan 2024" fill="#374151" radius={[2, 2, 0, 0]} />
          <Bar dataKey="y2025" name="Jan 2025" fill="#6B7280" radius={[2, 2, 0, 0]} />
          <Bar dataKey="y2026" name="Feb 2026" fill="#10B981" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LabVsRealWorldChart() {
  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "#888",
        marginBottom: "6px"
      }}>
        Figure 4
      </div>
      <h3 style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: "20px",
        fontWeight: 500,
        color: "#e5e5e5",
        marginTop: 0,
        marginBottom: "4px"
      }}>
        Lab performance vs. production reality
      </h3>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        color: "#777",
        marginBottom: "20px"
      }}>
        Emotion recognition accuracy (%), memory retention (% of human baseline), code-switched ASR accuracy (%),
        and telephony WER (%, lower is better — inverted for readability).
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={realWorldGaps}
          margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="problem"
            tick={{ fill: '#999', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={{ stroke: '#333' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#666', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
            axisLine={{ stroke: '#333' }}
            tickLine={{ stroke: '#333' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip suffix="%" />} />
          <Legend wrapperStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }} />
          <Bar dataKey="lab" name="Lab / benchmark" fill="#3B82F6" radius={[3, 3, 0, 0]} barSize={28} />
          <Bar dataKey="realWorld" name="Real-world production" fill="#EF4444" radius={[3, 3, 0, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Diagram 1: Cascaded Production Pipeline ──────────────────────────────

function CascadedPipelineDiagram() {
  const font = "'IBM Plex Mono', monospace";
  const serif = "'Newsreader', Georgia, serif";

  // Reusable arrow with optional label
  const Arrow = ({ x1, y1, x2, y2, label, labelY, dashed }) => (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#888"
        strokeWidth="1.2"
        strokeDasharray={dashed ? "4,3" : "none"}
        markerEnd="url(#arrowHead)"
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={labelY || ((y1 + y2) / 2 - 8)}
          textAnchor="middle"
          fill="#F59E0B"
          fontSize="10"
          fontFamily={font}
          fontWeight="500"
        >
          {label}
        </text>
      )}
    </g>
  );

  // Reusable box
  const Box = ({ x, y, w, h, label, sublabel, fill = "none", stroke = "#555", textColor = "#ddd", fontSize = 12 }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <text x={x + w / 2} y={y + (sublabel ? h / 2 - 5 : h / 2 + 1)} textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize={fontSize} fontFamily={font} fontWeight="500">{label}</text>
      {sublabel && (
        <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" dominantBaseline="middle"
          fill="#888" fontSize="9.5" fontFamily={font}>{sublabel}</text>
      )}
    </g>
  );

  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        fontFamily: font, fontSize: "11px", textTransform: "uppercase",
        letterSpacing: "1.5px", color: "#888", marginBottom: "6px"
      }}>Figure 5</div>
      <h3 style={{
        fontFamily: serif, fontSize: "20px", fontWeight: 500,
        color: "#e5e5e5", marginTop: 0, marginBottom: "4px"
      }}>
        Production cascaded voice agent architecture
      </h3>
      <p style={{
        fontFamily: font, fontSize: "12px", color: "#777", marginBottom: "20px"
      }}>
        Seven-layer pipeline from user speech to agent response. Latency annotations on each transition.
        Dashed outline indicates observability layer — absent or fragmented in most deployments.
      </p>

      <div style={{
        background: "#111",
        border: "1px solid #252525",
        borderRadius: "6px",
        padding: "16px 8px",
        overflowX: "auto"
      }}>
        <svg viewBox="0 0 780 520" width="100%" style={{ maxWidth: "780px", display: "block", margin: "0 auto" }}>
          <defs>
            <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#888" />
            </marker>
          </defs>

          {/* ── Observability layer (dashed) ── */}
          <rect x="60" y="12" width="660" height="496" rx="6"
            fill="none" stroke="#333" strokeWidth="1.2" strokeDasharray="6,4" />
          <text x="390" y="32" textAnchor="middle" fill="#555" fontSize="10"
            fontFamily={font} fontStyle="italic" letterSpacing="1">
            OBSERVABILITY &amp; EVALUATION LAYER — largely absent in production
          </text>

          {/* ── Telephony Layer ── */}
          <rect x="80" y="44" width="620" height="62" rx="4"
            fill="#141414" stroke="#2a2a2a" strokeWidth="1" />
          <text x="390" y="60" textAnchor="middle" fill="#666" fontSize="9.5"
            fontFamily={font} letterSpacing="0.8">TELEPHONY LAYER</text>

          <Box x={100} y={65} w={120} h={32} label="SIP / WebRTC" sublabel="" fill="#1a1a1a" stroke="#444" textColor="#aaa" fontSize={11} />
          <Box x={240} y={65} w={100} h={32} label="8kHz G.711" sublabel="" fill="#1a1a1a" stroke="#444" textColor="#aaa" fontSize={10} />

          {/* Transcode arrow */}
          <Arrow x1={340} y1={81} x2={380} y2={81} label="" />

          <Box x={382} y={65} w={100} h={32} label="16kHz PCM" sublabel="" fill="#1a1a1a" stroke="#444" textColor="#aaa" fontSize={10} />
          <text x={365} y={102} textAnchor="middle" fill="#F97316" fontSize="9" fontFamily={font}>transcode</text>

          <Box x={502} y={65} w={180} h={32} label="Twilio / Telnyx / PSTN" sublabel="" fill="#1a1a1a" stroke="#444" textColor="#aaa" fontSize={10} />

          {/* ── User Input ── */}
          <Box x={100} y={130} w={120} h={44} label="User Speech" sublabel="raw audio stream" fill="#1a1a1a" stroke="#555" />

          {/* Arrow: User → STT */}
          <Arrow x1={220} y1={152} x2={280} y2={152} label="~40ms" labelY={143} />

          {/* ── STT Block ── */}
          <rect x="280" y="120" width="160" height="64" rx="4" fill="#1c1708" stroke="#F59E0B" strokeWidth="1.2" />
          <text x="360" y="142" textAnchor="middle" fill="#F59E0B" fontSize="12" fontFamily={font} fontWeight="600">STT / ASR</text>
          <text x="360" y="157" textAnchor="middle" fill="#b38a20" fontSize="9.5" fontFamily={font}>Deepgram Nova-3</text>
          <text x="360" y="170" textAnchor="middle" fill="#b38a20" fontSize="9.5" fontFamily={font}>Whisper / Ink / Chirp</text>

          {/* Key internal processes */}
          <Box x={100} y={200} w={120} h={32} label="Endpointing" sublabel="" fill="#141414" stroke="#444" textColor="#999" fontSize={10} />
          <text x="160" y="245" textAnchor="middle" fill="#666" fontSize="9" fontFamily={font}>VAD + ML turn detection</text>

          {/* Arrow: STT → Partial transcript */}
          <Arrow x1={360} y1={184} x2={360} y2={210} label="" />

          <Box x={290} y={210} w={140} h={28} label="Streaming transcript" sublabel="" fill="#141414" stroke="#444" textColor="#aaa" fontSize={10} />

          {/* Arrow: Transcript → LLM */}
          <Arrow x1={360} y1={238} x2={360} y2={270} label="~350ms cumulative" labelY={258} />

          {/* ── Orchestration Layer ── */}
          <rect x="90" y="265" width="600" height="130" rx="4"
            fill="#0f1110" stroke="#2a3a2a" strokeWidth="1" />
          <text x="390" y="283" textAnchor="middle" fill="#555" fontSize="9.5"
            fontFamily={font} letterSpacing="0.8">ORCHESTRATION — Vapi / Retell / Bland / Custom</text>

          {/* ── LLM Block ── */}
          <rect x="260" y="290" width="200" height="64" rx="4" fill="#1a0f0f" stroke="#EF4444" strokeWidth="1.2" />
          <text x="360" y="312" textAnchor="middle" fill="#EF4444" fontSize="12" fontFamily={font} fontWeight="600">LLM Reasoning</text>
          <text x="360" y="327" textAnchor="middle" fill="#b04040" fontSize="9.5" fontFamily={font}>GPT-4o / Claude / Gemini / Llama</text>
          <text x="360" y="340" textAnchor="middle" fill="#b04040" fontSize="9.5" fontFamily={font}>+ function calling + RAG</text>

          {/* Tool use branch */}
          <Arrow x1={460} y1={322} x2={530} y2={322} label="" dashed />
          <Box x={532} y={306} w={140} h={32} label="Tools / APIs" sublabel="" fill="#141414" stroke="#444" textColor="#999" fontSize={10} />
          <text x="602" y="348" textAnchor="middle" fill="#666" fontSize="9" fontFamily={font}>CRM, booking, payments</text>

          {/* Context/memory branch */}
          <Arrow x1={260} y1={322} x2={200} y2={322} label="" dashed />
          <Box x={100} y={306} w={100} h={32} label="Memory" sublabel="" fill="#141414" stroke="#444" textColor="#999" fontSize={10} />
          <text x="150" y="348" textAnchor="middle" fill="#666" fontSize="9" fontFamily={font}>RAG / vector store</text>

          {/* Arrow: LLM → streaming text */}
          <Arrow x1={360} y1={354} x2={360} y2={378} label="" />

          <Box x={290} y={378} w={140} h={28} label="Streaming text tokens" sublabel="" fill="#141414" stroke="#444" textColor="#aaa" fontSize={10} />

          {/* Arrow: text → TTS */}
          <Arrow x1={360} y1={406} x2={360} y2={430} label="~375ms to first token" labelY={422} />

          {/* ── TTS Block ── */}
          <rect x="280" y="432" width="160" height="64" rx="4" fill="#0a1a14" stroke="#3B82F6" strokeWidth="1.2" />
          <text x="360" y="454" textAnchor="middle" fill="#3B82F6" fontSize="12" fontFamily={font} fontWeight="600">TTS Synthesis</text>
          <text x="360" y="469" textAnchor="middle" fill="#2a6ab0" fontSize="9.5" fontFamily={font}>Cartesia Sonic / ElevenLabs</text>
          <text x="360" y="482" textAnchor="middle" fill="#2a6ab0" fontSize="9.5" fontFamily={font}>Rime / Deepgram Aura</text>

          {/* Arrow: TTS → Agent output */}
          <Arrow x1={440} y1={464} x2={530} y2={464} label="~100ms TTFB" labelY={455} />

          <Box x={540} y={442} w={120} h={44} label="Agent Speech" sublabel="audio stream out" fill="#1a1a1a" stroke="#555" />

          {/* ── Total latency annotation ── */}
          <line x1={690} y1={140} x2={690} y2={475} stroke="#EF4444" strokeWidth="1" strokeDasharray="3,3" />
          <text x={698} y={300} fill="#EF4444" fontSize="10" fontFamily={font} fontWeight="500"
            transform="rotate(90, 698, 300)" textAnchor="middle">
            ~950–1,700ms mouth-to-ear
          </text>

        </svg>
      </div>
    </div>
  );
}


// ── Diagram 2: Three Architectural Approaches ─────────────────────────────

function ThreeArchitecturesDiagram() {
  const font = "'IBM Plex Mono', monospace";
  const serif = "'Newsreader', Georgia, serif";

  const SmallBox = ({ x, y, w, h, label, fill = "none", stroke = "#555", textColor = "#ccc", fontSize = 10.5 }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2.5" fill={fill} stroke={stroke} strokeWidth="1" />
      <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize={fontSize} fontFamily={font} fontWeight="500">{label}</text>
    </g>
  );

  const SmallArrow = ({ x1, y1, x2, y2, label, color = "#888" }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" markerEnd="url(#sa)" />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle"
          fill="#F59E0B" fontSize="9" fontFamily={font}>{label}</text>
      )}
    </g>
  );

  // Tradeoff row
  const TradeoffRow = ({ x, y, label, cascade, s2s, half }) => (
    <g>
      <text x={x} y={y} fill="#888" fontSize="9.5" fontFamily={font}>{label}</text>
      <text x={x + 118} y={y} fill={cascade === "High" || cascade === "Yes" ? "#10B981" : cascade === "Low" || cascade === "No" ? "#EF4444" : "#F59E0B"} fontSize="9.5" fontFamily={font} textAnchor="middle">{cascade}</text>
      <text x={x + 235} y={y} fill={s2s === "High" || s2s === "Yes" ? "#10B981" : s2s === "Low" || s2s === "No" ? "#EF4444" : "#F59E0B"} fontSize="9.5" fontFamily={font} textAnchor="middle">{s2s}</text>
      <text x={x + 355} y={y} fill={half === "High" || half === "Yes" ? "#10B981" : half === "Low" || half === "No" ? "#EF4444" : "#F59E0B"} fontSize="9.5" fontFamily={font} textAnchor="middle">{half}</text>
    </g>
  );

  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        fontFamily: font, fontSize: "11px", textTransform: "uppercase",
        letterSpacing: "1.5px", color: "#888", marginBottom: "6px"
      }}>Figure 6</div>
      <h3 style={{
        fontFamily: serif, fontSize: "20px", fontWeight: 500,
        color: "#e5e5e5", marginTop: 0, marginBottom: "4px"
      }}>
        Three competing voice AI architectures
      </h3>
      <p style={{
        fontFamily: font, fontSize: "12px", color: "#777", marginBottom: "20px"
      }}>
        (a) Cascaded: dominant in production. (b) End-to-end S2S: lowest latency, limited controllability.
        (c) Half-cascade: the emerging compromise. Tradeoff matrix below.
      </p>

      <div style={{
        background: "#111",
        border: "1px solid #252525",
        borderRadius: "6px",
        padding: "16px 8px",
        overflowX: "auto"
      }}>
        <svg viewBox="0 0 780 460" width="100%" style={{ maxWidth: "780px", display: "block", margin: "0 auto" }}>
          <defs>
            <marker id="sa" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
              <polygon points="0 0, 6 2.5, 0 5" fill="#888" />
            </marker>
          </defs>

          {/* ── Column headers ── */}
          <text x="130" y="24" textAnchor="middle" fill="#e5e5e5" fontSize="12" fontFamily={font} fontWeight="600">(a) Cascaded Pipeline</text>
          <text x="130" y="40" textAnchor="middle" fill="#666" fontSize="9.5" fontFamily={font}>Vapi, Retell, Bland, PolyAI</text>

          <text x="400" y="24" textAnchor="middle" fill="#e5e5e5" fontSize="12" fontFamily={font} fontWeight="600">(b) End-to-End S2S</text>
          <text x="400" y="40" textAnchor="middle" fill="#666" fontSize="9.5" fontFamily={font}>Moshi, GPT-4o, Gemini Live</text>

          <text x="655" y="24" textAnchor="middle" fill="#e5e5e5" fontSize="12" fontFamily={font} fontWeight="600">(c) Half-Cascade</text>
          <text x="655" y="40" textAnchor="middle" fill="#666" fontSize="9.5" fontFamily={font}>Emerging compromise</text>

          {/* ── Vertical separators ── */}
          <line x1="265" y1="12" x2="265" y2="290" stroke="#252525" strokeWidth="1" strokeDasharray="4,3" />
          <line x1="525" y1="12" x2="525" y2="290" stroke="#252525" strokeWidth="1" strokeDasharray="4,3" />

          {/* ════════════════════════════════════════════════════
              (a) CASCADED PIPELINE
              ════════════════════════════════════════════════════ */}

          {/* Audio in */}
          <SmallBox x={70} y={58} w={120} h={28} label="Audio Input" fill="#141414" stroke="#555" />

          {/* STT */}
          <SmallArrow x1={130} y1={86} x2={130} y2={105} label="~350ms" />
          <SmallBox x={70} y={107} w={120} h={32} label="STT" fill="#1c1708" stroke="#F59E0B" textColor="#F59E0B" />
          <text x="130" y="152" textAnchor="middle" fill="#666" fontSize="8.5" fontFamily={font}>audio → text</text>

          {/* LLM */}
          <SmallArrow x1={130} y1={155} x2={130} y2={170} label="~375ms" />
          <SmallBox x={70} y={172} w={120} h={32} label="LLM" fill="#1a0f0f" stroke="#EF4444" textColor="#EF4444" />
          <text x="130" y="217" textAnchor="middle" fill="#666" fontSize="8.5" fontFamily={font}>text → text</text>

          {/* TTS */}
          <SmallArrow x1={130} y1={220} x2={130} y2={233} label="~100ms" />
          <SmallBox x={70} y={235} w={120} h={32} label="TTS" fill="#0a1a14" stroke="#3B82F6" textColor="#3B82F6" />
          <text x="130" y="280" textAnchor="middle" fill="#666" fontSize="8.5" fontFamily={font}>text → audio</text>

          {/* Text intermediary annotation */}
          <rect x="198" y="118" width="55" height="138" rx="2" fill="none" stroke="#444" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x="226" y="192" textAnchor="middle" fill="#555" fontSize="8" fontFamily={font} transform="rotate(90, 226, 192)">text layer</text>

          {/* Total */}
          <text x="130" y="292" textAnchor="middle" fill="#EF4444" fontSize="10" fontFamily={font} fontWeight="500">Total: 800–1,700ms</text>


          {/* ════════════════════════════════════════════════════
              (b) END-TO-END S2S
              ════════════════════════════════════════════════════ */}

          {/* Audio in */}
          <SmallBox x={340} y={58} w={120} h={28} label="Audio Input" fill="#141414" stroke="#555" />

          {/* Single unified model */}
          <SmallArrow x1={400} y1={86} x2={400} y2={105} />

          <rect x="315" y="107" width="170" height="110" rx="4" fill="#12101a" stroke="#8B5CF6" strokeWidth="1.2" />
          <text x="400" y="132" textAnchor="middle" fill="#8B5CF6" fontSize="11.5" fontFamily={font} fontWeight="600">Unified Model</text>
          <text x="400" y="150" textAnchor="middle" fill="#7c4dcc" fontSize="9" fontFamily={font}>audio tokens in</text>
          <text x="400" y="164" textAnchor="middle" fill="#7c4dcc" fontSize="9" fontFamily={font}>↓ reasoning ↓</text>
          <text x="400" y="178" textAnchor="middle" fill="#7c4dcc" fontSize="9" fontFamily={font}>audio tokens out</text>

          {/* Inner monologue annotation */}
          <SmallBox x={340} y={192} w={120} h={18} label="(inner monologue)" fill="none" stroke="none" textColor="#555" fontSize={8.5} />

          {/* Audio out */}
          <SmallArrow x1={400} y1={217} x2={400} y2={240} />
          <SmallBox x={340} y={242} w={120} h={28} label="Audio Output" fill="#141414" stroke="#555" />

          {/* No text intermediary annotation */}
          <text x="497" y="165" fill="#EF4444" fontSize="8.5" fontFamily={font}>no text</text>
          <text x="497" y="177" fill="#EF4444" fontSize="8.5" fontFamily={font}>intermediary</text>

          {/* Total */}
          <text x="400" y="292" textAnchor="middle" fill="#10B981" fontSize="10" fontFamily={font} fontWeight="500">Total: 160–300ms</text>


          {/* ════════════════════════════════════════════════════
              (c) HALF-CASCADE
              ════════════════════════════════════════════════════ */}

          {/* Audio in */}
          <SmallBox x={595} y={58} w={120} h={28} label="Audio Input" fill="#141414" stroke="#555" />

          {/* Native audio understanding */}
          <SmallArrow x1={655} y1={86} x2={655} y2={105} />

          <rect x="580" y="107" width="150" height="42" rx="3" fill="#12101a" stroke="#8B5CF6" strokeWidth="1" />
          <text x="655" y="125" textAnchor="middle" fill="#8B5CF6" fontSize="10" fontFamily={font} fontWeight="500">Native Audio Input</text>
          <text x="655" y="139" textAnchor="middle" fill="#7c4dcc" fontSize="8.5" fontFamily={font}>preserves tone, emotion</text>

          {/* LLM reasoning in text */}
          <SmallArrow x1={655} y1={149} x2={655} y2={168} />

          <SmallBox x={595} y={170} w={120} h={32} label="LLM (text)" fill="#1a0f0f" stroke="#EF4444" textColor="#EF4444" />
          <text x="655" y="215" textAnchor="middle" fill="#666" fontSize="8.5" fontFamily={font}>text reasoning + tools</text>

          {/* TTS */}
          <SmallArrow x1={655} y1={220} x2={655} y2={235} />
          <SmallBox x={595} y={237} w={120} h={32} label="TTS" fill="#0a1a14" stroke="#3B82F6" textColor="#3B82F6" />

          {/* Text intermediary (partial) */}
          <rect x="723" y="176" width="45" height="84" rx="2" fill="none" stroke="#444" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x="746" y="222" textAnchor="middle" fill="#555" fontSize="8" fontFamily={font} transform="rotate(90, 746, 222)">text layer</text>

          {/* Total */}
          <text x="655" y="292" textAnchor="middle" fill="#F59E0B" fontSize="10" fontFamily={font} fontWeight="500">Total: 300–600ms</text>

          {/* ════════════════════════════════════════════════════
              TRADEOFF MATRIX
              ════════════════════════════════════════════════════ */}

          <line x1="60" y1="310" x2="720" y2="310" stroke="#333" strokeWidth="1" />

          <text x="390" y="332" textAnchor="middle" fill="#e5e5e5" fontSize="12" fontFamily={font} fontWeight="600">
            Architecture Tradeoff Matrix
          </text>

          {/* Column headers */}
          <text x="260" y="356" fill="#999" fontSize="10" fontFamily={font} textAnchor="middle" fontWeight="600">Cascaded</text>
          <text x="390" y="356" fill="#999" fontSize="10" fontFamily={font} textAnchor="middle" fontWeight="600">S2S</text>
          <text x="520" y="356" fill="#999" fontSize="10" fontFamily={font} textAnchor="middle" fontWeight="600">Half-Cascade</text>

          <line x1="100" y1="363" x2="580" y2="363" stroke="#252525" strokeWidth="0.8" />

          {/* Row: Latency */}
          <TradeoffRow x={110} y={380} label="Latency" cascade="High" s2s="Low" half="Medium" />
          <line x1="100" y1="388" x2="580" y2="388" stroke="#1a1a1a" strokeWidth="0.5" />

          {/* Row: Debuggability */}
          <TradeoffRow x={110} y={404} label="Debuggable" cascade="Yes" s2s="No" half="Yes" />
          <line x1="100" y1="412" x2="580" y2="412" stroke="#1a1a1a" strokeWidth="0.5" />

          {/* Row: Function calling */}
          <TradeoffRow x={110} y={428} label="Tool use" cascade="Yes" s2s="Limited" half="Yes" />
          <line x1="100" y1="436" x2="580" y2="436" stroke="#1a1a1a" strokeWidth="0.5" />

          {/* Row: Compliance */}
          <TradeoffRow x={110} y={452} label="Audit trail" cascade="Yes" s2s="No" half="Yes" />

        </svg>
      </div>
    </div>
  );
}



function Divider() {
  return (
    <div style={{
      width: "100%",
      height: "1px",
      background: "linear-gradient(90deg, transparent, #333, transparent)",
      margin: "48px 0"
    }} />
  );
}

// ── Main Blog ─────────────────────────────────────────────────────────────

export default function VoiceAIBlog() {
  return (
    <div style={{
      background: "#0d0d0d",
      color: "#d4d4d4",
      minHeight: "100vh",
      fontFamily: "'Newsreader', Georgia, serif",
      fontSize: "17px",
      lineHeight: 1.75
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: "740px", margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#10B981",
            marginBottom: "16px"
          }}>
            Technical Research · February 2026
          </div>

          <h1 style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: "clamp(32px, 5vw, 46px)",
            fontWeight: 400,
            lineHeight: 1.15,
            color: "#f5f5f5",
            margin: 0,
            letterSpacing: "-0.02em"
          }}>
            Voice AI in 2026: What's Actually Working, What's Still Broken, and Where to Build
          </h1>

          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "13px",
            color: "#666",
            marginTop: "20px"
          }}>
            BaseThesis · ~25 min read
          </p>
        </div>

        <Divider />

        {/* ─── Introduction ─── */}

        <p>
          Here's the thing about voice AI demos: they all sound great. A smooth voice, a sub-second reply,
          a clean transcript. You leave the demo thinking "this is ready." Then you deploy it on actual
          phone lines, with actual humans, in actual noisy environments — and the illusion falls apart.
        </p>

        <p>
          We spent the last few months digging into the entire voice AI stack. Not as model builders — we're
          not training STT or TTS models. Not as voice agent builders — we're not competing with Vapi or
          Retell. We went in as infrastructure researchers trying to answer one question: <em>where is this
          space actually at, technically, and what's missing?</em>
        </p>

        <p>
          What we found is a field that has made genuinely stunning progress on the model layer — TTS
          latency dropped from 2–3 seconds to 40ms in under two years, open-source models now beat
          commercial ones in blind tests, and end-to-end speech-to-speech models can hold a conversation
          at 160ms latency. But around those models, the infrastructure is thin. There's no standardized
          way to test voice agents. No unified observability. No agreed-upon benchmarks. The gap between
          "it works in a demo" and "it works on a million phone calls" is enormous, and almost nobody is
          building the tools to close it.
        </p>

        <p>
          This post is our attempt to lay out what we learned. The full technology stack, where the latency
          actually goes, who's building what, the problems that remain stubbornly unsolved, and where we
          think the real infrastructure opportunities are.
        </p>

        <Divider />

        {/* ─── Section 1: The Pipeline ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          How a voice agent actually works
        </h2>

        <p>
          Before getting into what's broken, it helps to understand what the pipeline looks like. Most
          production voice agents today use what's called the <strong>cascaded architecture</strong>:
          Speech-to-Text → LLM → Text-to-Speech. User speaks, audio gets transcribed, the transcript
          goes to a language model, the model's text output gets converted back to speech.
        </p>

        <p>
          There's also an emerging alternative: <strong>speech-to-speech (S2S)</strong> models that skip the
          text intermediary entirely. GPT-4o's voice mode, Kyutai's Moshi, and Google's Gemini Live all work
          this way. These achieve much lower latency — Moshi's theoretical minimum is 160ms — but they give
          up something critical: controllability. When there's no text in the middle, you can't easily debug
          what the model "thought," you can't enforce compliance rules, and you can't do function calling
          in a way enterprises trust. That's why the cascaded pipeline isn't going away. It's getting augmented,
          not replaced.
        </p>

        <p>
          Either way, the pipeline sits on top of a telephony layer (Twilio, Telnyx, or WebRTC) that connects
          the AI to actual phone networks. And on top of all of this, there should be an evaluation and
          observability layer — though, as we'll get into, this barely exists.
        </p>

        <p>
          Figure 5 shows the full production architecture. The key thing to notice is how many boundaries
          audio has to cross — each one adds latency and is a potential point of failure. Also notice the
          dashed line around the observability layer. That's intentional. For most deployments, it's
          either absent or stitched together from fragments.
        </p>

        <CascadedPipelineDiagram />

        <Divider />

        {/* ─── Section 2: Latency ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          Where the latency actually goes
        </h2>

        <p>
          The most common complaint about voice agents is that they feel slow. A human conversation has
          a response gap of about 200–300ms — this is remarkably consistent across languages and cultures.
          The median production voice agent today delivers 1,400–1,700ms. That's 5–7× slower than a human.
          You feel every one of those extra milliseconds.
        </p>

        <p>
          Twilio published a detailed latency breakdown in November 2025 that's worth studying.
          In an unoptimized configuration, the total mouth-to-ear latency is roughly 1,100ms,
          distributed as follows:
        </p>

        <LatencyWaterfall />

        <p>
          The surprising finding: <strong>TTS is no longer the bottleneck.</strong> It used to be —
          two years ago, generating speech took 2–3 seconds. Today, Cartesia's Sonic Turbo does it in 40ms.
          ElevenLabs Flash hits 75ms. The bottleneck has shifted decisively to the LLM, which eats
          350ms–1s+ depending on model and prompt complexity. STT comes second at ~350ms.
        </p>

        <p>
          The most impactful optimization isn't faster models — it's <strong>colocation</strong>. Every time
          audio crosses from one provider's servers to another, you pay 30–100ms in network latency. An
          unoptimized pipeline might cross three provider boundaries (STT provider → LLM provider → TTS
          provider). Telnyx and Together AI specifically market colocation — running the entire pipeline on
          the same GPU cluster — and optimized deployments using this approach achieve ~465–600ms total,
          getting within striking distance of conversational.
        </p>

        <Divider />

        {/* ─── Section 3: Model Layer ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          The model layer: faster than you think, and rapidly commoditizing
        </h2>

        <p>
          The TTS landscape in particular has gotten remarkably competitive. A year ago, ElevenLabs had a
          clear lead. Today, at least six providers offer production-grade TTS under 100ms:
        </p>

        <TTSLatencyChart />

        <p>
          But here's what matters more than the horse race: <strong>open-source TTS models now beat commercial
          ones</strong>. Resemble AI's Chatterbox (MIT license, 350M parameters) scored 63.75% user preference
          over ElevenLabs in blind evaluations. Fish Audio's OpenAudio S1 (Apache 2.0, 4B parameters, trained
          with RLHF) hit #1 on TTS-Arena2 with a WER of 0.008. Alibaba's Qwen3-TTS offers 97ms first-packet
          latency, fully self-hostable.
        </p>

        <p>
          On the STT side, the picture is similar. Deepgram Nova-3 achieved a 54.3% streaming WER
          reduction vs. competitors and was the first model to support real-time code-switching across
          10 languages. Their Nova-3 Medical variant hits 3.44% median WER in healthcare — 63.7% better
          than the next competitor. Cartesia's Ink-Whisper optimized Whisper specifically for real-time
          conversational transcription, hitting 66ms median time-to-complete-transcript.
        </p>

        <p>
          The S2S space is where the truly novel architectures live. Kyutai's Moshi models two parallel audio
          streams simultaneously — it can listen while it speaks, just like a human — using a dual-stream
          architecture with a 7B Temporal Transformer. Their "Inner Monologue" technique (predicting text
          tokens aligned with audio) improved question-answering accuracy from 9% to 26.6%. NVIDIA's
          PersonaPlex-7B extends Moshi with customizable personas at 170ms turn-taking latency. And Sesame's
          CSM, in human evaluations without conversational context, was rated indistinguishable from real
          human speech. Naturalness has saturated. The remaining gap is contextual appropriateness.
        </p>

        <p>
          Figure 6 lays out the three competing architectures side by side. The tradeoffs are stark —
          latency vs. controllability is the fundamental tension, and the half-cascade is the emerging
          compromise most production systems are converging toward.
        </p>

        <ThreeArchitecturesDiagram />

        <p>
          The implication of all this for infrastructure builders is clear: <strong>the model layer is
          commoditizing fast.</strong> When an MIT-licensed model beats a $11B company in blind tests, the
          value in the stack has to be somewhere else.
        </p>

        <Divider />

        {/* ─── Section 4: Funding ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          Where the money is going
        </h2>

        <p>
          The funding trajectory tells a clear story. Total VC into voice AI went from $315M in 2022
          to ~$2.1B in 2024 — a 7× increase. 22% of YC's latest batch is building voice-first products,
          up 70% from early 2024. And the valuations at the top are striking:
        </p>

        <FundingChart />

        <p>
          ElevenLabs went from $1.1B (January 2024) to $11B (February 2026) — a 10× in two years, with
          $330M+ ARR. Deepgram raised a $130M Series C in January 2026. Sesame raised $250M at ~$1B+.
          Meta acquired PlayAI in July 2025 for wearable voice capabilities. Gradium raised a $70M seed
          from Balderton and Index in December 2025.
        </p>

        <p>
          Some of the most strategically interesting companies are the infrastructure players. Telnyx owns
          its private IP backbone and colocates GPU inference at telecom PoPs — $0.09/min all-inclusive
          for voice AI. BaseTen ($75M+ raised) runs GPU inference for Bland AI (sub-400ms end-to-end) and
          Rime (p99 under 300ms). Together AI now offers serverless open-source TTS hosting — Kokoro at
          97ms TTFB, co-located with LLMs.
        </p>

        <Divider />

        {/* ─── Section 5: Indian/Multilingual ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          The multilingual frontier (and why India matters)
        </h2>

        <p>
          Here's a fact that doesn't get enough attention: code-switching — mixing languages mid-sentence,
          like Hindi-English or Spanglish — is the default mode of communication for billions of people. But
          most production ASR systems fall apart when they encounter it. Baseline WER on Indian code-switched
          speech is 30–32%. GPT-5 still struggles with basic Singlish.
        </p>

        <p>
          Sarvam AI ($53.8M raised, India's first government-backed AI lab) is doing some of the most
          important work here. Their Saaras V3 STT, trained on 1M+ hours of multilingual Indian audio,
          achieves ~19.3% WER across the top-10 IndicVoices languages — and it beats Gemini 3 Pro, GPT-4o
          Transcribe, Deepgram Nova-3, and ElevenLabs Scribe v2 on Indian languages specifically. Their
          Bulbul V3 TTS won blind A/B tests across all 11 supported Indian languages.
        </p>

        <p>
          The underlying problem is data. Hindi Common Voice started with 0.5 hours of training data.
          English had 2,186 hours. That's a 4,372× gap. And it's not just Hindi — most of the world's
          languages face similar scarcity. The CS-FLEURS dataset (Interspeech 2025) covering 52 languages
          and 113 code-switched pairs is a start, but the infrastructure for curating, cleaning, and
          distributing multilingual voice training data at scale doesn't exist.
        </p>

        <Divider />

        {/* ─── Section 6: Unsolved Problems ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          The problems nobody has solved yet
        </h2>

        <p>
          The models are getting good. But good models on bad infrastructure produce bad experiences.
          Here's what's still broken, with the lab-vs-production gaps to prove it:
        </p>

        <LabVsRealWorldChart />

        <p>
          <strong>Full-duplex conversation is functionally unsolved.</strong> Humans talk over each other
          constantly — interruptions, backchannels ("mm-hmm"), overlapping speech. Moshi and PersonaPlex
          technically support this, but NVIDIA's own FullDuplexBench-v2 (October 2025) found that current
          systems "still struggle with context and interruption management across multiple turns." The
          challenge isn't detecting an interruption — it's knowing whether the user is intentionally
          barging in or if it's background noise, and what to do with the context that was interrupted.
        </p>

        <p>
          <strong>Emotion detection degrades dramatically outside the lab.</strong> Speech emotion recognition
          hits 92%+ accuracy in controlled settings, but drops to 60–75% in real conditions. Cross-cultural
          recognition varies by up to 20 percentage points. High-arousal emotions (anger) are detected at
          95%; low-arousal ones (sadness vs. distress) only at 63%. Hume AI is doing the most ambitious work
          here, but their own framing acknowledges the problem: cognitive emotions like contemplation
          "fundamentally require contextual understanding beyond acoustics."
        </p>

        <p>
          <strong>Hallucinations cascade in ways unique to voice.</strong> When a text chatbot hallucinates,
          the user can see it and correct. When a voice agent hallucinates, the user can't scan back, can't
          ctrl+F, and correcting mid-conversation is socially awkward. Worse, voice hallucinations cascade:
          an ASR error becomes a confabulation seed that the LLM builds on confidently. One documented
          example: "I'm a watermelon" (Florida accent) → the system interpreted it as "Mims, Florida" →
          then confidently built on that false premise. The target of less than 5% hallucination rate remains
          aspirational for most deployments.
        </p>

        <p>
          <strong>Long-term memory across calls is 56% worse than humans.</strong> The LoCoMo benchmark (Snap
          Research) tested conversational memory over 300 turns and 35 sessions. Even RAG-augmented systems
          lagged human memory by 56%, with temporal reasoning showing a 73% gap. Remembering what a customer
          said last week should be table stakes. It isn't.
        </p>

        <Divider />

        {/* ─── Section 7: Infrastructure Thesis ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5e5f5",
          marginTop: 0
        }}>
          Where to build: the infrastructure gaps
        </h2>

        <p>
          Three structural shifts define the opportunity right now:
        </p>

        <p>
          <strong>First, open-source models reached commercial quality.</strong> When Chatterbox beats
          ElevenLabs and Fish Audio S1 tops TTS-Arena2, the model layer isn't where durable value
          accrues anymore. The value shifts to everything around it.
        </p>

        <p>
          <strong>Second, the cascaded pipeline isn't going away.</strong> S2S models will coexist with
          STT→LLM→TTS for years because enterprises need controllability, debuggability, and compliance
          guarantees that intermediate text provides. Infrastructure that makes the cascade faster, more
          observable, and more reliable has durable value.
        </p>

        <p>
          <strong>Third, the industry is moving from "can we build a voice agent?" to "can we operate voice
          agents reliably at scale?" — and the tooling for the second question barely exists.</strong>
        </p>

        <p>
          Based on our research, these are the highest-impact gaps:
        </p>

        <div style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: "8px",
          padding: "28px 28px 12px",
          margin: "32px 0"
        }}>
          <div style={{ marginBottom: "28px" }}>
            <h4 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              fontWeight: 600,
              color: "#10B981",
              marginTop: 0,
              marginBottom: "8px"
            }}>
              1. Testing and CI/CD for voice agents
            </h4>
            <p style={{ margin: 0 }}>
              The single largest gap. Most teams manually call their agents after each prompt change.
              Manual QA breaks down beyond ~100 daily calls. The industry needs regression testing
              pipelines that simulate thousands of concurrent callers with varied accents, noise, and
              adversarial behavior — the voice equivalent of k6 or Locust. Hamming AI, Coval, and Cekura
              are early but nascent.
            </p>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <h4 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              fontWeight: 600,
              color: "#10B981",
              marginTop: 0,
              marginBottom: "8px"
            }}>
              2. End-to-end voice-native observability
            </h4>
            <p style={{ margin: 0 }}>
              Nothing exists that correlates audio quality metrics → ASR accuracy → LLM reasoning quality →
              TTS naturalness → conversation outcomes in a single pane. Langfuse tracks LLM calls.
              Telephony providers track call quality. But cross-layer correlation with P50/P95/P99
              latency tracking at each component boundary? Doesn't exist. The company that builds
              "Datadog for voice agents" addresses a gap every single deployment works around with custom tooling.
            </p>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <h4 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              fontWeight: 600,
              color: "#10B981",
              marginTop: 0,
              marginBottom: "8px"
            }}>
              3. Evaluation benchmarks
            </h4>
            <p style={{ margin: 0 }}>
              Every platform measures quality differently. "Latency" means TTFB to one provider, TTFW
              to another, mouth-to-ear to a third. There's no VoiceAgentBench analogous to MMLU or
              HumanEval. Salesforce's Enterprise Agent Benchmark and NVIDIA's FullDuplexBench are early
              attempts, but narrow.
            </p>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <h4 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              fontWeight: 600,
              color: "#10B981",
              marginTop: 0,
              marginBottom: "8px"
            }}>
              4. Streaming protocol standardization
            </h4>
            <p style={{ margin: 0 }}>
              Every STT/LLM/TTS provider has proprietary streaming APIs. There's no standard for how
              partial STT hypotheses feed into an LLM, or how LLM tokens stream to TTS. Every integration
              is custom. LiveKit and Pipecat provide frameworks, but the protocol layer isn't standardized.
              A well-designed streaming protocol would enable plug-and-play component swapping — what HTTP
              did for web services.
            </p>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <h4 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              fontWeight: 600,
              color: "#10B981",
              marginTop: 0,
              marginBottom: "8px"
            }}>
              5. Compliance and trust infrastructure
            </h4>
            <p style={{ margin: 0 }}>
              Deepfake fraud is forecast to surge 162% in 2025. Contact center fraud exposure may hit
              $44.5B. EU AI Act, GDPR, HIPAA, and US state laws are all converging on voice AI. But
              there's no standard for voice watermarking verification, consent management is ad-hoc, and
              audit trails of AI-generated speech barely exist.
            </p>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <h4 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              fontWeight: 600,
              color: "#10B981",
              marginTop: 0,
              marginBottom: "8px"
            }}>
              6. Edge deployment tooling
            </h4>
            <p style={{ margin: 0 }}>
              On-device voice AI is viable — Speechmatics runs within 10% of server accuracy on laptops,
              Liquid AI's LFM2.5 runs on vehicles. But running the full STT+LLM+TTS pipeline on edge
              with acceptable quality remains difficult. The true bottleneck is memory bandwidth (30–50
              GB/s on mobile DRAM), not compute — requiring fundamentally different optimization approaches
              than cloud.
            </p>
          </div>
        </div>

        <Divider />

        {/* ─── Conclusion ─── */}

        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: "28px",
          fontWeight: 500,
          color: "#f5f5f5",
          marginTop: 0
        }}>
          The upshot
        </h2>

        <p>
          Voice AI is in a strange place. The models are extraordinary. Naturalness has saturated in
          controlled conditions — Sesame's CSM is indistinguishable from real human speech. TTS latency
          went from seconds to milliseconds. Open-source alternatives are winning blind tests against
          companies valued at $11B. And $2.1B+ in VC funding is chasing the opportunity.
        </p>

        <p>
          But the infrastructure around those models looks like web development did in 2005. No standardized
          testing frameworks. No unified observability. No agreed-upon benchmarks. No common protocols.
          Compliance tooling that barely exists while regulators are already drafting rules.
        </p>

        <p>
          The voice AI agents market is projected at $47.5B by 2034, growing at 34.8% CAGR.
          Every single deployment in that market will need infrastructure to operate reliably.
          The companies building that infrastructure layer — the testing frameworks, the observability
          platforms, the evaluation standards, the compliance tools — will be as essential to voice AI
          as Datadog and Vercel are to web development.
        </p>

        <p>
          The models got good. Now someone needs to build the roads.
        </p>

        <Divider />

        {/* ─── Footer ─── */}

        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px",
          color: "#555",
          lineHeight: 1.8
        }}>
          <p style={{ marginBottom: "8px" }}>
            <strong style={{ color: "#888" }}>Methodology:</strong> This research draws on published benchmarks,
            company announcements, academic papers, production analyses (notably Hamming AI's 4M+ call dataset
            and Twilio's latency profiling), and direct testing where possible. Numbers are as of February 2026
            and will age. If we got something wrong, we want to know.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "#888" }}>About:</strong> BaseThesis is an AI infrastructure lab.
            We don't build speech models or voice agent orchestration — we build infrastructure for the
            people who do.
          </p>
        </div>

      </div>
    </div>
  );
}
