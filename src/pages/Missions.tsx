import { useEffect, useState } from 'react';
import { useMissionStore } from '../store/missionStore';
import axios from 'axios';
import { SunIcon, MoonIcon } from 'lucide-react';

interface ApiMission {
  mission_name: string;
  organization: string;
  country: string;
  type: 'current' | 'future' | 'past';
  start_date: string;
  end_date?: string;
  description: string;
  image_url: string;
}

interface Mission {
  id: string;
  name: string;
  organization: string;
  country: string;
  type: 'current' | 'future' | 'past';
  startDate: string;
  endDate?: string;
  description: string;
  image: string;
}

export function Missions() {
  const { missions, setMissions, filterByType } = useMissionStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'current' | 'future' | 'past'>('all');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
      const fetchMissions = async () => {
        try {
          const response = await axios.get('http://localhost:5000/api/missions');
          const apiMissions: ApiMission[] = response.data;
    
          const transformedMissions: Mission[] = apiMissions.map((mission, index) => ({
            id: `${index}-${mission.mission_name}`,
            name: mission.mission_name,
            organization: mission.organization,
            country: mission.country,
            type: mission.type,
            startDate: mission.start_date,
            endDate: mission.end_date,
            description: mission.description,
            image: mission.image_url, // Assign image
          }));
    
          setMissions(transformedMissions);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching missions:', error);
          setLoading(false);
        }
      };
    
      fetchMissions();
    }, [setMissions]);

  const filteredMissions = filter === 'all' ? missions : filterByType(filter);

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
          Space Missions
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
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">Space Missions</h1>
          <select
            className={`rounded-lg p-2 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">All Missions</option>
            <option value="current">Current Missions</option>
            <option value="future">Future Missions</option>
            <option value="past">Past Missions</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMissions.length === 0 ? (
            <div className="col-span-full text-center text-gray-500">No missions found for this filter.</div>
          ) : (
            filteredMissions.map((mission) => (
              <div
                key={mission.id}
                className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 space-y-4 shadow-lg transition duration-300 hover:scale-105 hover:shadow-[0_0_10px_rgba(34,197,94,0.5)]`}
              >
                {/* Mission Image */}
                <img
                  src={mission.image }
                  alt={mission.name}
                  className="w-full h-40 object-cover rounded-lg shadow-md"
                />

                {/* Mission Info */}
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold">{mission.name}</h3>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      mission.type === 'current'
                        ? 'bg-green-500'
                        : mission.type === 'future'
                        ? 'bg-blue-500'
                        : 'bg-gray-500'
                    }`}
                  >
                    {mission.type}
                  </span>
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Organization:</span> {mission.organization}
                  </p>
                  <p>
                    <span className="font-semibold">Country:</span> {mission.country}
                  </p>
                  <p>
                    <span className="font-semibold">Start Date:</span> {mission.startDate}
                  </p>
                  {mission.endDate && (
                    <p>
                      <span className="font-semibold">End Date:</span> {mission.endDate}
                    </p>
                  )}
                  <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{mission.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}