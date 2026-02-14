import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import CodeSection from './components/CodeSection';
import Footer from './components/Footer';
import BlogPage from './components/BlogPage';
import BlogPostPage from './components/BlogPostPage';

function HomePage() {
  return (
    <div className="noise-overlay min-h-screen bg-bg-primary text-text-primary">
      <Navbar />
      <Hero />
      <Features />
      <CodeSection />
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
      </Routes>
    </BrowserRouter>
  );
}
