import { Github, Twitter, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const footerLinks = [
  {
    title: 'Product',
    links: ['Features', 'Pricing', 'Changelog', 'Roadmap'],
  },
  {
    title: 'Developers',
    links: ['Documentation', 'API Reference', 'SDKs', 'Status'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog', 'Careers', 'Contact'],
  },
];

export default function Footer() {
  return (
    <footer className="relative">
      {/* Divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] max-w-[600px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      {/* CTA Section */}
      <div className="max-w-[1100px] mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border border-border-default bg-bg-surface"
        >
          {/* Decorative gradient */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-accent/[0.06] to-transparent blur-3xl pointer-events-none" />
          <div className="relative z-10 text-center px-6 sm:px-16 py-14 sm:py-20">
            <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl lg:text-4xl font-normal text-text-primary tracking-[-0.01em] mb-4">
              Start building better Voice AI today
            </h2>
            <p className="text-[15px] text-text-body mb-8 max-w-md mx-auto">
              Free to start. Scale as you grow. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#"
                className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-accent to-[#10b981] rounded-lg hover:shadow-[0_0_24px_rgba(20,184,166,0.25)] transition-all duration-300"
              >
                Get Started Free
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="#"
                className="inline-flex items-center px-6 py-3.5 text-sm font-medium text-text-body border border-border-default rounded-lg hover:text-text-primary hover:border-border-strong transition-all duration-300"
              >
                Talk to us
              </a>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer links */}
      <div className="max-w-[1100px] mx-auto px-6 pb-16">
        <div className="border-t border-border-default pt-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-2 mb-4 lg:mb-0">
              <div className="flex items-center gap-2.5 mb-4">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <defs>
                    <linearGradient id="vlg-f" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#14b8a6" />
                      <stop offset="1" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <circle cx="16" cy="16" r="13" stroke="url(#vlg-f)" strokeWidth="2.2" fill="none" strokeDasharray="69 13" strokeLinecap="round" transform="rotate(-60 16 16)" />
                  <rect x="11.5" y="12.5" width="2.2" height="7" rx="1.1" fill="url(#vlg-f)" />
                  <rect x="14.9" y="10" width="2.2" height="12" rx="1.1" fill="url(#vlg-f)" />
                  <rect x="18.3" y="12.5" width="2.2" height="7" rx="1.1" fill="url(#vlg-f)" />
                </svg>
                <span className="text-[15px] font-semibold text-text-primary font-[family-name:var(--font-sans)]">
                  VoiceLoop
                </span>
              </div>
              <p className="text-[13px] text-text-body leading-relaxed mb-5 max-w-[260px]">
                The operating system for Voice AI. Evals, observability, and self-evolving agents.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="text-text-faint hover:text-text-body transition-colors">
                  <Github size={16} />
                </a>
                <a href="#" className="text-text-faint hover:text-text-body transition-colors">
                  <Twitter size={16} />
                </a>
              </div>
            </div>

            {/* Link columns */}
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-[12px] font-semibold text-text-body font-[family-name:var(--font-mono)] uppercase tracking-wider mb-4">
                  {group.title}
                </h4>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-[13px] text-text-body hover:text-text-primary transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-text-faint">
              &copy; {new Date().getFullYear()} VoiceLoop. All rights reserved.
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
      </div>
    </footer>
  );
}
