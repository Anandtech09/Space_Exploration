import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';

// Milestone data with treasure box content (12 planets as milestones)
const milestones = [
  { position: [-15, 5, -5], label: '1957: Sputnik Launch', color: '#39ff14', size: 1.2, treasure: { title: 'Sputnik Model', description: 'A replica of the first artificial satellite launched by the Soviet Union.' } },
  { position: [-10, -2, 0], label: '1961: First Human in Space', color: '#00ff89', size: 1.5, treasure: { title: 'Yuri Gagarin’s Helmet', description: 'The helmet worn during the Vostok 1 mission.' } },
  { position: [-5, 3, 5], label: '1962: Mercury Atlas 6', color: '#00fffb', size: 1.3, treasure: { title: 'John Glenn’s Capsule', description: 'The Friendship 7 capsule from the first U.S. orbital flight.' } },
  { position: [0, -1, -3], label: '1969: Moon Landing', color: '#ffff00', size: 2.0, treasure: { title: 'Apollo 11 Moon Rock', description: 'A lunar sample from the Apollo 11 mission.' } },
  { position: [5, 4, 2], label: '1971: Salyut 1', color: '#ffb400', size: 1.4, treasure: { title: 'Salyut 1 Blueprint', description: 'The design of the first space station.' } },
  { position: [10, -3, -4], label: '1981: Space Shuttle', color: '#ff9900', size: 1.6, treasure: { title: 'Columbia Tile', description: 'A heat shield tile from the first Space Shuttle mission.' } },
  { position: [15, 2, 3], label: '1990: Hubble Launch', color: '#ff69b4', size: 1.7, treasure: { title: 'Hubble Image', description: 'A famous image captured by the Hubble Space Telescope.' } },
  { position: [-12, -4, 2], label: '1998: ISS Assembly', color: '#40ff00', size: 1.8, treasure: { title: 'ISS Module Blueprint', description: 'A blueprint of the Zarya module.' } },
  { position: [3, 5, -1], label: '2004: SpaceX Falcon 1', color: '#00ff00', size: 1.3, treasure: { title: 'Falcon 1 Launch Photo', description: 'The first successful launch of a SpaceX rocket.' } },
  { position: [8, -2, 4], label: '2012: Mars Rover', color: '#ff0099', size: 1.5, treasure: { title: 'Curiosity’s First Photo', description: 'The first image from the Curiosity Rover.' } },
  { position: [-8, 3, -2], label: '2020: Crew Dragon', color: '#33ff00', size: 1.9, treasure: { title: 'Crew Dragon Patch', description: 'A patch from the first operational Crew Dragon mission.' } },
  { position: [12, -1, 1], label: '2025: Artemis II', color: '#ff00ff', size: 2.2, treasure: { title: 'Artemis II Mission Patch', description: 'A patch for the Artemis II Moon orbit mission.' } },
];

// Planet component
const Planet = ({ position, label, color, size, onClick, isActive, darkMode }: { position: [number, number, number]; label: string; color: string; size: number; onClick: () => void; isActive: boolean; darkMode: boolean }) => {
  return (
    <group position={position} onClick={onClick}>
      {/* Planet Sphere */}
      <mesh>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial color={isActive ? (darkMode ? '#ff4444' : '#ff6b6b') : color} />
      </mesh>
      {/* Orbit Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size + 0.2, size + 0.3, 32]} />
        <meshBasicMaterial color={darkMode ? '#666' : '#aaa'} transparent opacity={0.3} />
      </mesh>
      {/* Label */}
      <Text position={[0, size + 1, 0]} fontSize={0.3} color={darkMode ? 'white' : 'black'} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
};

// Galactic Map (replacing SpacePath)
const GalacticMap = ({ darkMode }: { darkMode: boolean }) => {
  const nodes = milestones.map(m => new THREE.Vector3(...m.position)); // Use milestone positions as nodes
  const lines = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    lines.push([nodes[i], nodes[i + 1]]);
  }

  return (
    <>
      {lines.map((line, index) => (
        <line key={index}>
          <bufferGeometry>
            <bufferAttribute
              attachObject={['attributes', 'position']}
              count={2}
              array={new Float32Array([line[0].x, line[0].y, line[0].z, line[1].x, line[1].y, line[1].z])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={darkMode ? '#00ffff' : '#00cccc'} linewidth={2} transparent opacity={0.8} />
        </line>
      ))}
      {/* Node Points (optional visual) */}
      {nodes.map((node, index) => (
        <mesh key={index} position={node}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color={darkMode ? '#00ffff' : '#00cccc'} />
        </mesh>
      ))}
    </>
  );
};

export function SpaceJourney({ darkMode = true }: { darkMode?: boolean }) {
  const [currentMilestone, setCurrentMilestone] = useState(0);
  const [treasure, setTreasure] = useState<{ title: string; description: string } | null>(null);

  // Update treasure when currentMilestone changes
  useEffect(() => {
    setTreasure(milestones[currentMilestone].treasure);
  }, [currentMilestone]);

  const handlePlanetClick = (index: number) => {
    setCurrentMilestone(index);
    console.log('Clicked planet:', index); // Debug log
  };

  const goToPrevious = () => {
    if (currentMilestone > 0) {
      setCurrentMilestone(currentMilestone - 1);
      console.log('Previous clicked, currentMilestone:', currentMilestone - 1); // Debug log
    }
  };

  const goToNext = () => {
    if (currentMilestone < milestones.length - 1) {
      setCurrentMilestone(currentMilestone + 1);
      console.log('Next clicked, currentMilestone:', currentMilestone + 1); // Debug log
    }
  };

  return (
    <div className={`${darkMode ? 'bg-gray-900' : 'bg-indigo-100'} rounded-lg p-6 shadow-lg overflow-hidden`}>
      <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Interstellar Space Roadmap</h2>
      <div className="relative w-full h-[370px]">
        <Canvas camera={{ position: [0, 10, 25], fov: 60 }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          {/* Starry Background */}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
          {/* Galactic Map */}
          <GalacticMap darkMode={darkMode} />
          {/* Planets */}
          {milestones.map((milestone, index) => (
            <Planet
              key={index}
              position={milestone.position}
              label={milestone.label}
              color={milestone.color}
              size={milestone.size}
              onClick={() => handlePlanetClick(index)}
              isActive={index === currentMilestone}
              darkMode={darkMode}
            />
          ))}
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
        {/* Navigation Buttons */}
        <div className="absolute bottom-4 left-4 flex space-x-4">
          <button
            onClick={goToPrevious}
            disabled={currentMilestone === 0}
            className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'} disabled:opacity-50`}
          >
            Previous
          </button>
          <button
            onClick={goToNext}
            disabled={currentMilestone === milestones.length - 1}
            className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'} disabled:opacity-50`}
          >
            Next
          </button>
        </div>
      </div>
      {/* Treasure Box */}
      {treasure && (
        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'}`}>
          <h3 className="text-lg font-bold">{treasure.title}</h3>
          <p>{treasure.description}</p>
        </div>
      )}
    </div>
  );
}