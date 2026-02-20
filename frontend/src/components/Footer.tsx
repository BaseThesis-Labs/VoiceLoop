import { useState } from 'react';
import { ArrowRight, Loader2, Check } from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'footer' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Failed to subscribe');
      }
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <footer
      className="relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/footer.png')" }}
    >
      {/* Dark overlay for text readability over light image */}
      <div className="absolute inset-0 bg-black/70 pointer-events-none" />

      {/* Footer Bottom Section */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 pb-16">
        <div className="border-t border-white/10 pt-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex flex-col items-center sm:items-start gap-4">
              <p className="text-[15px] font-semibold text-white">
                KoeCode
              </p>
              <p className="text-[13px] text-white/60 leading-relaxed max-w-[260px] text-center sm:text-left">
                The intelligence layer for production voice AI.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://x.com/Basethesislabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-white/70 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Newsletter */}
            <div className="flex flex-col items-center sm:items-end gap-3">
              <p className="text-[12px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-white/50">
                Stay updated
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-row">
                <input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border border-white/15 rounded-l-lg px-3 py-2 text-[13px] text-white placeholder-white/40 w-48 focus:outline-none focus:border-white/30 backdrop-blur-sm"
                  disabled={status === 'loading'}
                />
                <button
                  type="submit"
                  disabled={status === 'loading' || status === 'success'}
                  className="bg-accent text-bg-primary px-3 py-2 rounded-r-lg text-[13px] font-medium hover:bg-accent/90 transition disabled:opacity-60"
                >
                  {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> :
                   status === 'success' ? <Check size={14} /> :
                   <ArrowRight size={14} />}
                </button>
              </form>
              {status === 'success' && (
                <p className="text-[11px] text-accent">Subscribed!</p>
              )}
              {status === 'error' && (
                <p className="text-[11px] text-red-400">{errorMsg}</p>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-white/40">
              &copy; 2026 KoeCode. All rights reserved. Developed at BaseThesis Labs
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-[12px] text-white/40 hover:text-white/60 transition-colors">
                Privacy
              </a>
              <a href="#" className="text-[12px] text-white/40 hover:text-white/60 transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
