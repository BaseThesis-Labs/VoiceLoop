import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

const tabs = [
  {
    label: 'Python',
    lang: 'python',
    code: `from voiceloop import VoiceLoop, IntentAPI

client = VoiceLoop(api_key="vl_...")
intent = IntentAPI()

# Compute the intent vector from audio + transcript
vector = intent.compute(
    audio=audio_bytes,
    transcript="I guess we could try Bali..."
)

# Post a turn — get a decision
directive = client.turns.create(
    call_id="call_abc123",
    intent_vector=vector,
    transcript="I guess we could try Bali..."
)

print(directive.strategy)      # "empathetic_acknowledgment"
print(directive.active_tools)  # ["search_flights", "apply_discount"]
print(directive.reasoning)     # "Frustration rising..."`,
  },
  {
    label: 'TypeScript',
    lang: 'typescript',
    code: `import { VoiceLoop, IntentAPI } from "@voiceloop/sdk";

const client = new VoiceLoop({ apiKey: "vl_..." });
const intent = new IntentAPI();

// Compute the intent vector
const vector = await intent.compute({
  audio: audioBuffer,
  transcript: "I guess we could try Bali..."
});

// Post a turn — get a decision
const directive = await client.turns.create({
  callId: "call_abc123",
  intentVector: vector,
  transcript: "I guess we could try Bali..."
});

console.log(directive.strategy);     // "empathetic_acknowledgment"
console.log(directive.activeTools);  // ["search_flights", "apply_discount"]`,
  },
  {
    label: 'cURL',
    lang: 'bash',
    code: `curl -X POST https://api.voiceloop.dev/v1/calls/call_abc123/turns \\
  -H "Authorization: Bearer vl_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "intent_vector": {
      "hedging": 0.72,
      "requesting": 0.82,
      "frustrated": 0.45
    },
    "transcript": "I guess we could try Bali..."
  }'`,
  },
];

const stats = [
  '< 5 min setup',
  '3 SDKs',
  '99.9% uptime',
];

function highlightSyntax(line: string, lang: string): string {
  if (lang === 'python') {
    if (/^\s*(from|import|def|class|return|print|if|else|for|in|with|as)\b/.test(line)) return 'keyword';
    if (/^\s*#/.test(line)) return 'comment';
    if (/".*?"/.test(line) || /'.*?'/.test(line)) return 'string';
  } else if (lang === 'typescript') {
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
    <section id="code" className="relative py-32 lg:py-40 overflow-hidden">
      {/* Gradient divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] max-w-[600px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      {/* Background atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(45,212,168,0.04), transparent)',
        }}
      />

      <div className="max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-5">
            DEVELOPER EXPERIENCE
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-4xl lg:text-[44px] text-text-primary tracking-[-0.02em] leading-[1.1] mb-4">
            A few lines to production
          </h2>
          <p className="text-[16px] text-text-body max-w-lg mx-auto">
            Integrate VoiceLoop&apos;s intent engine and decision intelligence in minutes.
          </p>
        </motion.div>

        {/* Code card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="max-w-[740px] mx-auto rounded-2xl bg-bg-surface border border-border-default dot-border-top hover:border-border-strong transition-colors duration-300"
        >
          {/* Card header */}
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

          {/* Code content */}
          <div className="p-6 overflow-auto">
            <pre className="text-[13px] font-[family-name:var(--font-mono)] leading-[1.7]">
              <code>
                {tabs[activeTab].code.split('\n').map((line, i) => {
                  const type = highlightSyntax(line, tabs[activeTab].lang);
                  return (
                    <div key={i} className="flex">
                      <span className="text-text-faint/30 select-none w-7 shrink-0 text-right mr-4 text-[12px]">
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
        </motion.div>

        {/* Stat callouts */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-8 mt-10"
        >
          {stats.map((stat, i) => (
            <div key={stat} className="flex items-center gap-8">
              {i > 0 && (
                <div className="w-1 h-1 rounded-full bg-border-default" />
              )}
              <span className="text-[13px] font-[family-name:var(--font-mono)] text-text-faint">
                {stat}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
