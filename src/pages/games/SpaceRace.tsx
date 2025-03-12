import { useEffect, useRef, useState } from 'react';
import { SunIcon, MoonIcon, TrophyIcon, ClockIcon } from 'lucide-react';

// Interfaces for game objects (unchanged)
interface Racer {
  x: number;
  y: number;
  size: number;
  speed: number;
  isAI: boolean;
  eliminated: boolean;
  sprite: string;
  name: string;
  color: string;
}

interface Block {
  x: number;
  y: number;
  size: number;
  type: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

interface Planet {
  x: number;
  y: number;
  size: number;
  sprite: string;
}

export function SpaceRace() {
  const [score, setScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [gameTime, setGameTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [countdown, setCountdown] = useState<number | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRacerRef = useRef<Racer | null>(null);
  const aiRacersRef = useRef<Racer[]>([]);
  const blocksRef = useRef<Block[]>([]);
  const starsRef = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const keys = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean; boost: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
  });
  const gameTimerRef = useRef<number | null>(null);

  // Game constants (unchanged)
  const GAME_WIDTH: number = window.innerWidth;
  const GAME_HEIGHT: number = window.innerHeight - 120;
  const RACE_DISTANCE: number = GAME_HEIGHT * 5;
  const RACER_SIZE: number = 70;
  const BLOCK_SIZE: number = 60;
  const NUM_AI: number = 5;
  const FINISH_LINE_Y: number = 100;
  const NUM_BLOCKS: number = getDifficultyValue(30, 20, 15);
  const NUM_STARS: number = 200;
  const NUM_PLANETS: number = 6;
  const BOOST_MULTIPLIER: number = 1.8;
  const BOOST_DURATION: number = 2000;
  const BOOST_COOLDOWN: number = 5000;

  // Difficulty settings (unchanged)
  function getDifficultyValue(hard: number, medium: number, easy: number): number {
    switch(difficulty) {
      case "hard": return hard;
      case "medium": return medium;
      case "easy": return easy;
      default: return medium;
    }
  }

  // Initialize game
  useEffect(() => {
    if (!isPlaying || countdown !== null) return; // Only start when countdown is done

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    playerRacerRef.current = {
      x: GAME_WIDTH / 2,
      y: RACE_DISTANCE - RACER_SIZE - 20,
      size: RACER_SIZE,
      speed: 5,
      isAI: false,
      eliminated: false,
      sprite: '🚀',
      name: "Player",
      color: "#3498db"
    };

    const aiTypes = [
      { sprite: '🛸', name: "Orbiter", color: "#e74c3c" },
      { sprite: '👾', name: "Invader", color: "#9b59b6" },
      { sprite: '🛰️', name: "Satellite", color: "#f1c40f" },
      { sprite: '🍢', name: "Guardians", color: "#2ecc71" },
      { sprite: '🔩', name: "Star Cruiser", color: "#e67e22" }
    ];

    aiRacersRef.current = aiTypes.map((type, i) => ({
      x: GAME_WIDTH * (i + 1) / (NUM_AI + 1),
      y: RACE_DISTANCE - RACER_SIZE - 20,
      size: RACER_SIZE,
      speed: 3 + (Math.random() * 1.5 * getDifficultyValue(1.2, 1, 0.8)),
      isAI: true,
      eliminated: false,
      sprite: type.sprite,
      name: type.name,
      color: type.color
    }));

    const blockTypes = ['🌑', '☄️', '💥', '🪨'];
    blocksRef.current = [];
    for (let i = 0; i < NUM_BLOCKS; i++) {
      blocksRef.current.push({
        x: Math.random() * (GAME_WIDTH - BLOCK_SIZE),
        y: Math.random() * (RACE_DISTANCE - FINISH_LINE_Y - 300) + FINISH_LINE_Y + 100,
        size: BLOCK_SIZE + Math.random() * 20,
        type: blockTypes[Math.floor(Math.random() * blockTypes.length)]
      });
    }

    starsRef.current = Array.from({ length: NUM_STARS }, (): Star => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * RACE_DISTANCE,
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.8 + 0.2
    }));

    const planetTypes = ['🪐', '🌎', '🌕', '🔴'];
    planetsRef.current = Array.from({ length: NUM_PLANETS }, (_, i): Planet => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * RACE_DISTANCE,
      size: 80 + Math.random() * 120,
      sprite: planetTypes[i % planetTypes.length]
    }));

    let startTime = Date.now();
    gameTimerRef.current = window.setInterval(() => {
      setGameTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let animationFrameId: number;
    let cameraY = RACE_DISTANCE - GAME_HEIGHT;
    let lastTime = 0;
    let boostActive = false;
    let boostStartTime = 0;
    let boostCooldown = false;

    const gameLoop = (timestamp: number) => {
      if (!gameOver) {
        const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
        lastTime = timestamp;

        if (keys.current.boost && !boostActive && !boostCooldown && playerRacerRef.current) {
          boostActive = true;
          boostStartTime = timestamp;
          playerRacerRef.current.speed *= BOOST_MULTIPLIER;
        }

        if (boostActive && timestamp - boostStartTime > BOOST_DURATION && playerRacerRef.current) {
          boostActive = false;
          boostCooldown = true;
          playerRacerRef.current.speed /= BOOST_MULTIPLIER;
          setTimeout(() => { boostCooldown = false; }, BOOST_COOLDOWN);
        }

        updateGame(ctx, cameraY, deltaTime);
        cameraY = updateCamera(cameraY);
        renderGame(ctx, cameraY, boostActive, boostCooldown);
      } else {
        ctx.fillStyle = darkMode ? '#0c1445' : '#4682B4';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      }
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [isPlaying, gameOver, darkMode, difficulty, countdown]);

  // Countdown Logic (fixed)
  useEffect(() => {
    if (countdown === null) return;

    const timer = setInterval(() => {
      setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    if (countdown === 0) {
      setTimeout(() => {
        setIsPlaying(true); // Start game after "GO!"
        setCountdown(null); // Clear countdown explicitly
      }, 500); // Brief delay to show "GO!"
    }

    return () => clearInterval(timer);
  }, [countdown]);

  // Keyboard controls (unchanged)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = true;
      if (e.key === 'ArrowRight') keys.current.right = true;
      if (e.key === 'ArrowUp') keys.current.up = true;
      if (e.key === 'ArrowDown') keys.current.down = true;
      if (e.key === 'Shift') keys.current.boost = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' && !isPlaying && !gameOver && countdown === null) {
        setCountdown(3);
      }

      if (e.key === 'r' && gameOver) {
        restartGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = false;
      if (e.key === 'ArrowRight') keys.current.right = false;
      if (e.key === 'ArrowUp') keys.current.up = false;
      if (e.key === 'ArrowDown') keys.current.down = false;
      if (e.key === 'Shift') keys.current.boost = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, gameOver, countdown]);

  // Update game state (unchanged)
  const updateGame = (ctx: CanvasRenderingContext2D, cameraY: number, deltaTime: number) => {
    updatePlayer(deltaTime);
    updateAI(deltaTime);
    checkCollisions();
    checkWinCondition();
  };

  const updatePlayer = (deltaTime: number) => {
    const player = playerRacerRef.current;
    if (!player || player.eliminated) return;

    if (keys.current.left) player.x -= player.speed * (deltaTime * 60 || 1);
    if (keys.current.right) player.x += player.speed * (deltaTime * 60 || 1);
    if (keys.current.up) player.y -= player.speed * (deltaTime * 60 || 1);
    if (keys.current.down) player.y += player.speed * (deltaTime * 60 || 1) * 0.7;

    player.x = Math.max(0, Math.min(GAME_WIDTH - player.size, player.x));
    player.y = Math.max(0, Math.min(RACE_DISTANCE - player.size, player.y));
  };

  const updateAI = (deltaTime: number) => {
    aiRacersRef.current.forEach((ai) => {
      if (ai.eliminated) return;
      ai.y -= ai.speed * (deltaTime * 60 || 1);

      let lateralSpeed = 0;
      let closestBlockDist = Number.MAX_VALUE;
      let closestBlock = null;

      blocksRef.current.forEach((block) => {
        const dx = block.x + block.size/2 - (ai.x + ai.size/2);
        const dy = block.y - ai.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dy < 0 && dy > -200 && Math.abs(dx) < 100 && dist < closestBlockDist) {
          closestBlockDist = dist;
          closestBlock = block;
        }
      });

      if (closestBlock) {
        const dx = closestBlock.x + closestBlock.size/2 - (ai.x + ai.size/2);
        lateralSpeed = dx > 0 ? -ai.speed : ai.speed;
        lateralSpeed += (Math.random() - 0.5) * 2;
      }

      if (Math.random() < 0.02) {
        lateralSpeed += (Math.random() - 0.5) * 3;
      }

      ai.x += lateralSpeed * (deltaTime * 60 || 1);
      ai.x = Math.max(0, Math.min(GAME_WIDTH - ai.size, ai.x));
    });
  };

  const updateCamera = (cameraY: number): number => {
    const player = playerRacerRef.current;
    if (!player || player.eliminated) {
      const leadingRacer = [...aiRacersRef.current]
        .filter(r => !r.eliminated)
        .sort((a, b) => a.y - b.y)[0];
      if (leadingRacer) {
        const targetCameraY = leadingRacer.y - GAME_HEIGHT / 2;
        return Math.max(0, Math.min(RACE_DISTANCE - GAME_HEIGHT, targetCameraY));
      }
      return cameraY;
    }

    const targetCameraY = player.y - GAME_HEIGHT / 2;
    return Math.max(0, Math.min(RACE_DISTANCE - GAME_HEIGHT, targetCameraY));
  };

  const checkCollisions = () => {
    const player = playerRacerRef.current;
    if (player && !player.eliminated) {
      blocksRef.current.forEach((block) => {
        if (isColliding(player, block)) player.eliminated = true;
      });
    }

    aiRacersRef.current.forEach((ai) => {
      if (!ai.eliminated) {
        blocksRef.current.forEach((block) => {
          if (isColliding(ai, block)) ai.eliminated = true;
        });
      }
    });
  };

  const isColliding = (racer: Racer, block: Block): boolean => {
    const racerCollisionSize = racer.size * 0.7;
    const blockCollisionSize = block.size * 0.7;
    const racerCenterX = racer.x + racer.size/2;
    const racerCenterY = racer.y + racer.size/2;
    const blockCenterX = block.x + block.size/2;
    const blockCenterY = block.y + block.size/2;
    return (
      Math.abs(racerCenterX - blockCenterX) < (racerCollisionSize + blockCollisionSize)/2 &&
      Math.abs(racerCenterY - blockCenterY) < (racerCollisionSize + blockCollisionSize)/2
    );
  };

  const checkWinCondition = () => {
    const player = playerRacerRef.current;
    let racers = [];
    if (player && !player.eliminated) {
      racers.push({...player, id: 'player'});
    }

    aiRacersRef.current.forEach((ai, idx) => {
      if (!ai.eliminated) {
        racers.push({...ai, id: `ai-${idx}`});
      }
    });

    racers.sort((a, b) => a.y - b.y);

    if (racers.length > 0 && racers[0].y <= FINISH_LINE_Y) {
      if (racers[0].id === 'player') {
        setWinner("You");
        setScore(6);
      } else {
        const aiIndex = parseInt(racers[0].id.split('-')[1]);
        setWinner(aiRacersRef.current[aiIndex].name);
        const playerPosition = racers.findIndex(r => r.id === 'player');
        setScore(playerPosition !== -1 ? Math.max(1, 6 - playerPosition) : 0);
      }
      setGameOver(true);
      setIsPlaying(false);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      return;
    }

    if (racers.length === 0) {
      setWinner("No one");
      setScore(0);
      setGameOver(true);
      setIsPlaying(false);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    }
  };

  // Render game (unchanged)
  const renderGame = (ctx: CanvasRenderingContext2D, cameraY: number, boostActive: boolean, boostCooldown: boolean) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    if (darkMode) {
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#0c1445');
    } else {
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#4682B4');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.globalAlpha = 1;
    starsRef.current.forEach((star, i) => {
      const y = star.y - cameraY;
      if (y >= 0 && y <= GAME_HEIGHT) {
        const twinkle = Math.sin(Date.now() * 0.003 + i * 0.1) * 0.3 + 0.7;
        ctx.globalAlpha = star.opacity * twinkle;
        ctx.fillStyle = darkMode ? 'white' : '#404040';
        ctx.beginPath();
        ctx.arc(star.x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    planetsRef.current.forEach((planet) => {
      const y = planet.y - cameraY;
      if (y >= -planet.size && y <= GAME_HEIGHT) {
        ctx.globalAlpha = 0.7;
        ctx.font = `${planet.size}px Arial`;
        ctx.fillText(planet.sprite, planet.x, y + planet.size);
      }
    });
    ctx.globalAlpha = 1;

    const finishY = FINISH_LINE_Y - cameraY;
    if (finishY >= -20 && finishY <= GAME_HEIGHT) {
      const squareSize = 20;
      const numSquares = Math.ceil(GAME_WIDTH / squareSize);
      for (let i = 0; i < numSquares; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'white' : 'black';
        ctx.fillRect(i * squareSize, finishY, squareSize, squareSize);
        ctx.fillStyle = i % 2 === 0 ? 'black' : 'white';
        ctx.fillRect(i * squareSize, finishY + squareSize, squareSize, squareSize);
      }
      ctx.fillStyle = darkMode ? '#f1c40f' : '#e74c3c';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('FINISH LINE', GAME_WIDTH / 2 - 70, finishY - 10);
    }

    blocksRef.current.forEach((block) => {
      const y = block.y - cameraY;
      if (y >= -block.size && y <= GAME_HEIGHT) {
        if (darkMode) {
          ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
          ctx.shadowBlur = 15;
        }
        ctx.font = `${block.size}px Arial`;
        ctx.fillText(block.type, block.x, y + block.size);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    });

    aiRacersRef.current.forEach((ai) => {
      const y = ai.y - cameraY;
      if (y >= -ai.size && y <= GAME_HEIGHT) {
        if (!ai.eliminated && darkMode) {
          ctx.shadowColor = ai.color;
          ctx.shadowBlur = 15;
        }
        ctx.font = `${ai.size}px Arial`;
        ctx.fillText(ai.sprite, ai.x, y + ai.size);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.font = '14px Arial';
        ctx.fillStyle = ai.eliminated ? 'gray' : ai.color;
        ctx.fillText(ai.name, ai.x + ai.size/2 - ctx.measureText(ai.name).width/2, y + ai.size + 20);
      }
    });

    const player = playerRacerRef.current;
    if (player) {
      const y = player.y - cameraY;
      if (y >= -player.size && y <= GAME_HEIGHT) {
        if (!player.eliminated) {
          if (boostActive) {
            ctx.shadowColor = '#f39c12';
            ctx.shadowBlur = 25;
            ctx.font = `${player.size * 0.7}px Arial`;
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('🔥', player.x, y + player.size + 20);
          } else if (darkMode) {
            ctx.shadowColor = player.color;
            ctx.shadowBlur = 15;
          }
        }
        ctx.font = `${player.size}px Arial`;
        ctx.fillStyle = player.eliminated ? 'gray' : darkMode ? 'white' : 'black';
        ctx.fillText(player.sprite, player.x, y + player.size);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = player.eliminated ? 'gray' : player.color;
        ctx.fillText("YOU", player.x + player.size/2 - ctx.measureText("YOU").width/2, y + player.size + 20);
      }
    }

    if (player && !player.eliminated) {
      const boostBarWidth = 100;
      const boostBarHeight = 10;
      const boostX = GAME_WIDTH - 130;
      const boostY = GAME_HEIGHT - 30;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(boostX, boostY, boostBarWidth, boostBarHeight);
      if (boostActive) {
        const flash = Math.sin(Date.now() * 0.01) > 0;
        ctx.fillStyle = flash ? '#f39c12' : '#e74c3c';
        ctx.fillRect(boostX, boostY, boostBarWidth, boostBarHeight);
      } else if (boostCooldown) {
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(boostX, boostY, boostBarWidth, boostBarHeight);
      } else {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(boostX, boostY, boostBarWidth, boostBarHeight);
      }
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText('BOOST (SHIFT)', boostX + 5, boostY - 5);
    }
  };

  const restartGame = () => {
    setIsPlaying(false);
    setGameOver(false);
    setWinner(null);
    setScore(0);
    setGameTime(0);
    setCountdown(null);
  };

  const changeDifficulty = (newDifficulty: string) => {
    setDifficulty(newDifficulty);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-blue-50'} flex flex-col items-center m-0 p-0 overflow-hidden relative`}>
      {!isPlaying && !gameOver && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s`,
                opacity: Math.random() * 0.7 + 0.3
              }}
            />
          ))}
        </div>
      )}

      <header className="flex justify-between items-center p-4 w-full max-w-[1920px] z-1">
        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
          COSMIC RACER
        </h1>
        <div className="flex items-center gap-4">
          {isPlaying && !gameOver && (
            <div className={`flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              <ClockIcon size={18} />
              <span>{gameTime}s</span>
            </div>
          )}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-3 rounded-full ${darkMode ? 'bg-gray-800 text-yellow-300 hover:bg-gray-700' : 'bg-white text-indigo-600 hover:bg-gray-100'} transition-colors`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </button>
        </div>
      </header>

      {countdown !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="text-white text-8xl font-bold animate-pulse">
            {countdown > 0 ? `Game Begins in ${countdown}` : 'GO!'}
          </div>
        </div>
      )}

      {gameOver ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] w-full max-w-[1920px] px-4 z-20">
          <div className={`${darkMode ? 'bg-gray-800/80 text-white' : 'bg-white/90 text-gray-800'} p-6 rounded-xl shadow-2xl text-center max-w-md w-full backdrop-blur-sm`}>
            <h2 className="text-4xl font-black mb-4">RACE COMPLETE</h2>
            <div className="mb-6">
              <p className="text-xl mb-1">Winner: <span className="font-bold text-purple-500">{winner}</span></p>
              <p className="text-lg mb-1">Your Score: <span className="font-bold text-yellow-500">{score}</span></p>
              <p className="text-lg">Race Time: <span className="font-bold">{gameTime}s</span></p>
            </div>
            <div className="mb-6">
              {score === 6 ? (
                <p className="text-2xl font-bold text-green-500">🏆 VICTORY!</p>
              ) : score > 0 ? (
                <p className="text-xl text-blue-500">Good effort!</p>
              ) : (
                <p className="text-xl text-red-500">Better luck next time!</p>
              )}
            </div>
            <button
              onClick={restartGame}
              className={`px-6 py-3 text-lg font-bold rounded-full ${
                darkMode 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
              } text-white shadow-lg transform transition hover:scale-105`}
            >
              PRESS R TO PLAY AGAIN
            </button>
          </div>
        </div>
      ) : (
        <>
          {isPlaying && !countdown && (
            <canvas ref={canvasRef} className="mt-12 w-full max-w-[1920px]" />
          )}
          {!isPlaying && !countdown && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] w-full max-w-[1920px] px-4">
              <div className={`${darkMode ? 'bg-gray-800/80 text-white' : 'bg-white/90 text-gray-800'} p-6 rounded-xl shadow-2xl text-center max-w-md w-full backdrop-blur-sm`}>
                <h1 className="text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">COSMIC RACER</h1>
                <p className="text-lg mb-6">Race through the cosmos, avoid space debris, and beat your rivals!</p>

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-3">Difficulty:</h3>
                  <div className="flex justify-center gap-4">
                    {["easy", "medium", "hard"].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => changeDifficulty(diff)}
                        className={`px-4 py-2 rounded-md capitalize text-sm font-medium ${
                          difficulty === diff 
                            ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white') 
                            : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800')
                        } transition-colors`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8 text-left text-sm">
                  <h3 className="text-lg font-bold mb-2">Controls:</h3>
                  <ul className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                    <li className="mb-1">⬆️ ⬇️ ⬅️ ➡️ - Move spacecraft</li>
                    <li className="mb-1">Shift - Boost (limited)</li>
                    <li className="mb-1">Space - Start game</li>
                    <li>R - Restart after game over</li>
                  </ul>
                </div>

                <button
                  onClick={() => setCountdown(3)}
                  className={`px-6 py-3 text-lg font-bold rounded-full ${
                    darkMode 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                  } text-white shadow-lg transform transition hover:scale-105`}
                >
                  PRESS SPACE TO START
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}