import { useEffect, useState } from 'react';
import { useAstronautStore } from '../store/astronautStore';
import axios from 'axios';
import { SunIcon, MoonIcon } from 'lucide-react';

interface ApiAstronaut {
  name: string;
  nationality: string;
  space_agency: string;
  notable_missions: string[];
  current_status: 'active' | 'retired' | 'deceased';
  image_url: string;
}

interface Astronaut {
  id: string;
  name: string;
  nationality: string;
  agency: string;
  missions: string[];
  status: 'active' | 'retired' | 'deceased';
  image: string;
}

export function AstronautList() {
  const { astronauts, setAstronauts } = useAstronautStore();
  const [filter, setFilter] = useState({
    nationality: '',
    agency: '',
    status: '',
  });
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const fetchAstronauts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/astronauts');
        const apiAstronauts: ApiAstronaut[] = response.data;

        // Transform API data to match the Astronaut interface
        const transformedAstronauts: Astronaut[] = apiAstronauts.map((astronaut, index) => ({
          id: `${index}-${astronaut.name}`, // Generate a unique ID
          name: astronaut.name,
          nationality: astronaut.nationality,
          agency: astronaut.space_agency,
          missions: astronaut.notable_missions,
          status: astronaut.current_status,
          image: astronaut.image_url, // Include the image URL
        }));

        setAstronauts(transformedAstronauts);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching astronauts:', error);
        setLoading(false);
      }
    };

    fetchAstronauts();
  }, [setAstronauts]);

  const filteredAstronauts = astronauts
    .filter((a) => !filter.nationality || a.nationality === filter.nationality)
    .filter((a) => !filter.agency || a.agency === filter.agency)
    .filter((a) => !filter.status || a.status === filter.status);

  const toggleTheme = () => setDarkMode(!darkMode);

  if (loading) {
    return (
      <div className={`flex justify-center items-center h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div className="text-xl">Launching into Space...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500 overflow-hidden`}>
      {/* Header */}
      <header className="flex justify-between items-center p-4 w-full z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Astronauts
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
      <div className="max-w-6xl mx-auto pt-16 pb-8 px-4 space-y-8 z-10 relative">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select
            className={`rounded-lg p-2 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
            value={filter.nationality}
            onChange={(e) => setFilter({ ...filter, nationality: e.target.value })}
          >
            <option value="">All Nationalities</option>
            {[...new Set(astronauts.map((a) => a.nationality))].map((nat) => (
              <option key={nat} value={nat}>
                {nat}
              </option>
            ))}
          </select>

          <select
            className={`rounded-lg p-2 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
            value={filter.agency}
            onChange={(e) => setFilter({ ...filter, agency: e.target.value })}
          >
            <option value="">All Agencies</option>
            {[...new Set(astronauts.map((a) => a.agency))].map((agency) => (
              <option key={agency} value={agency}>
                {agency}
              </option>
            ))}
          </select>

          <select
            className={`rounded-lg p-2 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
            <option value="deceased">Deceased</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAstronauts.length === 0 ? (
            <div className="col-span-full text-center text-gray-500">No astronauts found for this filter.</div>
          ) : (
            filteredAstronauts.map((astronaut) => (
              <div
                key={astronaut.id}
                className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 space-y-4 shadow-lg transition duration-300 hover:scale-105 hover:shadow-[0_0_10px_rgba(59,130,246,0.5)]`}
              >
                {/* Astronaut Image */}
                <img
                  src={astronaut.image}
                  alt={astronaut.name}
                  className="w-full h-40 object-cover rounded-lg shadow-md"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/300x200?text=No+Image'; // Fallback image
                  }}
                />

                {/* Astronaut Info */}
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold">{astronaut.name}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      astronaut.status === 'active'
                        ? 'bg-green-200 text-green-900'
                        : astronaut.status === 'retired'
                        ? 'bg-yellow-200 text-yellow-900'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {astronaut.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Nationality:</span> {astronaut.nationality}
                  </p>
                  <p>
                    <span className="font-semibold">Agency:</span> {astronaut.agency}
                  </p>
                  <div>
                    <p className="font-semibold">Missions:</p>
                    <ul className="list-disc list-inside">
                      {astronaut.missions.map((mission, index) => (
                        <li key={`${astronaut.id}-mission-${index}`}>{mission}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}