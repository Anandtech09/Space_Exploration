import React from 'react';
import { Planet } from '../types';

interface PlanetCardProps {
  planet: Planet;
  onClick: (planet: Planet) => void;
  darkMode?: boolean; // Add darkMode prop
}

export const PlanetCard: React.FC<PlanetCardProps> = ({ planet, onClick, darkMode = true }) => {
  return (
    <div
      className={`rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-transform hover:scale-105 hover:border-[3px] hover:border-[#34eb6f] hover:rounded-lg${
        darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'
      }`}
      onClick={() => onClick(planet)}
    >
      <img src={planet.image} alt={planet.name} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h3 className="text-xl font-bold mb-2">{planet.name}</h3>
        <p className={`text-sm mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-600'}`}>
          {planet.type}
        </p>
        <div className="flex justify-between text-sm">
          <span>Distance: {planet.distance}</span>
          <span>Moons: {planet.moons}</span>
        </div>
      </div>
    </div>
  );
};