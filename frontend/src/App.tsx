import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AnnouncementBar from './components/AnnouncementBar';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import InteractiveDemo from './components/InteractiveDemo';
import IntentApiSection from './components/IntentApiSection';
import DecisionIntelligenceSection from './components/DecisionIntelligenceSection';
import EvalsArenaSection from './components/EvalsArenaSection';
import TextToAgentSection from './components/TextToAgentSection';
import SocialProof from './components/SocialProof';
import CodeSection from './components/CodeSection';
import Footer from './components/Footer';
import BlogPage from './components/BlogPage';
import BlogPostPage from './components/BlogPostPage';
import DocsPage from './components/DocsPage';

function HomePage() {
  return (
    <div className="noise-overlay min-h-screen bg-bg-primary text-text-primary">
      <AnnouncementBar />
      <Navbar />
      <Hero />
      <InteractiveDemo />
      <EvalsArenaSection />
      <IntentApiSection />
      <DecisionIntelligenceSection />
      <TextToAgentSection />
      <SocialProof />
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
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
      </Routes>
    </BrowserRouter>
  );
}
