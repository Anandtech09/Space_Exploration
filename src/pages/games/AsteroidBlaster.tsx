import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SunIcon, MoonIcon } from 'lucide-react';
import * as THREE from 'three';

function Stars() {
  const starsRef = useRef<THREE.Points>(null);
  
  // Create random star positions
  const [starsGeometry] = useState(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  });

  useFrame(() => {
    if (starsRef.current) {
      // Move stars towards the camera, reset when they pass
      starsRef.current.position.z += 0.1;
      if (starsRef.current.position.z > 50) {
        starsRef.current.position.z = -50;
      }
    }
  });

  return (
    <points ref={starsRef} position={[0, 0, -50]}>
      <bufferGeometry attach="geometry" {...starsGeometry} />
      <pointsMaterial 
        size={0.1} 
        color="white" 
        sizeAttenuation={true} 
        transparent={true} 
        opacity={0.8}
      />
    </points>
  );
}

function Asteroid({ position, onHit, onMiss }: { 
  position: [number, number, number], 
  onHit: () => void,
  onMiss: () => void 
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.x += 0.01;
      mesh.current.rotation.y += 0.01;
      mesh.current.position.z += 0.05;
      
      if (mesh.current.position.z > 10) {
        onMiss();
      }
    }
  });

  return (
    <mesh ref={mesh} position={position} onClick={onHit}>
      <dodecahedronGeometry args={[1]} />
      <meshStandardMaterial 
        color="#ff6b6b" // Bright color visible in dark mode
        roughness={0.8}
        emissive="#ff6b6b" // Add some glow
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

export function AsteroidBlaster() {
  const [score, setScore] = useState(0);
  const [asteroids, setAsteroids] = useState<Array<{ id: number; position: [number, number, number] }>>([]);
  const [gameOver, setGameOver] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!gameOver) {
        const newAsteroids = Array.from({ length: 3 }, () => ({
          id: Date.now() + Math.random(),
          position: [
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            -20
          ] as [number, number, number]
        }));
        setAsteroids(prev => [...prev, ...newAsteroids]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [gameOver]);

  const handleHit = (id: number) => {
    if (!gameOver) {
      setAsteroids(prev => prev.filter(a => a.id !== id));
      setScore(prev => prev + 1);
    }
  };

  const handleMiss = () => {
    if (!gameOver) {
      setGameOver(true);
    }
  };

  const restartGame = () => {
    setScore(0);
    setAsteroids([]);
    setGameOver(false);
  };

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <div className={`relative ${darkMode ? 'bg-black' : 'bg-gray-100'}`} style={{ height: 'calc(100vh - 4rem)' }}>
      <header className="flex justify-between items-center p-4 z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Asteroid Blaster
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

      <div className={`absolute top-16 left-4 z-10 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'} p-4 rounded-lg`}>
        <h2 className="text-2xl font-bold">Score: {score}</h2>
      </div>

      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20">
          <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'} p-8 rounded-lg text-center`}>
            <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
            <p className="text-xl mb-4">Final Score: {score}</p>
            <button
              onClick={restartGame}
              className={`${
                darkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } px-6 py-2 rounded-lg text-white transition-colors`}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 10] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls enableZoom={false} />
        <Stars />
        
        {asteroids.map(asteroid => (
          <Asteroid
            key={asteroid.id}
            position={asteroid.position}
            onHit={() => handleHit(asteroid.id)}
            onMiss={handleMiss}
          />
        ))}
      </Canvas>
    </div>
  );
}