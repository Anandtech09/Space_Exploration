import React from 'react';
import { Planet } from '../types';

interface PlanetStatsProps {
  planet: Planet;
}

export const PlanetStats: React.FC<PlanetStatsProps> = ({ planet }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">{planet.name} Statistics</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Physical Characteristics</h3>
          <ul className="space-y-2">
            <li>Mass: {planet.mass}</li>
            <li>Diameter: {planet.diameter}</li>
            <li>Gravity: {planet.gravity}</li>
            <li>Escape Velocity: {planet.escapeVelocity}</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Orbital Characteristics</h3>
          <ul className="space-y-2">
            <li>Distance from Sun: {planet.distance}</li>
            <li>Orbital Period: {planet.orbitalPeriod}</li>
            <li>Surface Temperature: {planet.temperature}</li>
            <li>Number of Moons: {planet.moons}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};