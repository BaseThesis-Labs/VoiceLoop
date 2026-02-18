import { Link } from 'react-router-dom'

const footerLinks = {
  Arena: [
    { label: 'Battle', to: '/battle' },
    { label: 'Leaderboard', to: '/leaderboard' },
    { label: 'Playground', to: '/playground' },
    { label: 'Scenarios', to: '/scenario/s1' },
  ],
  Research: [
    { label: 'Analytics', to: '/analytics' },
    { label: 'Dataset (CC-BY)', to: '/analytics' },
    { label: 'Methodology', to: '/analytics' },
    { label: 'Cite Us', to: '/analytics' },
  ],
  Company: [
    { label: 'KoeCode', href: '/' },
    { label: 'Blog', href: '/blog' },
    { label: 'GitHub', href: '#' },
    { label: 'Twitter', href: '#' },
  ],
}

export default function ArenaFooter() {
  return (
    <footer className="border-t border-border-default bg-bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-baseline gap-1.5 mb-4">
              <span className="text-text-primary font-semibold text-[15px]">KoeCode</span>
              <span className="text-accent font-mono text-xs tracking-wider uppercase">Arena</span>
            </div>
            <p className="text-text-faint text-sm leading-relaxed max-w-[240px]">
              The first arena that evaluates voice AI the way you actually experience it.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-text-body text-xs font-mono uppercase tracking-wider mb-4">{title}</h4>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {'to' in link ? (
                      <Link to={link.to} className="text-text-faint text-sm hover:text-text-primary transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-text-faint text-sm hover:text-text-primary transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-border-default flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-faint text-xs">
            KoeCode Arena — Evaluating voice AI the way humans experience it.
          </p>
          <p className="text-text-faint text-xs font-mono">
            2026 KoeCode
          </p>
        </div>
      </div>
    </footer>
  )
}
