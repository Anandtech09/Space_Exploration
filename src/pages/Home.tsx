import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { SpaceJourney } from '../components/SpaceJourney';
import { SearchBar } from '../components/SearchBar';
import * as THREE from 'three';
import { BotIcon, XIcon, SendIcon, MoonIcon, SunIcon, CloudIcon, CloudRain } from 'lucide-react';

interface APOD {
  title: string;
  url: string;
  explanation: string;
  date: string;
  media_type: 'image' | 'video' | 'other';
}

interface WeatherData {
  dataseries: Array<{
    timepoint: number;
    temp2m: number;
    weather?: string;
    wind10m: {
      direction: string;
      speed: number;
    };
    rh2m: string;
  }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Article {
  title: string;
  summary: string;
  imageUrl: string;
  link: string;
  date: string;
}

interface Launch {
  name: string;
  date_utc: string;
  details: string;
  links: {
    patch: {
      small: string;
    };
  };
}

type LocationPermissionStatus = 'not_asked' | 'granted' | 'denied' | 'error';

export function Home() {
  const [apod, setApod] = useState<APOD | null>(null);
  const [apodLoading, setApodLoading] = useState(true);
  const [apodError, setApodError] = useState<string>('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchedArticles, setSearchedArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [upcomingLaunches, setUpcomingLaunches] = useState<Launch[]>([]);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<LocationPermissionStatus>('not_asked');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string>('');

  // State to track broken images
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const solarSystemContainerRef = useRef<HTMLDivElement>(null);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Three.js background animation (unchanged)
  useEffect(() => {
    if (threeContainerRef.current) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      threeContainerRef.current.appendChild(renderer.domElement);

      const starsGeometry = new THREE.BufferGeometry();
      const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
      const starsVertices = [];
      for (let i = 0; i < 5000; i++) {
        const x = THREE.MathUtils.randFloatSpread(2000);
        const y = THREE.MathUtils.randFloatSpread(2000);
        const z = THREE.MathUtils.randFloatSpread(2000);
        starsVertices.push(x, y, z);
      }
      starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
      const stars = new THREE.Points(starsGeometry, starsMaterial);
      scene.add(stars);

      camera.position.z = 5;

      const animate = () => {
        requestAnimationFrame(animate);
        stars.rotation.x += 0.0001;
        stars.rotation.y += 0.0001;
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (threeContainerRef.current) {
          threeContainerRef.current.removeChild(renderer.domElement);
        }
      };
    }
  }, []);

  // Fetch initial data with local storage priority
  useEffect(() => {
    const today = getTodayDate();
    const articlesCacheKey = `articles-${today}`;
    const apodCacheKey = `apod_${today}`;

    const loadCachedData = () => {
      const cachedArticles = localStorage.getItem(articlesCacheKey);
      if (cachedArticles) {
        const parsedArticles = JSON.parse(cachedArticles);
        if (Array.isArray(parsedArticles) && parsedArticles.length > 0) {
          setArticles(parsedArticles);
        }
      }

      const cachedApod = localStorage.getItem(apodCacheKey);
      if (cachedApod) {
        const parsedApod = JSON.parse(cachedApod);
        if (
          parsedApod &&
          typeof parsedApod === 'object' &&
          'title' in parsedApod &&
          'url' in parsedApod &&
          'explanation' in parsedApod &&
          'date' in parsedApod &&
          'media_type' in parsedApod
        ) {
          setApod(parsedApod);
        }
      }
    };

    const fetchInitialData = async () => {
      setApodLoading(true);
      setLoading(true);

      if (!apod) {
        try {
          const apodRes = await axios.get('https://space-exploration-5x72.onrender.com/api/nasa/apod', {
            timeout: 25000,
            headers: { 'Accept': 'application/json' },
          });

          const contentType = apodRes.headers['content-type'];
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('API returned HTML instead of JSON');
          }

          if (
            apodRes.data &&
            typeof apodRes.data === 'object' &&
            'title' in apodRes.data &&
            'url' in apodRes.data &&
            'explanation' in apodRes.data &&
            'date' in apodRes.data &&
            'media_type' in apodRes.data
          ) {
            setApod(apodRes.data);
            localStorage.setItem(apodCacheKey, JSON.stringify(apodRes.data));
          } else {
            throw new Error('Invalid APOD data received from API');
          }
        } catch (err) {
          console.error('Failed to fetch APOD:', err);
          if (axios.isAxiosError(err)) {
            setApodError(`Failed to fetch APOD: ${err.message}`);
          } else {
            setApodError('Failed to fetch Astronomy Picture of the Day.');
          }
        } finally {
          setApodLoading(false);
        }
      } else {
        setApodLoading(false);
      }

      if (!articles.length) {
        try {
          const articlesRes = await axios.get(`https://space-exploration-5x72.onrender.com/api/articles?date=${today}`);
          setArticles(articlesRes.data);
          localStorage.setItem(articlesCacheKey, JSON.stringify(articlesRes.data));
        } catch (err) {
          console.error('Failed to fetch articles:', err);
          if (axios.isAxiosError(err) && err.response) {
            setError(`Failed to fetch articles: ${err.response.data.detail || 'Unknown server error'}`);
          } else {
            setError('Failed to fetch articles: Network issue.');
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadCachedData();
    if (!apod || !articles.length) {
      fetchInitialData();
    } else {
      setApodLoading(false);
      setLoading(false);
    }
  }, []);

  // Handle image load errors
  const handleImageError = (imageUrl: string) => {
    setBrokenImages((prev) => new Set(prev).add(imageUrl));
  };

  // Remaining useEffects and functions (unchanged for brevity)
  const fetchWeatherData = async (latitude: number, longitude: number) => {
    try {
      setWeatherLoading(true);
      setWeatherError('');
      
      const weatherRes = await axios.get('https://space-exploration-5x72.onrender.com/api/space-weather', {
        headers: { 'X-Latitude': latitude.toString(), 'X-Longitude': longitude.toString() },
      });
      
      setWeather(weatherRes.data);
      return true;
    } catch (err) {
      console.error('Weather fetch error:', err);
      setWeatherError('Failed to fetch space weather data.');
      return false;
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    const savedStatus = localStorage.getItem('locationPermissionStatus');
    if (savedStatus === 'granted') {
      setLocationPermissionStatus('granted');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          await fetchWeatherData(latitude, longitude);
        },
        (err) => {
          console.error('Geolocation error:', err);
          setLocationPermissionStatus('error');
          setWeatherError(`Unable to determine location: ${err.message}`);
        },
        { timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const requestLocationPermission = () => {
    setWeatherLoading(true);
    setWeatherError('');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        
        const success = await fetchWeatherData(latitude, longitude);
        if (success) {
          setLocationPermissionStatus('granted');
          localStorage.setItem('locationPermissionStatus', 'granted');
        } else {
          setLocationPermissionStatus('error');
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        if (err.code === 1) {
          setLocationPermissionStatus('denied');
          setWeatherError('Location access was denied. Please enable location services to view weather data.');
        } else {
          setLocationPermissionStatus('error');
          setWeatherError(`Unable to determine location: ${err.message}`);
        }
        setWeatherLoading(false);
      },
      { timeout: 10000, maximumAge: 0 }
    );
  };

  const denyLocationPermission = () => {
    setLocationPermissionStatus('denied');
    setWeatherError('You need to accept location permission to see weather data.');
    setWeatherLoading(false);
  };

  useEffect(() => {
    const fetchLaunches = async () => {
      try {
        console.log('Fetching upcoming launches...');
        const response = await axios.get('https://api.spacexdata.com/v4/launches/upcoming');
        setUpcomingLaunches(response.data.slice(0, 3));
      } catch (err) {
        console.error('Failed to fetch launches:', err);
      }
    };
    fetchLaunches();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSearch = async (query: string) => {
    try {
      setLoading(true);
      console.log('Fetching search articles with query:', query);
      const response = await axios.get(`https://space-exploration-5x72.onrender.com/api/articles?query=${query}`);
      setSearchedArticles(response.data);
    } catch (err) {
      console.error('Failed to fetch search articles:', err);
      setError('Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim()) return;
    const newMessage: ChatMessage = { role: 'user', content: userInput };
    setChatMessages([...chatMessages, newMessage]);
    setUserInput('');
    setChatLoading(true);

    try {
      console.log('Sending chat message:', userInput);
      const response = await axios.post(`https://space-exploration-5x72.onrender.com/api/chat`, { message: userInput });
      setChatMessages([...chatMessages, newMessage, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages([...chatMessages, newMessage, { role: 'assistant', content: 'Error processing request.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleTheme = () => setDarkMode(!darkMode);

  const getWeatherIcon = (condition: string | undefined) => {
    if (!condition) return <CloudIcon size={36} className="text-gray-400" />;
    return condition.includes('clear') ? (
      <SunIcon size={36} className="text-yellow-400" />
    ) : condition.includes('cloud') ? (
      <CloudIcon size={36} className="text-gray-400" />
    ) : condition.includes('rain') ? (
      <CloudRain size={36} className="text-blue-400" />
    ) : (
      <CloudIcon size={36} className="text-gray-400" />
    );
  };

  const getTimeOfDay = () => (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'day' : 'night');

  const renderTemperatureTrend = (data: WeatherData['dataseries']) => {
    const points = data.slice(0, 8);
    if (!points.length) return null;

    const width = 700;
    const height = 300;
    const radius = Math.min(width / 2, height) / 2 - 20;
    const centerX = width / 2 - 150;
    const centerY = height / 2;

    const totalTemp = points.reduce((sum, point) => sum + point.temp2m, 0);
    const colors = ['#4f46e5', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'];

    let startAngle = 0;

    const slices = points.map((point, index) => {
      const percentage = point.temp2m / totalTemp;
      const angle = percentage * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const expansionFactor = hoveredSlice === index ? 0.1 : 0;
      const expandedRadius = radius * (1 + expansionFactor);

      const midAngle = startAngle + angle / 2;
      const expandedCenterX = centerX + (expansionFactor * radius * Math.cos(midAngle));
      const expandedCenterY = centerY + (expansionFactor * radius * Math.sin(midAngle));

      const startX = expandedCenterX + expandedRadius * Math.cos(startAngle);
      const startY = expandedCenterY + expandedRadius * Math.sin(startAngle);
      const endX = expandedCenterX + expandedRadius * Math.cos(endAngle);
      const endY = expandedCenterY + expandedRadius * Math.sin(endAngle);
      const largeArcFlag = angle > Math.PI ? 1 : 0;

      const path = `
        M ${expandedCenterX},${expandedCenterY}
        L ${startX},${startY}
        A ${expandedRadius},${expandedRadius} 0 ${largeArcFlag} 1 ${endX},${endY}
        Z
      `;

      startAngle = endAngle;

      return (
        <path
          key={index}
          d={path}
          fill={colors[index % colors.length]}
          stroke={darkMode ? '#fff' : '#000'}
          strokeWidth="1"
          onMouseEnter={() => setHoveredSlice(index)}
          onMouseLeave={() => setHoveredSlice(null)}
          style={{ transition: 'all 0.3s ease-in-out' }}
        />
      );
    });

    const tooltipContent = hoveredSlice !== null ? (
      <g>
        <rect x={width / 2} y={20} width={150} height={30} rx={5} fill="rgba(0, 0, 0, 0.7)" />
        <text x={width / 2 + 10} y={40} fill="#fff" fontSize="14">
          {`+${points[hoveredSlice].timepoint}h: ${points[hoveredSlice].temp2m}°C`}
        </text>
      </g>
    ) : null;

    const legend = points.map((point, index) => (
      <g key={index} transform={`translate(20, ${20 + index * 20})`}>
        <rect
          width="15"
          height="15"
          fill={colors[index % colors.length]}
          onMouseEnter={() => setHoveredSlice(index)}
          onMouseLeave={() => setHoveredSlice(null)}
        />
        <text x="30" y="12" fill={darkMode ? '#fff' : '#000'} fontSize="12">
          {`+${point.timepoint}h: ${point.temp2m}°C`}
        </text>
      </g>
    ));

    return (
      <svg width="100%" height={height + 40} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(0, 20)`}>
          {slices}
          {tooltipContent}
          <g transform={`translate(${width - 200}, 0)`}>{legend}</g>
        </g>
      </svg>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div
          ref={threeContainerRef}
          className={`fixed top-0 left-0 w-full h-full z-0 pointer-events-none ${!darkMode && 'opacity-20'}`}
        />
        <div className="z-10 flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-xl">Loading your cosmic journey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'}`}>
        <div
          ref={threeContainerRef}
          className={`fixed top-0 left-0 w-full h-full z-0 pointer-events-none ${!darkMode && 'opacity-20'}`}
        />
        <div className="z-10 bg-red-100 border border-red-400 text-red-700 px-8 py-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-2">Houston, we have a problem!</h2>
          <p>{error}</p>
          <button
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            Retry Mission
          </button>
        </div>
      </div>
    );
  }

  const renderWeatherContent = () => {
    if (locationPermissionStatus === 'granted' && weather) {
      return (
        <>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              {getTimeOfDay() === 'day' ? (
                <SunIcon size={48} className="text-yellow-400 mr-4" />
              ) : (
                <MoonIcon size={48} className="text-blue-300 mr-4" />
              )}
              <div>
                <p className="text-3xl font-bold">{weather.dataseries[0].temp2m}°C</p>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Current Temperature</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Humidity: {weather.dataseries[0].rh2m}%
              </p>
              <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Wind: {weather.dataseries[0].wind10m.speed} km/h
              </p>
            </div>
          </div>
          {location && (
            <div className="flex items-center mb-4">
              <span className="bg-gray-700 text-white px-2 py-1 rounded-full mr-2 hover:bg-gray-600 transition-colors">
                Latitude: {location.latitude.toFixed(2)}
              </span>
              <span className="bg-gray-700 text-white px-2 py-1 rounded-full hover:bg-gray-600 transition-colors">
                Longitude: {location.longitude.toFixed(2)}
              </span>
            </div>
          )}
          <h3 className="text-lg font-semibold mb-3">Forecast</h3>
          <div className="grid grid-cols-4 gap-3">
            {weather.dataseries.slice(0, 4).map((data, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-center transition-all duration-200 hover:scale-105 hover:shadow-glow-blue ${
                  darkMode ? 'bg-gray-700' : 'bg-indigo-50'
                }`}
              >
                <p className="font-medium">+{data.timepoint}h</p>
                <div className="my-2">{getWeatherIcon(data.weather)}</div>
                <p className="text-lg font-bold">{data.temp2m}°</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Temperature Distribution</h3>
            <div className="w-full h-80">{renderTemperatureTrend(weather.dataseries)}</div>
          </div>
        </>
      );
    } else if (weatherLoading) {
      return (
        <div className="text-center py-12">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-xl">Fetching weather data...</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="text-center">
          <div
            className={`p-6 rounded-lg shadow-md ${
              darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
            }`}
            style={{ minHeight: '300px' }}
          >
            <h3 className="text-xl font-semibold mb-4">Location Permission Required</h3>
            <p className="mb-4">
              <strong>Why Location Permission?</strong> We need your location to display weather forecast from
              satellite data, providing accurate and localized space weather information.
            </p>
            <p className="mb-4">
              If you accept, we will display your current temperature, humidity, wind speed, a 4-hour forecast,
              and a temperature distribution trend based on your location.
            </p>
            {weatherError && (
              <p className="font-bold text-yellow-300 dark:text-yellow-500 mb-4 p-2 rounded bg-yellow-100/20 dark:bg-yellow-900/20">{weatherError}</p>
            )}
            <div className="flex justify-center gap-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                onClick={requestLocationPermission}
              >
                Accept
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                onClick={denyLocationPermission}
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ease-in-out ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 text-white'
          : 'bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 text-gray-800'
      }`}
    >
      <div
        ref={threeContainerRef}
        className={`fixed top-0 left-0 w-full h-full z-0 pointer-events-none ${!darkMode && 'opacity-20'}`}
      />

      <div className="relative z-1 container mx-auto px-6 py-12">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 drop-shadow-lg">
            Space Explorer
          </h1>
          <button
            onClick={toggleTheme}
            className={`p-3 rounded-full transition-all duration-300 ${
              darkMode
                ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600 hover:shadow-glow-yellow'
                : 'bg-white text-indigo-600 shadow-md hover:bg-gray-100 hover:shadow-glow-indigo'
            }`}
          >
            {darkMode ? <SunIcon size={28} /> : <MoonIcon size={28} />}
          </button>
        </header>

        <SearchBar onSearch={handleSearch} darkMode={darkMode} />

        {searchedArticles.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center mb-6">
              <div className="w-2 h-10 bg-amber-500 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold">Search Results</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {searchedArticles.map((article, index) => (
                <div
                  key={index}
                  className={`rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-glow-amber hover:-translate-y-2 ${
                    darkMode ? 'bg-gray-800/70 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
                  }`}
                >
                  {article.imageUrl && !brokenImages.has(article.imageUrl) ? (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-52 object-cover"
                      onError={() => handleImageError(article.imageUrl)}
                    />
                  ) : (
                    <div className="w-full h-52 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      No Image Available
                    </div>
                  )}
                  <div className="p-5">
                    <p className={`text-sm ${darkMode ? 'text-blue-400' : 'text-blue-600'} mb-2`}>{article.date}</p>
                    <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4 text-sm line-clamp-3`}>
                      {article.summary}
                    </p>
                    <button
                      className={`text-sm font-medium transition-colors ${
                        darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-indigo-600 hover:text-indigo-700'
                      }`}
                    >
                      <a href={article.link}>Read Full Article →</a>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* APOD Section */}
          <div
            className={`rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-glow-blue ${
              darkMode ? 'bg-gray-800/70 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="w-2 h-10 bg-blue-500 rounded-full mr-4"></div>
                <h2 className="text-2xl font-bold">Astronomy Picture of the Day</h2>
              </div>
              {apodLoading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4 mx-auto"></div>
                  <p>Loading Astronomy Picture of the Day...</p>
                </div>
              ) : apodError ? (
                <div className="text-center py-8">
                  <p className="text-red-500 font-semibold">{apodError}</p>
                  <button
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              ) : apod ? (
                <>
                  {apod.media_type === 'video' ? (
                    <iframe
                      src={apod.url}
                      title={apod.title}
                      className="w-full h-72 rounded-lg"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <img src={apod.url} alt={apod.title} className="w-full h-72 object-cover rounded-lg" />
                  )}
                  <div className="mt-4">
                    <h3 className="text-xl font-semibold">{apod.title}</h3>
                    <p className="text-sm text-gray-500">{apod.date}</p>
                    <p className="mt-2">{apod.explanation}</p>
                  </div>
                </>
              ) : (
                <p className="text-red-500">No APOD data available.</p>
              )}
            </div>
          </div>

          {/* Weather Section */}
          <div
            className={`rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-glow-green ${
              darkMode ? 'bg-gray-800/70 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="w-2 h-10 bg-green-500 rounded-full mr-4"></div>
                <h2 className="text-2xl font-bold">Local Space Weather</h2>
              </div>
              {renderWeatherContent()}
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center mb-6">
            <div className="w-2 h-10 bg-purple-500 rounded-full mr-4"></div>
            <h2 className="text-3xl font-bold">Featured Space Articles</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles.map((article, index) => (
              <div
                key={index}
                className={`rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-glow-purple hover:-translate-y-2 ${
                  darkMode ? 'bg-gray-800/70 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
                }`}
              >
                {article.imageUrl && !brokenImages.has(article.imageUrl) ? (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-52 object-cover"
                    onError={() => handleImageError(article.imageUrl)}
                  />
                ) : (
                  <div className="w-full h-52 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    No Image Available
                  </div>
                )}
                <div className="p-5">
                  <p className={`text-sm ${darkMode ? 'text-blue-400' : 'text-blue-600'} mb-2`}>{article.date}</p>
                  <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4 text-sm line-clamp-3`}>
                    {article.summary}
                  </p>
                  <button
                    className={`text-sm font-medium transition-colors ${
                      darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    <a href={article.link}>Read Full Article →</a>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center mb-6">
            <div className="w-2 h-10 bg-yellow-500 rounded-full mr-4"></div>
            <h2 className="text-3xl font-bold">Upcoming SpaceX Launches</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingLaunches.map((launch, index) => (
              <div
                key={index}
                className={`rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-glow-yellow hover:-translate-y-2 ${
                  darkMode ? 'bg-gray-800/70 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
                }`}
              >
                {launch.links.patch.small && !brokenImages.has(launch.links.patch.small) ? (
                  <img
                    src={launch.links.patch.small}
                    alt={launch.name}
                    className="w-full h-52 object-cover"
                    onError={() => handleImageError(launch.links.patch.small)}
                  />
                ) : (
                  <div className="w-full h-52 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    No Image Available
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-2">{launch.name}</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                    Launch: {new Date(launch.date_utc).toLocaleDateString()}
                  </p>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4 text-sm line-clamp-3`}>
                    {launch.details ? launch.details.substring(0, 100) + '...' : 'No details available'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          ref={solarSystemContainerRef}
          className={`rounded-2xl shadow-xl p-4 backdrop-blur-md transition-all duration-300 hover:shadow-glow-red ${
            darkMode ? 'bg-gray-800/70' : 'bg-white/80'
          }`}
          style={{ height: '600px', width: '100%' }}
        >
          <SpaceJourney darkMode={darkMode} containerRef={solarSystemContainerRef} />
        </div>
      </div>
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 rounded-full p-4 shadow-lg z-20 animate-bounce transition-all duration-300 ${
          darkMode
            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-glow-blue'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-glow-indigo'
        }`}
      >
        {chatOpen ? <XIcon size={24} /> : <BotIcon size={24} />}
      </button>

      {chatOpen && (
        <div
          className={`fixed bottom-20 right-6 w-80 md:w-96 rounded-xl z-20 overflow-hidden transition-all duration-300 ease-in-out ${
            darkMode ? 'bg-sky-600/70' : 'bg-gray-500/90'
          }`}
          style={{ boxShadow: '0 0 20px rgba(135,206,235,0.8)' }}
        >
          <div className={`${darkMode ? 'bg-blue-600' : 'bg-indigo-600'} text-white p-3 font-bold`}>AI Assistant</div>
          <div ref={chatContainerRef} className="h-96 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'} py-8`}>
                <p>Ask me anything about space!</p>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`${
                    msg.role === 'user'
                      ? `ml-10 ${darkMode ? 'bg-blue-600' : 'bg-indigo-600'} text-white`
                      : `mr-10 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`
                  } p-3 rounded-lg`}
                >
                  {msg.content}
                </div>
              ))
            )}
            {chatLoading && (
              <div
                className={`mr-10 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${
                  darkMode ? 'text-white' : 'text-gray-800'
                } p-3 rounded-lg flex`}
              >
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t flex">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about space..."
              className={`flex-1 p-2 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            />
            <button
              onClick={sendMessage}
              disabled={chatLoading}
              className={`p-2 rounded-r-lg text-white transition-colors ${
                darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <SendIcon size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}