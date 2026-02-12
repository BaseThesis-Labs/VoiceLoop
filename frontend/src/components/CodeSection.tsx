import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Terminal } from 'lucide-react';

const tabs = [
  {
    label: 'Python',
    code: `from voiceloop import VoiceLoop, Eval

client = VoiceLoop(api_key="vl_...")

# Define an eval for your voice agent
eval = Eval(
    name="scheduling-accuracy",
    criteria=[
        "confirms_date_and_time",
        "repeats_back_details",
        "handles_conflicts_gracefully",
    ],
    threshold=0.9,
)

# Run eval against your agent
result = client.eval.run(
    agent_id="agent_scheduling_v3",
    eval=eval,
    dataset="production_calls_last_7d",
)

print(f"Score: {result.score}")
print(f"Pass: {result.passed}")`,
  },
  {
    label: 'TypeScript',
    code: `import { VoiceLoop } from "@voiceloop/sdk";

const client = new VoiceLoop({
  apiKey: "vl_...",
});

// Observe every agent conversation
const trace = await client.traces.create({
  agentId: "agent_scheduling_v3",
  sessionId: session.id,
});

// Auto-optimize prompts from eval feedback
await client.prompts.optimize({
  agentId: "agent_scheduling_v3",
  strategy: "gradient",
  evalResults: trace.evals,
  autoPromote: true,
});

console.log("Prompt optimized and promoted!");`,
  },
  {
    label: 'cURL',
    code: `curl -X POST https://api.voiceloop.dev/v1/evals/run \\
  -H "Authorization: Bearer vl_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "agent_scheduling_v3",
    "eval_name": "scheduling-accuracy",
    "dataset": "production_calls_last_7d"
  }'

# Response
# {
#   "score": 0.942,
#   "passed": true,
#   "criteria_scores": {
#     "confirms_date_and_time": 0.97,
#     "repeats_back_details": 0.91,
#     "handles_conflicts": 0.95
#   }
# }`,
  },
];

const terminalLines = [
  { text: '$ voiceloop eval run --agent scheduling_v3', type: 'command' as const },
  { text: '', type: 'blank' as const },
  { text: '  Running eval: scheduling-accuracy', type: 'info' as const },
  { text: '  Dataset: production_calls_last_7d (1,247 calls)', type: 'info' as const },
  { text: '', type: 'blank' as const },
  { text: '  confirms_date_and_time    ████████████████████  97%', type: 'result' as const },
  { text: '  repeats_back_details      █████████████████░░░  91%', type: 'result' as const },
  { text: '  handles_conflicts         ███████████████████░  95%', type: 'result' as const },
  { text: '', type: 'blank' as const },
  { text: '  Overall Score: 94.2%  ✓ PASSED', type: 'success' as const },
  { text: '', type: 'blank' as const },
  { text: '  → Prompt v3.2 auto-optimized → v3.3', type: 'optimize' as const },
  { text: '  → Latency improved: 340ms → 285ms (-16.2%)', type: 'optimize' as const },
];

function getLineColor(type: string) {
  switch (type) {
    case 'command': return 'text-[#34d399]';
    case 'info': return 'text-text-body';
    case 'result': return 'text-code-keyword';
    case 'success': return 'text-[#34d399] font-semibold';
    case 'optimize': return 'text-amber-400/80';
    default: return '';
  }
}

function highlightSyntax(line: string, lang: string): string {
  if (lang === 'Python') {
    if (/^\s*(from|import|def|class|return|print|if|else|for|in|with|as)\b/.test(line)) return 'keyword';
    if (/^\s*#/.test(line)) return 'comment';
    if (/".*?"/.test(line) || /'.*?'/.test(line)) return 'string';
  } else if (lang === 'TypeScript') {
    if (/^\s*(import|export|const|let|var|await|async|from|new|function)\b/.test(line)) return 'keyword';
    if (/^\s*\/\//.test(line)) return 'comment';
    if (/".*?"/.test(line) || /'.*?'/.test(line)) return 'string';
  } else {
    if (/^\s*curl\b/.test(line)) return 'keyword';
    if (/^\s*#/.test(line)) return 'comment';
    if (/".*?"/.test(line)) return 'string';
  }
  return 'default';
}

function getHighlightClass(type: string) {
  switch (type) {
    case 'keyword': return 'text-code-keyword';
    case 'comment': return 'text-text-faint';
    case 'string': return 'text-code-string';
    default: return 'text-text-body';
  }
}

export default function CodeSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tabs[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="code" className="relative py-24">
      {/* Divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] max-w-[600px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div className="max-w-[1100px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-4">
            Developer Experience
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl lg:text-[44px] font-normal text-text-primary tracking-[-0.01em] leading-[1.15] mb-4">
            Ship in minutes,{' '}
            <span className="bg-gradient-to-r from-accent to-[#34d399] bg-clip-text text-transparent">
              not months
            </span>
          </h2>
          <p className="text-[15px] text-text-body leading-relaxed">
            A few lines of code to evaluate, observe, and optimize your voice agents.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch"
        >
          {/* Code editor */}
          <div className="flex flex-col rounded-2xl overflow-hidden border border-border-default bg-bg-surface hover:border-border-strong transition-colors duration-300">
            <div className="flex items-center justify-between bg-bg-surface-header px-5 py-3 border-b border-border-default">
              <div className="flex items-center gap-1">
                {tabs.map((tab, i) => (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(i)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${
                      activeTab === i
                        ? 'bg-bg-hover text-text-primary'
                        : 'text-text-faint hover:text-text-body'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[11px] text-text-faint hover:text-text-body transition-colors font-[family-name:var(--font-mono)]"
              >
                {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex-1 p-5 overflow-auto">
              <pre className="text-[13px] font-[family-name:var(--font-mono)] leading-[1.7]">
                <code>
                  {tabs[activeTab].code.split('\n').map((line, i) => {
                    const type = highlightSyntax(line, tabs[activeTab].label);
                    return (
                      <div key={i} className="flex">
                        <span className="text-text-faint/40 select-none w-7 shrink-0 text-right mr-4 text-[12px]">
                          {i + 1}
                        </span>
                        <span className={getHighlightClass(type)}>
                          {line || '\u00A0'}
                        </span>
                      </div>
                    );
                  })}
                </code>
              </pre>
            </div>
          </div>

          {/* Terminal output */}
          <div className="flex flex-col rounded-2xl overflow-hidden border border-border-default bg-bg-surface hover:border-border-strong transition-colors duration-300">
            <div className="flex items-center gap-3 bg-bg-surface-header px-5 py-3 border-b border-border-default">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/40" />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
                <Terminal size={13} />
                terminal
              </div>
            </div>
            <div className="flex-1 p-5 overflow-auto">
              <div className="text-[13px] font-[family-name:var(--font-mono)] leading-[1.8]">
                {terminalLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className={`${getLineColor(line.type)} ${line.type === 'blank' ? 'h-5' : ''}`}
                  >
                    {line.text}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
