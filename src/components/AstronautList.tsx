import { useEffect, useState } from 'react';
import { useAstronautStore } from '../store/astronautStore';
import axios from 'axios';
import { SunIcon, MoonIcon, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Function to fetch initial astronauts from the backend
  const fetchAstronauts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('https://space-exploration-5x72.onrender.com/api/astronauts');
      const apiAstronauts: ApiAstronaut[] = response.data;

      const transformedAstronauts: Astronaut[] = apiAstronauts.map((astronaut, index) => ({
        id: `${index}-${astronaut.name}`,
        name: astronaut.name,
        nationality: astronaut.nationality,
        agency: astronaut.space_agency,
        missions: astronaut.notable_missions,
        status: astronaut.current_status,
        image: astronaut.image_url,
      }));

      setAstronauts(transformedAstronauts);
    } catch (error) {
      console.error('Error fetching astronauts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to search astronauts via the backend
  const searchAstronautsFromBackend = async (query: string) => {
    if (!query.trim()) return; // Don't search if the query is empty

    setSearchLoading(true);
    try {
      const response = await axios.post('https://space-exploration-5x72.onrender.com/api/search-astronauts', { query });
      const apiAstronauts: ApiAstronaut[] = response.data;

      const newAstronauts: Astronaut[] = apiAstronauts.map((astronaut, index) => ({
        id: `${Date.now()}-${index}-${astronaut.name}`,
        name: astronaut.name,
        nationality: astronaut.nationality,
        agency: astronaut.space_agency,
        missions: astronaut.notable_missions,
        status: astronaut.current_status,
        image: astronaut.image_url,
      }));

      // Merge new astronauts with existing ones, avoiding duplicates
      const existingNames = new Set(astronauts.map((a) => a.name.toLowerCase()));
      const uniqueNewAstronauts = newAstronauts.filter(
        (a) => !existingNames.has(a.name.toLowerCase())
      );

      setAstronauts([...astronauts, ...uniqueNewAstronauts]);
    } catch (error) {
      console.error('Error searching astronauts:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch initial data only if the store is empty
  useEffect(() => {
    if (astronauts.length === 0) {
      fetchAstronauts();
    }
  }, [astronauts, setAstronauts]);

  // Apply search and filters to the already fetched astronauts
  const filteredAstronauts = astronauts
    .filter((a) => {
      const query = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(query) ||
        a.nationality.toLowerCase().includes(query) ||
        a.agency.toLowerCase().includes(query)
      );
    })
    .filter((a) => !filter.nationality || a.nationality === filter.nationality)
    .filter((a) => !filter.agency || a.agency === filter.agency)
    .filter((a) => !filter.status || a.status === filter.status);

  // Handle search button click or Enter key press
  const handleSearch = () => {
    if (filteredAstronauts.length === 0) {
      searchAstronautsFromBackend(searchQuery);
    }
  };

  // Handle Enter key press in the search bar
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleTheme = () => setDarkMode(!darkMode);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500 overflow-hidden`}>
      {/* Header */}
      <header className="flex justify-between items-center p-4 w-full z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Astronauts
        </h1>
        <div className="flex gap-4">
          <button
            onClick={fetchAstronauts}
            className={`p-3 rounded-full transition-all duration-300 ${
              darkMode
                ? 'bg-gray-700 text-blue-300 hover:bg-gray-600 hover:shadow-[0_0_10px_rgba(0,191,255,0.5)]'
                : 'bg-white text-blue-600 shadow-md hover:bg-gray-100 hover:shadow-[0_0_10px_rgba(0,191,255,0.5)]'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={loading}
            title="Refresh astronaut list"
          >
            <RefreshCw size={28} className={loading ? 'animate-spin' : ''} />
          </button>
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
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto pt-16 pb-8 px-4 space-y-8 z-10 relative">
        {/* Search Bar with Button */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search astronauts by name, nationality, or agency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full p-3 rounded-lg ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10`}
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            className={`p-3 rounded-lg transition-all duration-300 ${
              darkMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } ${searchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={searchLoading}
          >
            <Search size={20} />
          </button>
        </div>

        {/* Filters */}
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

        {/* Astronaut List */}
        {loading && astronauts.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Launching into Space...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAstronauts.length === 0 ? (
              <div className="col-span-full text-center text-gray-500">
                {searchLoading
                  ? 'Searching for astronauts...'
                  : 'No astronauts found for this search or filter.'}
              </div>
            ) : (
              filteredAstronauts.map((astronaut) => (
                <Link to={`/astronaut/${astronaut.id}`} key={astronaut.id}>
                  <div
                    className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 space-y-4 shadow-lg transition duration-300 hover:scale-105 hover:shadow-[0_0_10px_rgba(59,130,246,0.5)]`}
                  >
                    {/* Astronaut Image */}
                    <img
                      src={astronaut.image}
                      alt={astronaut.name}
                      className="w-full h-40 object-cover rounded-lg shadow-md"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/300x200?text=No+Image';
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
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}