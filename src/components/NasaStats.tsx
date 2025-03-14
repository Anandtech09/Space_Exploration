import { useEffect, useState } from 'react';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import axios from 'axios';
import { SunIcon, MoonIcon } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface NasaStats {
  asteroid_data: {
    count: number;
    details: any[];
  };
  launches_by_year: Record<string, number>;
  missions_by_type: Record<string, number>;
}

interface StoredData {
  stats: NasaStats;
  timestamp: string; // ISO string format (e.g., "2025-03-12T10:00:00.000Z")
}

interface ChartData {
  labels: string[];
  datasets: {
    label?: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string[];
    tension?: number;
  }[];
}

interface Asteroid {
  name: string;
  nasa_jpl_url: string;
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: {
    close_approach_date: string;
    miss_distance: {
      kilometers: string;
    };
  }[];
}

export function NasaStats() {
  const [stats, setStats] = useState<NasaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Transform raw API data into Chart.js format
  const transformData = (stats: NasaStats): { launches: ChartData; missions: ChartData } => {
    const launches = {
      labels: Object.keys(stats.launches_by_year),
      datasets: [
        {
          label: 'Launches per Year',
          data: Object.values(stats.launches_by_year),
          borderColor: darkMode ? 'rgb(75, 192, 192)' : 'rgb(54, 162, 235)',
          tension: 0.1,
        },
      ],
    };

    const missions = {
      labels: Object.keys(stats.missions_by_type),
      datasets: [
        {
          data: Object.values(stats.missions_by_type),
          backgroundColor: darkMode
            ? ['rgb(255, 99, 132)', 'rgb(54, 162, 235)', 'rgb(255, 205, 86)', 'rgb(75, 192, 192)']
            : ['rgb(255, 159, 64)', 'rgb(75, 192, 192)', 'rgb(153, 102, 255)', 'rgb(255, 206, 86)'],
        },
      ],
    };

    return { launches, missions };
  };

  // Transform asteroid data for display
  const transformAsteroids = (details: any[]): Asteroid[] => {
    return details.map((asteroid: any) => ({
      name: asteroid.name,
      nasa_jpl_url: asteroid.nasa_jpl_url,
      is_potentially_hazardous_asteroid: asteroid.is_potentially_hazardous_asteroid,
      close_approach_data: asteroid.close_approach_data,
    }));
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${process.env.BACKEND_API}/api/nasa/stats`);
        const newStats = response.data;
        const timestamp = new Date().toISOString();
        
        // Store in localStorage with timestamp
        const storedData: StoredData = { stats: newStats, timestamp };
        localStorage.setItem('nasaStats', JSON.stringify(storedData));
        
        setStats(newStats);
        setLastUpdated(timestamp);
        setLoading(false);
        setError(null);
      } catch (error) {
        console.error('Error fetching NASA stats:', error);
        setLoading(false);
        setError('Failed to fetch NASA stats. Try refreshing to re-enter orbit!');
      }
    };

    // Check localStorage for existing data
    const stored = localStorage.getItem('nasaStats');
    if (stored) {
      const storedData: StoredData = JSON.parse(stored);
      const storedTime = new Date(storedData.timestamp).getTime();
      const currentTime = new Date().getTime();
      const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds

      // If data is less than 1 hour old, use it
      if (currentTime - storedTime < oneHourInMs) {
        setStats(storedData.stats);
        setLastUpdated(storedData.timestamp);
        setLoading(false);
        setError(null);
      } else {
        // Data is older than 1 hour, fetch new data
        fetchStats();
      }
    } else {
      // No data in localStorage, fetch new data
      fetchStats();
    }
  }, []);

  const toggleTheme = () => setDarkMode(!darkMode);

  if (loading) {
    return (
      <div className={`flex justify-center items-center h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div className="text-xl">Launching into Space...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col justify-center items-center h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <h2 className="text-3xl font-bold mb-4">{error}</h2>
        <p className="text-xl">It seems we've drifted off course. Try refreshing to re-enter orbit!</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`flex justify-center items-center h-64 ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        Error loading statistics
      </div>
    );
  }

  const { launches, missions } = transformData(stats);
  const asteroids = transformAsteroids(stats.asteroid_data.details);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500 overflow-hidden`}>
      {/* Header */}
      <header className="flex justify-between items-center p-4 w-full z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          NASA Stats
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

      {/* Charts Layout */}
      <div className="max-w-6xl mx-auto pt-16 pb-8 px-4 z-10 relative">
        {/* Last Updated Timestamp */}
        {lastUpdated && (
          <div className="mb-6 text-center">
            <p className="text-gray-400">
              Last Updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Line Chart (Left) */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 shadow-lg flex-1 min-w-0`}>
            <h3 className="text-xl font-bold mb-4">Launches by Year</h3>
            <div className="h-64">
              <Line
                data={launches}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Launches per Year' },
                  },
                  scales: {
                    y: { beginAtZero: true },
                  },
                }}
              />
            </div>
          </div>

          {/* Pie Chart (Right) */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 shadow-lg flex-1 min-w-0`}>
            <h3 className="text-xl font-bold mb-4">Mission Types Distribution</h3>
            <div className="h-64">
              <Pie
                data={missions}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right' },
                    title: { display: true, text: 'Mission Types' },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Asteroid Section */}
        <div className="mt-12">
          <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
            Near-Earth Objects (NEOs) - Asteroid Insights
          </h2>
          <p className="mb-6 text-gray-400">
            Explore asteroids tracked by NASA's NEO Web Service (NeoWs), which provides data on near-Earth objects based on their closest approach dates, JPL IDs, and overall dataset.
          </p>
          {stats.asteroid_data.count === 0 ? (
            <p className="text-center text-gray-500">No asteroids detected in the last 24 hours.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {asteroids.map((asteroid, index) => (
                <div
                  key={index}
                  className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-6 shadow-lg transition duration-300 hover:scale-105 hover:shadow-[0_0_10px_rgba(59,130,246,0.5)]`}
                >
                  <h4 className="text-lg font-semibold mb-2">{asteroid.name}</h4>
                  <a
                    href={asteroid.nasa_jpl_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    View JPL Details
                  </a>
                  <p className="mt-2">
                    <span className="font-medium">Closest Approach:</span>{' '}
                    {asteroid.close_approach_data[0]?.close_approach_date || 'N/A'}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Miss Distance:</span>{' '}
                    {asteroid.close_approach_data[0]?.miss_distance.kilometers || 'N/A'} km
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Hazardous:</span>{' '}
                    {asteroid.is_potentially_hazardous_asteroid ? 'Yes' : 'No'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}