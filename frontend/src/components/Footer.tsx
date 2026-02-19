import { Github, Twitter, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer
      className="relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/footer.png')" }}
    >
      {/* Dark overlay to match hero background intensity */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* CTA Card Section */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="rounded-2xl border border-border-default bg-bg-surface/90 backdrop-blur-sm overflow-hidden relative"
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
            </div>
          </div>
        </motion.div>
      </div>

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
                <a href="#" className="text-white/40 hover:text-white/70 transition-colors">
                  <Github size={16} />
                </a>
                <a href="#" className="text-white/40 hover:text-white/70 transition-colors">
                  <Twitter size={16} />
                </a>
              </div>
            </div>

            {/* Newsletter */}
            <div className="flex flex-col items-center sm:items-end gap-3">
              <p className="text-[12px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-white/50">
                Stay updated
              </p>
              <div className="flex flex-row">
                <input
                  type="email"
                  placeholder="Your email"
                  className="bg-white/10 border border-white/15 rounded-l-lg px-3 py-2 text-[13px] text-white placeholder-white/40 w-48 focus:outline-none focus:border-white/30 backdrop-blur-sm"
                />
                <button className="bg-accent text-bg-primary px-3 py-2 rounded-r-lg text-[13px] font-medium hover:bg-accent/90 transition">
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-white/40">
              &copy; 2026 KoeCode. All rights reserved.
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
