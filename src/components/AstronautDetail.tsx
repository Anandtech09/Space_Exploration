import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { SunIcon, MoonIcon } from 'lucide-react';
import { useAstronautStore } from '../store/astronautStore';

interface AstronautDetailData {
  biography: string;
  firstMission: string;
  family: string;
  additionalInfo: string;
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

export function AstronautDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { astronauts } = useAstronautStore();
  const [detail, setDetail] = useState<AstronautDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  const astronaut = astronauts.find((a) => a.id === id);

  useEffect(() => {
    const fetchAstronautDetails = async () => {
      if (!astronaut) {
        setError('Astronaut not found.');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.post('http://localhost:5000/api/astronaut-details', {
          name: astronaut.name,
        });
        setDetail(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching astronaut details:', err);
        setError('Failed to fetch astronaut details.');
        setLoading(false);
      }
    };

    fetchAstronautDetails();
  }, [astronaut]);

  const toggleTheme = () => setDarkMode(!darkMode);

  if (!astronaut) {
    return (
      <div className={`flex justify-center items-center h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div className="text-xl">Astronaut not found.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex justify-center items-center h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div className="text-xl">Fetching astronaut details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex justify-center items-center h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500`}>
      {/* Header */}
      <header className="flex justify-between items-center p-4 w-full z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          {astronaut.name}
        </h1>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/astronauts')}
            className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'} hover:bg-gray-600 transition-colors`}
          >
            Back
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
      <div className="max-w-4xl mx-auto pt-16 pb-8 px-4 space-y-8 z-10 relative">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 shadow-lg`}>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Astronaut Image */}
            <img
              src={astronaut.image}
              alt={astronaut.name}
              className="w-full md:w-1/3 h-60 object-cover rounded-lg shadow-md"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/300x200?text=No+Image';
              }}
            />

            {/* Basic Info */}
            <div className="flex-1 space-y-4">
              <h2 className="text-2xl font-bold">{astronaut.name}</h2>
              <p>
                <span className="font-semibold">Nationality:</span> {astronaut.nationality}
              </p>
              <p>
                <span className="font-semibold">Agency:</span> {astronaut.agency}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
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

          {/* Detailed Info */}
          {detail && (
            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold">Biography</h3>
              <p>{detail.biography}</p>

              <h3 className="text-xl font-semibold">First Mission</h3>
              <p>{detail.firstMission}</p>

              <h3 className="text-xl font-semibold">Family</h3>
              <p>{detail.family}</p>

              <h3 className="text-xl font-semibold">Additional Information</h3>
              <p>{detail.additionalInfo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}