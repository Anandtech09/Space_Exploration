import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Rocket, Home, Users, Map, Book, Brain, Gamepad2, Menu, X, Star } from 'lucide-react';

export const Navbar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGamesDropdownOpen, setIsGamesDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsGamesDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when route changes
  useEffect(() => {
    setIsGamesDropdownOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/astronauts', icon: Users, label: 'Astronauts' },
    { path: '/missions', icon: Rocket, label: 'Missions' },
    { path: '/space-map', icon: Map, label: 'Space Map' },
    { path: '/nasa-data', icon: Book, label: 'NASA Data' },
    { path: '/space-quiz', icon: Brain, label: 'Space Quiz' },
  ];

  const gameItems = [
    { path: '/games/asteroid-blaster', label: 'Asteroid Blaster' },
    { path: '/games/space-jump', label: 'Pixel Rocket' },
    { path: '/games/space-race', label: 'Space Race' },
    { path: '/games/space-memory', label: 'Space Memory' },
  ];

  // Debug: Log when games dropdown is toggled
  const toggleGamesDropdown = () => {
    setIsGamesDropdownOpen((prev) => {
      console.log('Toggling games dropdown. New state:', !prev);
      console.log('Game items to render:', gameItems);
      return !prev;
    });
  };

  return (
    <nav className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 text-white shadow-lg z-60 w-full">
      <div className="w-full px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <Rocket className="w-8 h-8 text-blue-300 group-hover:text-yellow-300 transition-colors duration-300" />
              <div className="absolute -bottom-1 -right-1">
                <Star className="w-3 h-3 text-yellow-300 animate-pulse" fill="currentColor" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-300">
                Space Explorer
              </span>
              <div className="flex space-x-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-1 bg-blue-300 rounded-full"
                    style={{ animationDelay: `${i * 200}ms`, animationDuration: '1.5s' }}
                  />
                ))}
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-right space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-indigo-800 text-white shadow-inner shadow-indigo-600'
                      : 'text-blue-200 hover:bg-indigo-800 hover:text-white'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-yellow-300' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Games Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsGamesDropdownOpen(!isGamesDropdownOpen)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${location.pathname.includes('/games')
                    ? 'bg-indigo-800 text-white shadow-inner shadow-indigo-600'
                    : 'text-blue-200 hover:bg-indigo-800 hover:text-white'
                  }`}
              >
                <Gamepad2 className={`w-4 h-4 ${location.pathname.includes('/games') ? 'text-yellow-300' : ''}`} />
                <span>Games</span>
              </button>

              {isGamesDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-indigo-950 rounded-md shadow-lg py-1 z-40 border border-indigo-800">
                  {gameItems.map((game) => (
                    <Link
                      key={game.path}
                      to={game.path}
                      className={`block px-4 py-2 text-sm hover:bg-indigo-800 transition-colors duration-200 ${
                        location.pathname === game.path ? 'bg-indigo-800 text-yellow-300' : 'text-blue-200'
                      }`}
                    >
                      {game.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-blue-300 hover:text-white hover:bg-indigo-800 focus:outline-none transition-colors duration-200"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen ? 'max-h-[600px]' : 'max-h-0'
          }`}
        >
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-indigo-800 text-white shadow-inner shadow-indigo-600'
                      : 'text-blue-200 hover:bg-indigo-800 hover:text-white'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-300' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Mobile Games Menu */}
            <div>
              <button
                onClick={toggleGamesDropdown}
                className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium transition-all duration-200
                  ${location.pathname.includes('/games')
                    ? 'bg-indigo-800 text-white shadow-inner shadow-indigo-600'
                    : 'text-blue-200 hover:bg-indigo-800 hover:text-white'
                  }`}
              >
                <Gamepad2 className={`w-5 h-5 ${location.pathname.includes('/games') ? 'text-yellow-300' : ''}`} />
                <span>Games</span>
                <span className="ml-auto">{isGamesDropdownOpen ? '−' : '+'}</span>
              </button>

              <div
                className={`pl-6 space-y-1 transition-all duration-300 ${isGamesDropdownOpen ? 'block mt-1' : 'hidden'}`}
              >
                {gameItems.map((game) => (
                  <Link
                    key={game.path}
                    to={game.path}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent click from bubbling to the toggle button
                      setIsGamesDropdownOpen(false); // Close the dropdown
                      setIsMobileMenuOpen(false); // Close the mobile menu
                    }}
                    className={`block px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                      location.pathname === game.path
                        ? 'bg-indigo-800 text-yellow-300'
                        : 'text-blue-200 hover:bg-indigo-800 hover:text-white'
                    }`}
                  >
                    {game.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};