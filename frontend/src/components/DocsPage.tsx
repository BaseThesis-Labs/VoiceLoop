import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';

/* ───────── Types ───────── */

interface TocEntry {
  id: string;
  label: string;
}

interface Token {
  text: string;
  type: string;
}

interface CodeSample {
  lang: string;
  label: string;
  code: string;
}

/* ───────── Table of Contents ───────── */

const tocSections: TocEntry[] = [
  { id: 'authentication', label: 'Authentication' },
  { id: 'get-api-key', label: 'Get API Key' },
  { id: 'register-developer', label: 'Register Developer' },
  { id: 'create-experiment', label: 'Create Experiment' },
  { id: 'run-experiment', label: 'Run Experiment' },
  { id: 'get-experiment', label: 'Get Experiment' },
  { id: 'list-experiments', label: 'List Experiments' },
  { id: 'get-results', label: 'Get Results' },
  { id: 'get-trials', label: 'Get Trials' },
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'error-handling', label: 'Error Handling' },
];

/* ───────── Language context (shared tab preference) ───────── */

const LanguageContext = createContext<{
  lang: string;
  setLang: (l: string) => void;
}>({ lang: 'curl', setLang: () => {} });

/* ───────── Syntax tokenizer ───────── */

const langPatterns: Record<string, RegExp> = {
  json: /(?<key>"[^"]*")(?=\s*:)|(?<string>"[^"]*")|(?<keyword>\b(?:true|false|null)\b)|(?<number>-?\b\d+(?:\.\d+)?\b)/g,

  bash: /(?<comment>#.*$)|(?<string>"[^"]*"|'[^']*')|(?<keyword>\b(?:curl|echo|export)\b)|(?<flag>\s-{1,2}[\w-]+)|(?<url>https?:\/\/[^\s"'\\]+)/g,

  python: /(?<comment>#.*$)|(?<decorator>@\w+)|(?<string>f"""[\s\S]*?"""|f'''[\s\S]*?'''|"""[\s\S]*?"""|'''[\s\S]*?'''|f"[^"]*"|f'[^']*'|"[^"]*"|'[^']*')|(?<keyword>\b(?:import|from|as|def|class|return|if|elif|else|try|except|finally|with|for|in|not|and|or|is|None|True|False|raise|async|await|lambda|while|break|continue|pass|yield|del|global|nonlocal|assert)\b)|(?<builtin>\b(?:print|len|range|dict|list|str|int|float|bool|type|isinstance|hasattr|getattr|setattr|super|open|enumerate|zip|map|filter|sorted|reversed|any|all|min|max|sum|abs|round|input|format|repr)\b)|(?<number>-?\b\d+(?:\.\d+)?\b)/g,

  javascript: /(?<comment>\/\/.*$)|(?<string>`[^`]*`|"[^"]*"|'[^']*')|(?<keyword>\b(?:const|let|var|function|return|if|else|try|catch|finally|throw|new|async|await|import|from|export|default|class|extends|this|typeof|instanceof|null|undefined|true|false|of|in|switch|case|break|continue|while|for|do|yield|void|delete)\b)|(?<builtin>\b(?:console|JSON|fetch|document|window|Promise|Error|Array|Object|Math|Date|RegExp|Map|Set|URLSearchParams|Number|String|Boolean|parseInt|parseFloat|setTimeout|setInterval|encodeURIComponent|decodeURIComponent)\b)|(?<number>-?\b\d+(?:\.\d+)?\b)/g,
};

function tokenizeLine(line: string, lang: string): Token[] {
  const pattern = langPatterns[lang];
  if (!pattern) return [{ text: line || '\u00A0', type: 'default' }];

  const regex = new RegExp(pattern.source, pattern.flags);
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: 'default' });
    }
    const type = Object.keys(match.groups || {}).find((k) => match!.groups![k] !== undefined) || 'default';
    tokens.push({ text: match[0], type });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: 'default' });
  }

  return tokens.length > 0 ? tokens : [{ text: line || '\u00A0', type: 'default' }];
}

function getTokenClass(type: string): string {
  switch (type) {
    case 'keyword':
      return 'text-[#c586c0]';
    case 'string':
      return 'text-[#ce9178]';
    case 'comment':
      return 'text-[#6a9955]';
    case 'number':
      return 'text-[#b5cea8]';
    case 'builtin':
      return 'text-[#dcdcaa]';
    case 'decorator':
      return 'text-[#dcdcaa]';
    case 'key':
      return 'text-[#9cdcfe]';
    case 'flag':
      return 'text-[#9cdcfe]';
    case 'url':
      return 'text-[#ce9178]';
    default:
      return 'text-[#d4d4d4]';
  }
}

/* ───────── Code block component ───────── */

function CodeBlock({ code, lang, title }: { code: string; lang: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden my-4">
      <div className="flex items-center justify-between bg-bg-surface-header px-4 py-2.5 border-b border-border-default">
        <span className="text-[11px] font-medium text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-wider">
          {title || lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-text-faint hover:text-text-body transition-colors font-[family-name:var(--font-mono)]"
        >
          {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-[13px] font-[family-name:var(--font-mono)] leading-[1.7]">
          <code>
            {lines.map((line, i) => {
              const tokens = tokenizeLine(line, lang);
              return (
                <div key={i} className="flex">
                  <span className="text-text-faint/30 select-none w-7 shrink-0 text-right mr-4 text-[12px]">
                    {i + 1}
                  </span>
                  <span>
                    {tokens.map((t, j) => (
                      <span key={j} className={getTokenClass(t.type)}>{t.text}</span>
                    ))}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

/* ───────── Tabbed code block ───────── */

function TabbedCodeBlock({ samples, title }: { samples: CodeSample[]; title?: string }) {
  const { lang: preferred, setLang } = useContext(LanguageContext);
  const [copied, setCopied] = useState(false);

  const active = samples.find((s) => s.lang === preferred) || samples[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = active.code.split('\n');

  return (
    <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden my-4">
      <div className="flex items-center justify-between bg-bg-surface-header px-4 py-1.5 border-b border-border-default">
        <div className="flex items-center gap-1">
          {title && (
            <span className="text-[11px] font-medium text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-wider mr-3">
              {title}
            </span>
          )}
          {samples.map((s) => (
            <button
              key={s.lang}
              onClick={() => setLang(s.lang)}
              className={`px-2.5 py-1.5 text-[11px] font-medium font-[family-name:var(--font-mono)] rounded-md transition-colors ${
                active.lang === s.lang
                  ? 'text-accent bg-accent/10'
                  : 'text-text-faint hover:text-text-body'
              }`}
            >
              {s.label}
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
      <div className="p-4 overflow-x-auto">
        <pre className="text-[13px] font-[family-name:var(--font-mono)] leading-[1.7]">
          <code>
            {lines.map((line, i) => {
              const tokens = tokenizeLine(line, active.lang);
              return (
                <div key={i} className="flex">
                  <span className="text-text-faint/30 select-none w-7 shrink-0 text-right mr-4 text-[12px]">
                    {i + 1}
                  </span>
                  <span>
                    {tokens.map((t, j) => (
                      <span key={j} className={getTokenClass(t.type)}>{t.text}</span>
                    ))}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

/* ───────── Method badge ───────── */

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  const color =
    method === 'POST'
      ? 'bg-accent/15 text-accent border-accent/25'
      : 'bg-blue-400/15 text-blue-400 border-blue-400/25';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold font-[family-name:var(--font-mono)] rounded border ${color}`}
    >
      {method}
    </span>
  );
}

/* ───────── Endpoint section wrapper ───────── */

function EndpointSection({
  id,
  method,
  path,
  description,
  children,
}: {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 mb-16">
      <div className="flex items-center gap-3 mb-3">
        <MethodBadge method={method} />
        <code className="text-[15px] font-[family-name:var(--font-mono)] text-text-primary">{path}</code>
      </div>
      <p className="text-[15px] text-text-body leading-relaxed mb-6">{description}</p>
      {children}
    </section>
  );
}

/* ───────── Schema table ───────── */

function SchemaTable({ fields }: { fields: { name: string; type: string; desc: string }[] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-[13px] font-[family-name:var(--font-mono)]">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left py-2 pr-4 text-text-faint font-medium">Field</th>
            <th className="text-left py-2 pr-4 text-text-faint font-medium">Type</th>
            <th className="text-left py-2 text-text-faint font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b border-border-default/50">
              <td className="py-2 pr-4 text-accent">{f.name}</td>
              <td className="py-2 pr-4 text-text-body">{f.type}</td>
              <td className="py-2 text-text-body font-[family-name:var(--font-sans)]">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── API Key Generator ───────── */

function ApiKeyGenerator() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [apiKey, setApiKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/developers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      if (res.status === 201) {
        const data = await res.json();
        setApiKey(data.api_key);
        setStatus('success');
      } else if (res.status === 409) {
        setErrorMsg('This email is already registered. Each email can only be used once.');
        setStatus('error');
      } else {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.detail || `Request failed (${res.status})`);
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error — could not reach the API.');
      setStatus('error');
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  if (status === 'success') {
    return (
      <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        <div className="flex items-center justify-between bg-bg-surface-header px-4 py-2.5 border-b border-border-default">
          <span className="text-[11px] font-medium text-accent font-[family-name:var(--font-mono)] uppercase tracking-wider">
            Your API Key
          </span>
          <span className="text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
            Created
          </span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-bg-primary border border-border-default p-3">
            <code className="flex-1 text-[13px] font-[family-name:var(--font-mono)] text-accent break-all select-all">
              {apiKey}
            </code>
            <button
              onClick={handleCopyKey}
              className="shrink-0 flex items-center gap-1.5 text-[11px] text-text-faint hover:text-text-body transition-colors font-[family-name:var(--font-mono)] px-2 py-1 rounded-md hover:bg-bg-surface"
            >
              {keyCopied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
              {keyCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5">
            <span className="text-amber-400 text-sm leading-none mt-0.5">&#9888;</span>
            <p className="text-[13px] text-amber-200/80 leading-relaxed">
              Save this key now — it won't be shown again. Store it somewhere secure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
      <div className="bg-bg-surface-header px-4 py-2.5 border-b border-border-default">
        <span className="text-[11px] font-medium text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-wider">
          Generate API Key
        </span>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1.5">
              Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border-default text-text-primary text-[14px] font-[family-name:var(--font-sans)] placeholder:text-text-faint/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border-default text-text-primary text-[14px] font-[family-name:var(--font-sans)] placeholder:text-text-faint/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
            />
          </div>
        </div>

        {status === 'error' && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2.5">
            <p className="text-[13px] text-red-400 leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-bg-primary text-[14px] font-semibold hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating…
            </>
          ) : (
            'Generate API Key'
          )}
        </button>
      </form>
    </div>
  );
}

/* ───────── Main page ───────── */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('authentication');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [preferredLang, setPreferredLang] = useState(() => {
    try { return localStorage.getItem('docs-lang') || 'curl'; } catch { return 'curl'; }
  });

  useEffect(() => {
    try { localStorage.setItem('docs-lang', preferredLang); } catch { /* noop */ }
  }, [preferredLang]);

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    const visible = entries.filter((e) => e.isIntersecting);
    if (visible.length > 0) {
      // Pick the one closest to top of viewport
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      setActiveSection(visible[0].target.id);
    }
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    });

    tocSections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [handleIntersect]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="noise-overlay min-h-screen bg-bg-primary text-text-primary">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16">
        <div className="absolute inset-0 dot-grid" />
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 600px 400px at 30% 15%, rgba(20, 184, 166, 0.06), transparent)',
          }}
        />
        <div className="relative max-w-[960px] mx-auto px-6">
          <span className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-4">
            API Reference
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl lg:text-[56px] font-normal text-text-primary tracking-[-0.01em] leading-[1.1] mb-4">
            Experiments{' '}
            <span className="bg-gradient-to-r from-accent to-[#34d399] bg-clip-text text-transparent">
              API
            </span>
          </h1>
          <p className="text-[15px] text-text-body leading-relaxed max-w-lg">
            Programmatic voice AI A/B testing. Create experiments, compare TTS providers, and get
            statistically-backed results.
          </p>
          <div className="mt-6 flex items-center gap-2 text-[13px] font-[family-name:var(--font-mono)] text-text-faint">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-surface border border-border-default">
              Base URL
            </span>
            <code className="text-text-body">https://api.koecode.dev/api/v1</code>
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      <LanguageContext.Provider value={{ lang: preferredLang, setLang: setPreferredLang }}>
      <div className="relative max-w-[960px] mx-auto px-6 pb-24">
        <div className="flex gap-12">
          {/* Sidebar TOC — desktop only */}
          <aside className="hidden lg:block w-[200px] shrink-0">
            <nav className="sticky top-24">
              <p className="text-[11px] font-semibold text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] mb-4">
                On this page
              </p>
              <ul className="space-y-1">
                {tocSections.map(({ id, label }) => (
                  <li key={id}>
                    <button
                      onClick={() => scrollTo(id)}
                      className={`block w-full text-left text-[13px] py-1.5 px-3 rounded-md transition-colors ${
                        activeSection === id
                          ? 'text-accent bg-accent/5'
                          : 'text-text-faint hover:text-text-body'
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1 max-w-[700px]">
            {/* ── Authentication ── */}
            <section id="authentication" className="scroll-mt-28 mb-16">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
                Authentication
              </h2>
              <p className="text-[15px] text-text-body leading-relaxed mb-4">
                All API endpoints require a Bearer token in the <code className="text-accent text-[13px] font-[family-name:var(--font-mono)] bg-bg-surface px-1.5 py-0.5 rounded">Authorization</code> header. API keys are obtained through developer registration and are shown only once — store them securely.
              </p>
              <p className="text-[15px] text-text-body leading-relaxed mb-4">
                All experiments are scoped to the authenticated developer. Keys are hashed at rest.
              </p>
              <CodeBlock
                lang="bash"
                title="Header"
                code={`Authorization: Bearer your_api_key_here`}
              />
            </section>

            {/* ── Get API Key ── */}
            <section id="get-api-key" className="scroll-mt-28 mb-16">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
                Get Your API Key
              </h2>
              <p className="text-[15px] text-text-body leading-relaxed mb-6">
                Register as a developer to get an API key instantly. The key is shown only once — copy and store it securely.
              </p>
              <ApiKeyGenerator />
            </section>

            {/* ── Register Developer ── */}
            <EndpointSection
              id="register-developer"
              method="POST"
              path="/api/v1/developers"
              description="Register a new developer account and receive an API key. The key is shown only once in the response — store it securely."
            >
              <h4 className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] uppercase tracking-wider mb-2">
                Request Body
              </h4>
              <SchemaTable
                fields={[
                  { name: 'name', type: 'string', desc: 'Developer name' },
                  { name: 'email', type: 'string', desc: 'Email address (unique)' },
                ]}
              />
              <CodeBlock
                lang="json"
                title="Request"
                code={`{
  "name": "Jane Smith",
  "email": "jane@example.com"
}`}
              />
              <h4 className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] uppercase tracking-wider mb-2 mt-6">
                Response
              </h4>
              <CodeBlock
                lang="json"
                title="Response · 201"
                code={`{
  "id": "dev_abc123",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "api_key": "kc_live_sk_..."
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl -X POST https://api.koecode.dev/api/v1/developers \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com"
  }'`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.post(
    "https://api.koecode.dev/api/v1/developers",
    json={"name": "Jane Smith", "email": "jane@example.com"}
)
data = response.json()
print(data["api_key"])  # Save this — shown only once`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const response = await fetch("https://api.koecode.dev/api/v1/developers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Jane Smith",
    email: "jane@example.com"
  })
});

const data = await response.json();
console.log(data.api_key);  // Save this — shown only once`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── Create Experiment ── */}
            <EndpointSection
              id="create-experiment"
              method="POST"
              path="/api/v1/experiments"
              description="Create a new A/B testing experiment. Define the models to compare, prompts to test, and evaluation scenario."
            >
              <h4 className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] uppercase tracking-wider mb-2">
                Request Body
              </h4>
              <SchemaTable
                fields={[
                  { name: 'name', type: 'string', desc: 'Experiment name' },
                  { name: 'scenario', type: 'string', desc: 'Evaluation scenario (see below)' },
                  { name: 'eval_mode', type: 'string', desc: 'Evaluation mode' },
                  { name: 'models', type: 'array', desc: '2–4 models with provider and optional voice_id' },
                  { name: 'prompts', type: 'array', desc: '1–20 text prompts to synthesize' },
                  { name: 'webhook_url', type: 'string?', desc: 'Optional webhook for completion notification' },
                ]}
              />
              <div className="my-4 p-4 rounded-lg bg-bg-surface border border-border-default">
                <p className="text-[13px] font-[family-name:var(--font-mono)] text-text-faint mb-2">
                  Valid scenarios
                </p>
                <div className="flex flex-wrap gap-2">
                  {['general', 'customer_support', 'medical', 'financial', 'technical_support', 'adversarial', 'multilingual'].map((s) => (
                    <code
                      key={s}
                      className="text-[12px] font-[family-name:var(--font-mono)] text-accent bg-accent/5 px-2 py-0.5 rounded"
                    >
                      {s}
                    </code>
                  ))}
                </div>
                <p className="text-[13px] font-[family-name:var(--font-mono)] text-text-faint mt-3 mb-2">
                  Valid providers
                </p>
                <div className="flex flex-wrap gap-2">
                  {['cartesia', 'elevenlabs', 'smallestai', 'deepgram'].map((p) => (
                    <code
                      key={p}
                      className="text-[12px] font-[family-name:var(--font-mono)] text-accent bg-accent/5 px-2 py-0.5 rounded"
                    >
                      {p}
                    </code>
                  ))}
                </div>
              </div>
              <CodeBlock
                lang="json"
                title="Request"
                code={`{
  "name": "TTS Provider Comparison Q1",
  "scenario": "customer_support",
  "eval_mode": "automated",
  "models": [
    { "provider": "elevenlabs", "voice_id": "voice_abc" },
    { "provider": "cartesia" },
    { "provider": "deepgram" }
  ],
  "prompts": [
    "Hello, thank you for calling support. How can I help you today?",
    "I understand your concern. Let me look into that for you.",
    "Your issue has been resolved. Is there anything else I can help with?"
  ],
  "webhook_url": "https://example.com/webhook"
}`}
              />
              <CodeBlock
                lang="json"
                title="Response · 201"
                code={`{
  "id": "exp_xyz789",
  "name": "TTS Provider Comparison Q1",
  "status": "created",
  "scenario": "customer_support",
  "total_trials": 9,
  "completed_trials": 0,
  "created_at": "2026-02-20T10:30:00Z"
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl -X POST https://api.koecode.dev/api/v1/experiments \\
  -H "Authorization: Bearer kc_live_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "TTS Provider Comparison Q1",
    "scenario": "customer_support",
    "eval_mode": "automated",
    "models": [
      { "provider": "elevenlabs", "voice_id": "voice_abc" },
      { "provider": "cartesia" },
      { "provider": "deepgram" }
    ],
    "prompts": [
      "Hello, thank you for calling support.",
      "I understand your concern."
    ]
  }'`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.post(
    "https://api.koecode.dev/api/v1/experiments",
    headers={"Authorization": "Bearer kc_live_sk_..."},
    json={
        "name": "TTS Provider Comparison Q1",
        "scenario": "customer_support",
        "eval_mode": "automated",
        "models": [
            {"provider": "elevenlabs", "voice_id": "voice_abc"},
            {"provider": "cartesia"},
            {"provider": "deepgram"}
        ],
        "prompts": [
            "Hello, thank you for calling support.",
            "I understand your concern."
        ]
    }
)
print(response.json())`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const response = await fetch("https://api.koecode.dev/api/v1/experiments", {
  method: "POST",
  headers: {
    "Authorization": "Bearer kc_live_sk_...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "TTS Provider Comparison Q1",
    scenario: "customer_support",
    eval_mode: "automated",
    models: [
      { provider: "elevenlabs", voice_id: "voice_abc" },
      { provider: "cartesia" },
      { provider: "deepgram" }
    ],
    prompts: [
      "Hello, thank you for calling support.",
      "I understand your concern."
    ]
  })
});

const data = await response.json();
console.log(data);`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── Run Experiment ── */}
            <EndpointSection
              id="run-experiment"
              method="POST"
              path="/api/v1/experiments/{id}/run"
              description="Start running an experiment. The experiment must be in 'created' status. Returns 409 Conflict if the experiment is already running or completed."
            >
              <CodeBlock
                lang="json"
                title="Response · 200"
                code={`{
  "id": "exp_xyz789",
  "status": "running",
  "total_trials": 9,
  "completed_trials": 0
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl -X POST https://api.koecode.dev/api/v1/experiments/exp_xyz789/run \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.post(
    "https://api.koecode.dev/api/v1/experiments/exp_xyz789/run",
    headers={"Authorization": "Bearer kc_live_sk_..."}
)
print(response.json())`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const response = await fetch(
  "https://api.koecode.dev/api/v1/experiments/exp_xyz789/run",
  {
    method: "POST",
    headers: { "Authorization": "Bearer kc_live_sk_..." }
  }
);

const data = await response.json();
console.log(data);`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── Get Experiment ── */}
            <EndpointSection
              id="get-experiment"
              method="GET"
              path="/api/v1/experiments/{id}"
              description="Retrieve an experiment's current status and progress. Use this to poll for completion after starting a run."
            >
              <CodeBlock
                lang="json"
                title="Response · 200"
                code={`{
  "id": "exp_xyz789",
  "name": "TTS Provider Comparison Q1",
  "status": "running",
  "scenario": "customer_support",
  "total_trials": 9,
  "completed_trials": 5,
  "created_at": "2026-02-20T10:30:00Z"
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl https://api.koecode.dev/api/v1/experiments/exp_xyz789 \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.get(
    "https://api.koecode.dev/api/v1/experiments/exp_xyz789",
    headers={"Authorization": "Bearer kc_live_sk_..."}
)
print(response.json())`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const response = await fetch(
  "https://api.koecode.dev/api/v1/experiments/exp_xyz789",
  { headers: { "Authorization": "Bearer kc_live_sk_..." } }
);

const data = await response.json();
console.log(data);`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── List Experiments ── */}
            <EndpointSection
              id="list-experiments"
              method="GET"
              path="/api/v1/experiments"
              description="List all experiments for the authenticated developer. Supports filtering by status and scenario, with pagination."
            >
              <h4 className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] uppercase tracking-wider mb-2">
                Query Parameters
              </h4>
              <SchemaTable
                fields={[
                  { name: 'status', type: 'string?', desc: 'Filter by status (created, running, completed, failed)' },
                  { name: 'scenario', type: 'string?', desc: 'Filter by scenario type' },
                  { name: 'limit', type: 'int?', desc: 'Max results (default 20, max 100)' },
                  { name: 'offset', type: 'int?', desc: 'Pagination offset (default 0)' },
                ]}
              />
              <CodeBlock
                lang="json"
                title="Response · 200"
                code={`{
  "experiments": [
    {
      "id": "exp_xyz789",
      "name": "TTS Provider Comparison Q1",
      "status": "completed",
      "scenario": "customer_support",
      "total_trials": 9,
      "completed_trials": 9
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl "https://api.koecode.dev/api/v1/experiments?status=completed&limit=10" \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.get(
    "https://api.koecode.dev/api/v1/experiments",
    headers={"Authorization": "Bearer kc_live_sk_..."},
    params={"status": "completed", "limit": 10}
)
print(response.json())`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const params = new URLSearchParams({
  status: "completed",
  limit: "10"
});

const response = await fetch(
  \`https://api.koecode.dev/api/v1/experiments?\${params}\`,
  { headers: { "Authorization": "Bearer kc_live_sk_..." } }
);

const data = await response.json();
console.log(data);`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── Get Results ── */}
            <EndpointSection
              id="get-results"
              method="GET"
              path="/api/v1/experiments/{id}/results"
              description="Get aggregated results and rankings for a completed experiment. Returns 409 Conflict if the experiment has not finished."
            >
              <CodeBlock
                lang="json"
                title="Response · 200"
                code={`{
  "experiment_id": "exp_xyz789",
  "status": "completed",
  "winner": "elevenlabs",
  "confidence": 0.94,
  "rankings": [
    { "provider": "elevenlabs", "score": 8.7, "rank": 1 },
    { "provider": "cartesia", "score": 8.2, "rank": 2 },
    { "provider": "deepgram", "score": 7.5, "rank": 3 }
  ],
  "head_to_head": [
    {
      "pair": ["elevenlabs", "cartesia"],
      "winner": "elevenlabs",
      "margin": 0.5
    }
  ]
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl https://api.koecode.dev/api/v1/experiments/exp_xyz789/results \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.get(
    "https://api.koecode.dev/api/v1/experiments/exp_xyz789/results",
    headers={"Authorization": "Bearer kc_live_sk_..."}
)
results = response.json()
print(f"Winner: {results['winner']}")`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const response = await fetch(
  "https://api.koecode.dev/api/v1/experiments/exp_xyz789/results",
  { headers: { "Authorization": "Bearer kc_live_sk_..." } }
);

const results = await response.json();
console.log("Winner:", results.winner);`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── Get Trials ── */}
            <EndpointSection
              id="get-trials"
              method="GET"
              path="/api/v1/experiments/{id}/trials"
              description="Get detailed per-trial data including audio URLs, latency metrics, and quality scores."
            >
              <CodeBlock
                lang="json"
                title="Response · 200"
                code={`{
  "trials": [
    {
      "id": "trial_001",
      "provider": "elevenlabs",
      "prompt": "Hello, thank you for calling support.",
      "audio_url": "https://storage.koecode.dev/audio/trial_001.wav",
      "duration": 2.34,
      "ttfb_ms": 180,
      "generation_time_ms": 450,
      "silence_ratio": 0.08,
      "score": 8.9
    }
  ]
}`}
              />
              <TabbedCodeBlock
                samples={[
                  {
                    lang: 'curl',
                    label: 'cURL',
                    code: `curl https://api.koecode.dev/api/v1/experiments/exp_xyz789/trials \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                  },
                  {
                    lang: 'python',
                    label: 'Python',
                    code: `import requests

response = requests.get(
    "https://api.koecode.dev/api/v1/experiments/exp_xyz789/trials",
    headers={"Authorization": "Bearer kc_live_sk_..."}
)
for trial in response.json()["trials"]:
    print(f"{trial['provider']}: {trial['score']}")`,
                  },
                  {
                    lang: 'javascript',
                    label: 'JavaScript',
                    code: `const response = await fetch(
  "https://api.koecode.dev/api/v1/experiments/exp_xyz789/trials",
  { headers: { "Authorization": "Bearer kc_live_sk_..." } }
);

const { trials } = await response.json();
trials.forEach(t => console.log(\`\${t.provider}: \${t.score}\`));`,
                  },
                ]}
              />
            </EndpointSection>

            {/* ── Quickstart ── */}
            <section id="quickstart" className="scroll-mt-28 mb-16">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
                Quickstart
              </h2>
              <p className="text-[15px] text-text-body leading-relaxed mb-6">
                A complete flow from registration to results in five steps.
              </p>

              <div className="space-y-6">
                <div>
                  <p className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] mb-2">
                    <span className="text-accent mr-2">1.</span>Register &amp; get your API key
                  </p>
                  <TabbedCodeBlock
                    title="Step 1"
                    samples={[
                      {
                        lang: 'curl',
                        label: 'cURL',
                        code: `curl -X POST https://api.koecode.dev/api/v1/developers \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Jane Smith", "email": "jane@example.com" }'

# Save the api_key from the response — it won't be shown again`,
                      },
                      {
                        lang: 'python',
                        label: 'Python',
                        code: `import requests

BASE = "https://api.koecode.dev/api/v1"

response = requests.post(f"{BASE}/developers", json={
    "name": "Jane Smith",
    "email": "jane@example.com"
})
api_key = response.json()["api_key"]
# Save this key — it won't be shown again`,
                      },
                      {
                        lang: 'javascript',
                        label: 'JavaScript',
                        code: `const BASE = "https://api.koecode.dev/api/v1";

const response = await fetch(\`\${BASE}/developers\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Jane Smith", email: "jane@example.com" })
});

const { api_key } = await response.json();
// Save this key — it won't be shown again`,
                      },
                    ]}
                  />
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] mb-2">
                    <span className="text-accent mr-2">2.</span>Create an experiment
                  </p>
                  <TabbedCodeBlock
                    title="Step 2"
                    samples={[
                      {
                        lang: 'curl',
                        label: 'cURL',
                        code: `curl -X POST https://api.koecode.dev/api/v1/experiments \\
  -H "Authorization: Bearer kc_live_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My First Experiment",
    "scenario": "general",
    "eval_mode": "automated",
    "models": [
      { "provider": "elevenlabs" },
      { "provider": "cartesia" }
    ],
    "prompts": [
      "Welcome to our service. How can I help?",
      "Your order has been shipped and will arrive tomorrow."
    ]
  }'`,
                      },
                      {
                        lang: 'python',
                        label: 'Python',
                        code: `headers = {"Authorization": f"Bearer {api_key}"}

response = requests.post(f"{BASE}/experiments", headers=headers, json={
    "name": "My First Experiment",
    "scenario": "general",
    "eval_mode": "automated",
    "models": [
        {"provider": "elevenlabs"},
        {"provider": "cartesia"}
    ],
    "prompts": [
        "Welcome to our service. How can I help?",
        "Your order has been shipped and will arrive tomorrow."
    ]
})
exp_id = response.json()["id"]`,
                      },
                      {
                        lang: 'javascript',
                        label: 'JavaScript',
                        code: `const headers = {
  "Authorization": \`Bearer \${api_key}\`,
  "Content-Type": "application/json"
};

const expRes = await fetch(\`\${BASE}/experiments\`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "My First Experiment",
    scenario: "general",
    eval_mode: "automated",
    models: [
      { provider: "elevenlabs" },
      { provider: "cartesia" }
    ],
    prompts: [
      "Welcome to our service. How can I help?",
      "Your order has been shipped and will arrive tomorrow."
    ]
  })
});

const { id: exp_id } = await expRes.json();`,
                      },
                    ]}
                  />
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] mb-2">
                    <span className="text-accent mr-2">3.</span>Run the experiment
                  </p>
                  <TabbedCodeBlock
                    title="Step 3"
                    samples={[
                      {
                        lang: 'curl',
                        label: 'cURL',
                        code: `curl -X POST https://api.koecode.dev/api/v1/experiments/exp_xyz789/run \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                      },
                      {
                        lang: 'python',
                        label: 'Python',
                        code: `response = requests.post(
    f"{BASE}/experiments/{exp_id}/run",
    headers=headers
)
print(response.json()["status"])  # "running"`,
                      },
                      {
                        lang: 'javascript',
                        label: 'JavaScript',
                        code: `const runRes = await fetch(\`\${BASE}/experiments/\${exp_id}/run\`, {
  method: "POST",
  headers
});

console.log((await runRes.json()).status);  // "running"`,
                      },
                    ]}
                  />
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] mb-2">
                    <span className="text-accent mr-2">4.</span>Poll for completion
                  </p>
                  <TabbedCodeBlock
                    title="Step 4"
                    samples={[
                      {
                        lang: 'curl',
                        label: 'cURL',
                        code: `curl https://api.koecode.dev/api/v1/experiments/exp_xyz789 \\
  -H "Authorization: Bearer kc_live_sk_..."

# Repeat until status is "completed"`,
                      },
                      {
                        lang: 'python',
                        label: 'Python',
                        code: `import time

while True:
    response = requests.get(
        f"{BASE}/experiments/{exp_id}",
        headers=headers
    )
    if response.json()["status"] == "completed":
        break
    time.sleep(5)`,
                      },
                      {
                        lang: 'javascript',
                        label: 'JavaScript',
                        code: `const poll = async () => {
  while (true) {
    const res = await fetch(\`\${BASE}/experiments/\${exp_id}\`, { headers });
    const { status } = await res.json();
    if (status === "completed") break;
    await new Promise(r => setTimeout(r, 5000));
  }
};

await poll();`,
                      },
                    ]}
                  />
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-text-primary font-[family-name:var(--font-mono)] mb-2">
                    <span className="text-accent mr-2">5.</span>Get the results
                  </p>
                  <TabbedCodeBlock
                    title="Step 5"
                    samples={[
                      {
                        lang: 'curl',
                        label: 'cURL',
                        code: `curl https://api.koecode.dev/api/v1/experiments/exp_xyz789/results \\
  -H "Authorization: Bearer kc_live_sk_..."`,
                      },
                      {
                        lang: 'python',
                        label: 'Python',
                        code: `response = requests.get(
    f"{BASE}/experiments/{exp_id}/results",
    headers=headers
)
results = response.json()
print(f"Winner: {results['winner']} (confidence: {results['confidence']})")`,
                      },
                      {
                        lang: 'javascript',
                        label: 'JavaScript',
                        code: `const results = await fetch(
  \`\${BASE}/experiments/\${exp_id}/results\`,
  { headers }
).then(r => r.json());

console.log(\`Winner: \${results.winner} (confidence: \${results.confidence})\`);`,
                      },
                    ]}
                  />
                </div>
              </div>
            </section>

            {/* ── Error Handling ── */}
            <section id="error-handling" className="scroll-mt-28 mb-16">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
                Error Handling
              </h2>
              <p className="text-[15px] text-text-body leading-relaxed mb-6">
                The API uses standard HTTP status codes. Errors return a JSON body with a <code className="text-accent text-[13px] font-[family-name:var(--font-mono)] bg-bg-surface px-1.5 py-0.5 rounded">detail</code> field describing the issue.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-3 pr-6 text-text-faint font-medium font-[family-name:var(--font-mono)]">
                        Status
                      </th>
                      <th className="text-left py-3 pr-6 text-text-faint font-medium font-[family-name:var(--font-mono)]">
                        Meaning
                      </th>
                      <th className="text-left py-3 text-text-faint font-medium font-[family-name:var(--font-mono)]">
                        When
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: '400', meaning: 'Bad Request', when: 'Invalid input, missing required fields, constraint violations' },
                      { code: '401', meaning: 'Unauthorized', when: 'Missing or invalid API key' },
                      { code: '404', meaning: 'Not Found', when: 'Experiment ID does not exist or belongs to another developer' },
                      { code: '409', meaning: 'Conflict', when: 'Experiment not in required state (e.g., already running, results not ready)' },
                    ].map((row) => (
                      <tr key={row.code} className="border-b border-border-default/50">
                        <td className="py-3 pr-6">
                          <code className="text-accent font-[family-name:var(--font-mono)]">{row.code}</code>
                        </td>
                        <td className="py-3 pr-6 text-text-primary font-[family-name:var(--font-mono)]">
                          {row.meaning}
                        </td>
                        <td className="py-3 text-text-body">{row.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <CodeBlock
                lang="json"
                title="Error Response"
                code={`{
  "detail": "Experiment is not in 'created' state. Current status: running"
}`}
              />
            </section>
          </div>
        </div>
      </div>
      </LanguageContext.Provider>

      <Footer />
    </div>
  );
}
