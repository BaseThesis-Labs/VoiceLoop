import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Code', href: '#code' },
    { label: 'Docs', href: '#' },
    { label: 'Pricing', href: '#' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-bg-primary/80 backdrop-blur-xl border-b border-border-default'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between h-16">
        <a href="#" className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="vlg" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#14b8a6" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="13" stroke="url(#vlg)" strokeWidth="2.2" fill="none" strokeDasharray="69 13" strokeLinecap="round" transform="rotate(-60 16 16)" />
            <rect x="11.5" y="12.5" width="2.2" height="7" rx="1.1" fill="url(#vlg)" />
            <rect x="14.9" y="10" width="2.2" height="12" rx="1.1" fill="url(#vlg)" />
            <rect x="18.3" y="12.5" width="2.2" height="7" rx="1.1" fill="url(#vlg)" />
          </svg>
          <span className="text-[15px] font-semibold text-text-primary tracking-tight font-[family-name:var(--font-sans)]">
            VoiceLoop
          </span>
        </a>

        <div className="hidden md:flex items-center gap-7">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] font-medium text-text-body hover:text-text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <a href="#" className="text-[13px] text-text-body hover:text-text-primary transition-colors">
            Sign in
          </a>
          <a
            href="#"
            className="inline-flex items-center px-4 py-2 text-[13px] font-semibold text-white bg-gradient-to-r from-accent to-[#10b981] rounded-lg hover:shadow-[0_0_16px_rgba(20,184,166,0.2)] transition-all duration-300"
          >
            Get Started
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-text-body"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden max-w-[1100px] mx-auto px-6 pb-6 pt-2 space-y-1 border-t border-border-default bg-bg-primary/95 backdrop-blur-xl">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block text-sm text-text-body hover:text-text-primary py-2.5"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#"
            className="block w-full text-center px-4 py-2.5 mt-3 text-sm font-semibold text-white bg-gradient-to-r from-accent to-[#10b981] rounded-lg"
          >
            Get Started
          </a>
        </div>
      )}
    </nav>
  );
}
