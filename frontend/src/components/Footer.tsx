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
      {/* CTA Card Section */}
      <div className="max-w-[1280px] mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden relative"
        >
          {/* Aurora gradient background */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background: `
                radial-gradient(ellipse 600px 350px at 50% 0%, rgba(45, 212, 168, 0.08), transparent),
                radial-gradient(ellipse 400px 250px at 30% 80%, rgba(6, 182, 212, 0.05), transparent)
              `,
            }}
          />

          {/* Content */}
          <div className="relative z-10 text-center px-8 sm:px-16 py-16 sm:py-24">
            <h2 className="font-[family-name:var(--font-display)] text-3xl lg:text-4xl text-text-primary tracking-[-0.01em] mb-4">
              Start building intelligent voice agents
            </h2>
            <p className="text-[16px] text-text-body mb-10 max-w-md mx-auto">
              Free to start. Scale as you grow. No credit card required.
            </p>
            <div className="flex flex-row items-center justify-center gap-4">
              <a
                href="#"
                className="px-7 py-3.5 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:shadow-[0_0_24px_rgba(45,212,168,0.2)] transition"
              >
                Start for Free
              </a>
              <a
                href="#"
                className="px-7 py-3.5 border border-border-strong text-text-body rounded-lg font-medium text-sm hover:text-text-primary hover:border-text-faint transition"
              >
                Talk to Sales
              </a>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer Links Section */}
      <div className="max-w-[1280px] mx-auto px-6 pb-16">
        <div className="border-t border-border-default pt-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Column 1: Brand */}
            <div className="col-span-2">
              <p className="text-[15px] font-semibold text-text-primary mb-4">
                KoeCode
              </p>
              <p className="text-[13px] text-text-body leading-relaxed mb-5 max-w-[260px]">
                The intelligence layer for production voice AI.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="text-text-faint hover:text-text-body transition-colors">
                  <Github size={16} />
                </a>
                <a href="#" className="text-text-faint hover:text-text-body transition-colors">
                  <Twitter size={16} />
                </a>
              </div>

              {/* Newsletter input */}
              <div className="mt-5 flex flex-row">
                <input
                  type="email"
                  placeholder="Your email"
                  className="bg-bg-hover border border-border-default rounded-l-lg px-3 py-2 text-[13px] text-text-primary placeholder-text-faint w-48 focus:outline-none focus:border-border-strong"
                />
                <button className="bg-accent text-bg-primary px-3 py-2 rounded-r-lg text-[13px] font-medium hover:bg-accent/90 transition">
                  <ArrowRight size={14} />
                </button>
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

          {/* Bottom bar */}
          <div className="mt-10 pt-8 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-text-faint">
              &copy; 2026 KoeCode. All rights reserved.
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
