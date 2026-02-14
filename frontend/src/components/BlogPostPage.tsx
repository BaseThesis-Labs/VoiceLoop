import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import VoiceAIBlog from './VoiceAIBlog';

export default function BlogPostPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="noise-overlay min-h-screen bg-bg-primary text-text-primary">
      <Navbar />

      {/* Back to blog link */}
      <div className="max-w-[740px] mx-auto px-6 pt-24 pb-2">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-[13px] text-text-faint hover:text-accent font-[family-name:var(--font-mono)] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to blog
          </Link>
        </motion.div>
      </div>

      {/* Blog content — the component manages its own styling */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <VoiceAIBlog />
      </motion.div>

      <Footer />
    </div>
  );
}
