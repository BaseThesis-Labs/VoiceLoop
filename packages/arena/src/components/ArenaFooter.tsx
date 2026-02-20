import { useState } from 'react'
import { ArrowRight, Loader2, Check } from 'lucide-react'

export default function ArenaFooter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/v1/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'arena_footer' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.detail || 'Failed to subscribe')
      }
      setStatus('success')
      setEmail('')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <footer className="border-t border-border-default bg-bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-4">
            <p className="text-[15px] font-semibold text-text-primary">
              KoeCode
            </p>
            <p className="text-[13px] text-text-faint leading-relaxed max-w-[260px] text-center sm:text-left">
              The intelligence layer for production voice AI.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/Basethesislabs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-faint hover:text-text-body transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Newsletter */}
          <div className="flex flex-col items-center sm:items-end gap-3">
            <p className="text-[12px] font-mono uppercase tracking-wider text-text-faint">
              Stay updated
            </p>
            <form onSubmit={handleSubscribe} className="flex flex-row">
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-bg-primary border border-border-default rounded-l-lg px-3 py-2 text-[13px] text-text-primary placeholder-text-faint w-48 focus:outline-none focus:border-accent/50"
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

        <div className="mt-10 pt-8 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-text-faint">
            &copy; 2026 KoeCode. All rights reserved. Developed at BaseThesis Labs
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[12px] text-text-faint hover:text-text-body transition-colors">
              Privacy
            </a>
            <a href="#" className="text-[12px] text-text-faint hover:text-text-body transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
