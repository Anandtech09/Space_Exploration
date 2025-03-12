import { useState } from 'react';
import { SunIcon, MoonIcon } from 'lucide-react';
import { planets } from '../data/planets';
import { PlanetCard } from '../components/PlanetCard';
import { PlanetStats } from '../components/PlanetStats';
import { SolarSystem } from '../components/SolarSystem';

export function SpaceMap() {
  const [selectedPlanet, setSelectedPlanet] = useState(planets[0]);
  const [darkMode, setDarkMode] = useState(true);

  const toggleTheme = () => setDarkMode(!darkMode);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500 overflow-hidden`}>
      {/* Header */}
      <header className="flex justify-between items-center p-4 w-full z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Solar System Explorer
        </h1>
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full transition-all duration-300 ${
            darkMode
              ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600 hover:shadow-[0_0_10px_rgba(255,255,0,0.5)]'
              : 'bg-white text-indigo-600 shadow-md hover:bg-gray-100 hover:shadow-[0_0_10px_rgba(79,70,229,0.5)]'
          }`}
        >
          {darkMode ? <SunIcon size={28} /> : <MoonIcon size={28} />}
        </button>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto pt-16 pb-8 px-4 space-y-8 z-10 relative">
        {/* Solar System Visualization */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 shadow-lg`}>
          <SolarSystem darkMode={darkMode} />
        </div>

        {/* Planet Stats */}
        {selectedPlanet && (
          <div className={`${darkMode ? 'bg-gray-800 text-black' : 'bg-gray-200 text-gray-800'} rounded-lg p-6 shadow-lg`}>
            <PlanetStats planet={selectedPlanet} darkMode={darkMode} />
          </div>
        )}

        {/* Planet Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {planets.map((planet) => (
            <PlanetCard
              key={planet.id}
              planet={planet}
              onClick={setSelectedPlanet}
              darkMode={darkMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}