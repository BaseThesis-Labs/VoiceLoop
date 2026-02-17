import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ArenaNavbar from './components/ArenaNavbar.tsx'
import ArenaFooter from './components/ArenaFooter.tsx'
import ArenaLanding from './pages/ArenaLanding.tsx'
import BattlePage from './pages/BattlePage.tsx'
import LeaderboardPage from './pages/LeaderboardPage.tsx'
import ModelProfilePage from './pages/ModelProfilePage.tsx'
import ScenarioDetailPage from './pages/ScenarioDetailPage.tsx'
import PlaygroundPage from './pages/PlaygroundPage.tsx'
import AnalyticsPage from './pages/AnalyticsPage.tsx'

export default function App() {
  return (
    <BrowserRouter basename="/arena">
      <div className="noise-overlay min-h-screen bg-bg-primary text-text-primary">
        <ArenaNavbar />
        <Routes>
          <Route path="/" element={<ArenaLanding />} />
          <Route path="/battle" element={<BattlePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/model/:id" element={<ModelProfilePage />} />
          <Route path="/scenario/:id" element={<ScenarioDetailPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
        <ArenaFooter />
      </div>
    </BrowserRouter>
  )
}
