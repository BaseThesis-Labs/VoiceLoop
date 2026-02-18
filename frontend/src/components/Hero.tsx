import { motion } from 'framer-motion';
import VoxelBird from './VoxelBird';

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden min-h-screen -mt-[88px] pt-[88px] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/scene2.png')" }}
    >
      {/* Dark overlay to reduce background intensity */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      <div className="relative max-w-[1280px] mx-auto px-6 min-h-[calc(100vh-88px)] flex items-center">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-4 w-full py-12">
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
              <div className="flex flex-row items-center gap-4">
                <a
                  href="#"
                  className="px-7 py-3.5 bg-accent text-[#0F172A] rounded-lg font-semibold text-sm hover:shadow-[0_0_24px_rgba(45,212,168,0.4)] transition-all duration-300"
                >
                  Start for Free
                </a>
                <a
                  href="#"
                  className="px-7 py-3.5 border border-white/30 text-white rounded-lg font-medium text-sm hover:bg-white/10 hover:border-white/50 transition-all duration-300"
                >
                  Contact Sales
                </a>
              </div>
            </motion.div>
          </div>

          {/* Right — Voxel dither bird */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="w-full lg:w-[50%] flex items-center justify-center"
          >
            <VoxelBird />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
