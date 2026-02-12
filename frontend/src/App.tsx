import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import CodeSection from './components/CodeSection';
import Footer from './components/Footer';

export default function App() {
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
