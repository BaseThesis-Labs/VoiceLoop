import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Check } from 'lucide-react';
import VoxelBird from './VoxelBird';

export default function Hero() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'hero_waitlist' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Failed to join waitlist');
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
    <section
      className="relative overflow-hidden min-h-screen -mt-[88px] pt-[88px] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/scene2.png')" }}
    >
      {/* Dark overlay to reduce background intensity */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      <div className="relative max-w-[1280px] mx-auto px-6 min-h-[calc(100vh-88px)] flex items-end">
        <div className="relative w-full pb-20 pt-12">
          {/* Bird — positioned diagonally above the text block's top-left */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute w-[400px] h-[300px] -top-[260px] -left-[60px] pointer-events-none"
          >
            <VoxelBird />
          </motion.div>

          {/* Left — Text content */}
          <div className="w-full lg:w-[50%] text-left">
            {/* Dark backdrop behind text block */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-black/45 backdrop-blur-sm rounded-2xl px-8 py-8 -ml-2"
            >
              {/* Category label */}
              <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase text-accent tracking-[0.15em] mb-5">
                THE VOICE AI PLATFORM
              </p>

              {/* Headline */}
              <h1 className="font-[family-name:var(--font-display)] text-[36px] md:text-[44px] lg:text-[64px] text-white tracking-[-0.02em] leading-[1.08]">
                The harness your voice stack is missing
              </h1>

              {/* Subtitle */}
              <p className="text-[17px] text-white/75 leading-relaxed mt-5 mb-8 max-w-[520px]">
                The intelligence layer for production voice AI. Measure intent as a
                mathematical function. Reason over strategy in real-time. Reconfigure
                your agent every turn.
              </p>

              {/* CTAs */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-row items-center gap-4">
                  <a
                    href="/arena/"
                    className="px-7 py-3.5 bg-accent text-[#0F172A] rounded-lg font-semibold text-sm hover:shadow-[0_0_24px_rgba(45,212,168,0.4)] transition-all duration-300"
                  >
                    Start for Free
                  </a>
                  <form onSubmit={handleWaitlist} className="flex flex-row">
                    <input
                      type="email"
                      placeholder="Your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/10 border border-white/20 rounded-l-lg px-4 py-3 text-sm text-white placeholder-white/40 w-52 focus:outline-none focus:border-white/40 backdrop-blur-sm"
                      disabled={status === 'loading'}
                    />
                    <button
                      type="submit"
                      disabled={status === 'loading' || status === 'success'}
                      className="bg-white/15 border border-white/20 border-l-0 text-white px-4 py-3 rounded-r-lg text-sm font-medium hover:bg-white/25 transition disabled:opacity-60"
                    >
                      {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> :
                       status === 'success' ? <Check size={16} /> :
                       <ArrowRight size={16} />}
                    </button>
                  </form>
                </div>
                <p className="text-[12px] text-white/50">
                  Join the waitlist to get beta access to harness!
                  {status === 'success' && <span className="text-accent ml-2">You're on the list!</span>}
                  {status === 'error' && <span className="text-red-400 ml-2">{errorMsg}</span>}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
