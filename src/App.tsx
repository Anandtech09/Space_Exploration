import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Astronauts } from './pages/Astronauts';
import { Missions } from './pages/Missions';
import { SpaceMap } from './pages/SpaceMap';
import { NasaData } from './pages/NasaData';
import { SpaceQuiz } from './pages/SpaceQuiz';
import { AsteroidBlaster } from './pages/games/AsteroidBlaster';
import { SpaceJump } from './pages/games/SpaceJump';
import { SpaceRace } from './pages/games/SpaceRace';
import { SpaceMemory } from './pages/games/SpaceMemory';
import { AstronautDetail } from './components/AstronautDetail';

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/astronauts" element={<Astronauts />} />
        <Route path="/astronaut/:id" element={<AstronautDetail />} />
        <Route path="/missions" element={<Missions />} />
        <Route path="/space-map" element={<SpaceMap />} />
        <Route path="/nasa-data" element={<NasaData />} />
        <Route path="/space-quiz" element={<SpaceQuiz />} />
        <Route path="/games/asteroid-blaster" element={<AsteroidBlaster />} />
        <Route path="/games/space-jump" element={<SpaceJump />} />
        <Route path="/games/space-race" element={<SpaceRace />} />
        <Route path="/games/space-memory" element={<SpaceMemory />} />
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </Router>
  );
}

export default App;