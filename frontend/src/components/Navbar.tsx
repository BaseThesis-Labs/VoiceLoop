import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Voice Arena', href: '/arena/' },
  { label: 'Blog', to: '/blog' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  function resolveHref(link: (typeof navLinks)[number]): string {
    if (link.to) return link.to;
    return link.href ?? '#';
  }

  function renderNavLink(
    link: (typeof navLinks)[number],
    className: string,
    onClick?: () => void,
  ) {
    const href = resolveHref(link);
    const isRouterLink = href.startsWith('/') && !href.startsWith('/#') && !href.startsWith('/arena');

    if (isRouterLink) {
      return (
        <Link
          key={link.label}
          to={href}
          className={className}
          onClick={onClick}
        >
          {link.label}
        </Link>
      );
    }

    return (
      <a
        key={link.label}
        href={href}
        className={className}
        onClick={onClick}
      >
        {link.label}
      </a>
    );
  }

  return (
    <div className="sticky top-0 z-[60] w-full flex justify-center px-4 bg-transparent pointer-events-none">
      <nav
        className={`w-full max-w-[1060px] h-14 mt-2 rounded-2xl transition-all duration-300 pointer-events-auto ${
          scrolled
            ? 'bg-bg-primary/90 backdrop-blur-xl border border-border-default shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
            : 'bg-bg-primary/80 backdrop-blur-md border border-white/[0.06]'
        }`}
      >
        <div className="px-5 h-full flex items-center justify-between">
        {/* ── Logo + Wordmark ── */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient
                id="vlg"
                x1="2"
                y1="2"
                x2="30"
                y2="30"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#2DD4A8" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <circle
              cx="16"
              cy="16"
              r="13"
              stroke="url(#vlg)"
              strokeWidth="2.2"
              fill="none"
              strokeDasharray="69 13"
              strokeLinecap="round"
              transform="rotate(-60 16 16)"
            />
            <rect x="11.5" y="12.5" width="2.2" height="7" rx="1.1" fill="url(#vlg)" />
            <rect x="14.9" y="10" width="2.2" height="12" rx="1.1" fill="url(#vlg)" />
            <rect x="18.3" y="12.5" width="2.2" height="7" rx="1.1" fill="url(#vlg)" />
          </svg>
          <span className="text-[15px] font-semibold text-text-primary tracking-tight font-[family-name:var(--font-sans)]">
            KoeCode
          </span>
        </Link>

        {/* ── Center Nav Links (desktop) ── */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((link) =>
            renderNavLink(
              link,
              'text-[13px] font-medium text-text-body hover:text-text-primary transition-colors',
            ),
          )}
        </div>

        {/* ── Right Actions (desktop) ── */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <a
            href="/arena/"
            className="inline-flex items-center px-4 py-2 text-[13px] font-semibold text-accent border border-accent rounded-lg hover:bg-accent/10 transition-all"
          >
            Start for Free
          </a>
        </div>

        {/* ── Mobile Hamburger ── */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden p-2 text-text-body hover:text-text-primary transition-colors"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        </div>

        {/* ── Mobile Menu ── */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-x-0 top-[4.5rem] bottom-0 bg-bg-primary/95 backdrop-blur-xl border-t border-border-default overflow-y-auto rounded-b-2xl">
            <div className="px-5 py-6 flex flex-col gap-1">
              {navLinks.map((link) =>
                renderNavLink(
                  link,
                  'block text-sm font-medium text-text-body hover:text-text-primary py-3 transition-colors',
                  () => setMobileOpen(false),
                ),
              )}

              <div className="mt-4 pt-4 border-t border-border-default flex flex-col gap-3">
                <a
                  href="/arena/"
                  className="block w-full text-center text-sm font-semibold text-accent border border-accent rounded-lg px-4 py-2.5 hover:bg-accent/10 transition-all"
                >
                  Start for Free
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
