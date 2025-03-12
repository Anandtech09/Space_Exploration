import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { MeshStandardMaterial } from 'three';

// Define solar system data with simplified colors
const solarSystemData = {
  sun: {
    name: "Sun",
    radius: 5,
    color: "#ffff00", // Yellow
  },
  planets: [
    { name: "Mercury", radius: 1, distance: 10, orbitalSpeed: 1.0, color: "#aaaaaa" }, // Gray
    { name: "Venus", radius: 1.5, distance: 15, orbitalSpeed: 2.0, color: "#ffcc00" }, // Orange-Yellow
    { name: "Earth", radius: 2, distance: 20, orbitalSpeed: 2.4, color: "#0077ff" }, // Blue
    { name: "Mars", radius: 1.8, distance: 25, orbitalSpeed: 1.7, color: "#ff5500" }, // Red
    { name: "Jupiter", radius: 3, distance: 35, orbitalSpeed: 0.8, color: "#ffaa66" }, // Light orange
    { name: "Saturn", radius: 2.5, distance: 45, orbitalSpeed: 2.6, color: "#eecc66" }, // Gold
    { name: "Uranus", radius: 2, distance: 55, orbitalSpeed: 1.4, color: "#66ffff" }, // Cyan
    { name: "Neptune", radius: 2, distance: 65, orbitalSpeed: 3.0, color: "#3333ff" }, // Deep blue
  ],
};

export function SolarSystem(): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000"); // Black background
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 30, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 500;

    // Create the Sun - simple bright yellow sphere
    const sunGeometry = new THREE.SphereGeometry(solarSystemData.sun.radius, 64, 64);
    const sunMaterial = new MeshStandardMaterial({ 
      color: solarSystemData.sun.color,
      emissive: "#ffff33",
      emissiveIntensity: 1
    });

    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.userData = {
      name: solarSystemData.sun.name,
      description: "The center of our solar system"
    };
    scene.add(sun);

    // Add glow effect around sun
    const sunGlowGeometry = new THREE.SphereGeometry(solarSystemData.sun.radius * 1.2, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: "#ffff33",
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    scene.add(sunGlow);

    // Add lighting from the Sun
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 200);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // Ambient light to ensure planets are visible
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Create Planets and Orbits
    const planetMeshes: THREE.Mesh[] = [];
    const orbitLines: THREE.Mesh[] = [];

    solarSystemData.planets.forEach((planet) => {
      // Use simple colored material with no textures
      const planetGeometry = new THREE.SphereGeometry(planet.radius, 32, 32);
      const planetMaterial = new THREE.MeshBasicMaterial({
        color: planet.color,
      });
      
      const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
      planetMesh.position.set(planet.distance, 0, 0);
      planetMesh.userData = {
        name: planet.name,
        description: `Distance from Sun: ${planet.distance} units`,
      };
      scene.add(planetMesh);
      planetMeshes.push(planetMesh);

      // Create orbit ring
      const orbitGeometry = new THREE.RingGeometry(planet.distance - 0.1, planet.distance + 0.1, 128);
      const orbitMaterial = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
      });
      const orbitLine = new THREE.Mesh(orbitGeometry, orbitMaterial);
      orbitLine.rotation.x = Math.PI / 2;
      scene.add(orbitLine);
      orbitLines.push(orbitLine);
    });

    // Add Saturn's rings
    const saturnIndex = 5; // Saturn is the 6th planet (index 5)
    const saturnRingGeometry = new THREE.RingGeometry(
      solarSystemData.planets[saturnIndex].radius * 1.5,
      solarSystemData.planets[saturnIndex].radius * 2.5,
      64
    );
    const saturnRingMaterial = new THREE.MeshBasicMaterial({
      color: "#d6c388",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const saturnRing = new THREE.Mesh(saturnRingGeometry, saturnRingMaterial);
    saturnRing.rotation.x = Math.PI / 3; // Tilt the rings
    planetMeshes[saturnIndex].add(saturnRing);

    // Add stars with little movement
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: "#ffffff", size: 0.2 });
    const starVertices = [];
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 300;
      const y = (Math.random() - 0.5) * 300;
      const z = (Math.random() - 0.5) * 300;
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Animation
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      // Rotate the sun
      sun.rotation.y += 0.001;
      
      // Rotate planets
      planetMeshes.forEach((planet, index) => {
        // Orbital motion
        const angle = time * solarSystemData.planets[index].orbitalSpeed;
        planet.position.x = solarSystemData.planets[index].distance * Math.cos(angle);
        planet.position.z = solarSystemData.planets[index].distance * Math.sin(angle);
        
        // Planet rotation around its axis
        planet.rotation.y += 0.01;
      });

      // Random movement for stars
      stars.position.x += (Math.random() - 0.5) * 0.01;
      stars.position.y += (Math.random() - 0.5) * 0.01;
      stars.position.z += (Math.random() - 0.5) * 0.01;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Container Resizing
    const onWindowResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onWindowResize);

    // Cleanup on Unmount
    return () => {
      window.removeEventListener("resize", onWindowResize);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      controls.dispose();
      if (container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Add custom CSS styles for the container
  const containerStyles = {
    position: "relative" as const,
    width: "100%",
    height: "77vh",
    overflow: "hidden",
    backgroundColor: "#000000", // Ensure background is black
  };

  return (
    <div style={containerStyles}>
      <div ref={mountRef} style={{ width: "100%", height: "77%" }} />
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "5px 10px",
          borderRadius: "5px",
          pointerEvents: "none",
          display: "none",
        }}
      />
    </div>
  );
};
