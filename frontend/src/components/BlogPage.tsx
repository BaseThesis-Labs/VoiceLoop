import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Calendar } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';

const blogPosts = [
  {
    slug: 'voice-arena',
    category: 'Technical Deep Dive',
    date: 'February 2026',
    title: 'Voice Arena: Why the Voice AI Stack Needs an Arena — and How We Built One',
    excerpt:
      'A 17-metric evaluation pipeline, blind human preference voting, and a programmatic Experiments API — the full technical breakdown of Voice Arena.',
    readTime: '30 min read',
    tags: ['Voice Arena', 'Evaluation', 'Open Source'],
    image: '/blog-2.png',
  },
  {
    slug: 'voice-ai-2026',
    category: 'Technical Research',
    date: 'February 2026',
    title: 'Voice AI in 2026: What\'s Actually Working, What\'s Still Broken, and Where to Build',
    excerpt:
      'We spent months digging into the entire voice AI stack — from TTS latency drops to the infrastructure gaps nobody is filling. Here\'s what we found.',
    readTime: '25 min read',
    tags: ['Voice AI', 'Infrastructure', 'Research'],
    image: '/blog-1.png',
  },
];

function BlogCard({
  post,
  index,
}: {
  post: (typeof blogPosts)[0];
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.1 }}
    >
      <Link
        to={`/blog/${post.slug}`}
        className="group block relative rounded-2xl border border-border-default bg-bg-surface overflow-hidden hover:border-accent/25 transition-all duration-400"
      >
        {/* Cover image */}
        {post.image && (
          <div className="aspect-[2.2/1] overflow-hidden">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-surface via-bg-surface/20 to-transparent" style={{ top: '40%' }} />
          </div>
        )}

        {/* Top gradient accent bar (visible when no image) */}
        {!post.image && (
          <div className="h-[2px] bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        )}

        {/* Content */}
        <div className="p-8 sm:p-10">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.12em]">
              {post.category}
            </span>
            <span className="w-1 h-1 rounded-full bg-border-strong" />
            <span className="inline-flex items-center gap-1.5 text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
              <Calendar size={11} />
              {post.date}
            </span>
            <span className="w-1 h-1 rounded-full bg-border-strong" />
            <span className="inline-flex items-center gap-1.5 text-[11px] text-text-faint font-[family-name:var(--font-mono)]">
              <Clock size={11} />
              {post.readTime}
            </span>
          </div>

          {/* Title */}
          <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-normal text-text-primary tracking-[-0.01em] leading-[1.2] mb-4 group-hover:text-white transition-colors duration-300">
            {post.title}
          </h2>

          {/* Excerpt */}
          <p className="text-[15px] text-text-body leading-relaxed mb-6 max-w-2xl">
            {post.excerpt}
          </p>

          {/* Tags + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-[10px] font-medium text-text-faint font-[family-name:var(--font-mono)] uppercase tracking-wider border border-border-default rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent group-hover:gap-2.5 transition-all duration-300">
              Read article
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Hover glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(ellipse 500px 300px at 50% 0%, rgba(20, 184, 166, 0.04), transparent)',
          }}
        />
      </Link>
    </motion.article>
  );
}

export default function BlogPage() {
  return (
    <div className="noise-overlay min-h-screen bg-bg-primary text-text-primary">
      <Navbar />

      <section className="relative pt-32 pb-24">
        {/* Background atmosphere */}
        <div className="absolute inset-0 dot-grid" />
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `
              radial-gradient(ellipse 600px 400px at 30% 15%, rgba(20, 184, 166, 0.06), transparent),
              radial-gradient(ellipse 500px 350px at 70% 50%, rgba(6, 182, 212, 0.04), transparent)
            `,
          }}
        />

        <div className="relative max-w-[840px] mx-auto px-6">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-14"
          >
            <span className="inline-block text-[11px] font-semibold text-accent font-[family-name:var(--font-mono)] uppercase tracking-[0.15em] mb-4">
              Blog
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl lg:text-[56px] font-normal text-text-primary tracking-[-0.01em] leading-[1.1] mb-4">
              Insights &{' '}
              <span className="bg-gradient-to-r from-accent to-[#34d399] bg-clip-text text-transparent">
                Research
              </span>
            </h1>
            <p className="text-[15px] text-text-body leading-relaxed max-w-lg">
              Deep dives into voice AI infrastructure, technical research, and the
              future of conversational AI.
            </p>
          </motion.div>

          {/* Blog posts */}
          <div className="space-y-6">
            {blogPosts.map((post, i) => (
              <BlogCard key={post.slug} post={post} index={i} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
