import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { to: '/battle', label: 'Battle' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/playground', label: 'Playground' },
  { to: '/analytics', label: 'Research' },
]

export default function ArenaNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location])

  return (
    <nav
      className={`sticky top-0 z-[60] transition-all duration-300 ${
        scrolled
          ? 'bg-bg-primary/80 backdrop-blur-xl border-b border-border-default shadow-[0_1px_12px_rgba(0,0,0,0.3)]'
          : 'bg-bg-primary/50 backdrop-blur-md border-b border-white/[0.04]'
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="url(#arena-logo)" strokeWidth="2" fill="none" opacity="0.9" />
              <circle cx="14" cy="14" r="5" fill="url(#arena-logo)" opacity="0.8" />
              {/* Waveform bars inside circle */}
              <rect x="8" y="11" width="2" height="6" rx="1" fill="#2DD4A8" opacity="0.6" />
              <rect x="13" y="9" width="2" height="10" rx="1" fill="#2DD4A8" opacity="0.8" />
              <rect x="18" y="11" width="2" height="6" rx="1" fill="#2DD4A8" opacity="0.6" />
              <defs>
                <linearGradient id="arena-logo" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#2DD4A8" />
                  <stop offset="1" stopColor="#34d399" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-primary font-semibold text-[15px] tracking-tight">Voice Loop</span>
            <span className="text-accent font-mono text-xs tracking-wider uppercase">Arena</span>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3.5 py-2 text-sm rounded-lg transition-colors ${
                  active
                    ? 'text-text-primary'
                    : 'text-text-body hover:text-text-primary'
                }`}
              >
                {link.label}
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-lg bg-white/[0.06]"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            )
          })}
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <Link
            to="/battle"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-[pulse-live_2s_ease-in-out_infinite]" />
            Enter Arena
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-text-body hover:text-text-primary"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border-default bg-bg-primary/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2.5 text-sm rounded-lg transition-colors ${
                    location.pathname === link.to
                      ? 'text-text-primary bg-white/[0.06]'
                      : 'text-text-body hover:text-text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/battle"
                className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent/10 text-accent border border-accent/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-[pulse-live_2s_ease-in-out_infinite]" />
                Enter Arena
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
