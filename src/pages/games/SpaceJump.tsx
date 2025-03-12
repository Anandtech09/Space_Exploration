import { useEffect, useRef, useState } from 'react';
import { SunIcon, MoonIcon } from 'lucide-react';

// Interfaces for game objects
interface GameObject {
  x: number;
  y: number;
  size: number;
  speed: number;
}

interface Enemy extends GameObject {
  health: number;
  lastShotTime: number;
}

interface Star {
  x: number;
  y: number;
}

export function SpaceJump() {
  const [score, setScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<GameObject>({ x: 0, y: 0, size: 60, speed: 5 });
  const enemiesRef = useRef<Enemy[]>([]);
  const asteroidsRef = useRef<GameObject[]>([]);
  const coinsRef = useRef<GameObject[]>([]);
  const bulletsRef = useRef<GameObject[]>([]);
  const enemyBulletsRef = useRef<GameObject[]>([]);
  const keys = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const lastPlayerShotTime = useRef<number>(0);
  const lastEnemySpawn = useRef<number>(0);
  const lastAsteroidSpawn = useRef<number>(0);
  const lastCoinSpawn = useRef<number>(0);

  // Game constants
  const GAME_WIDTH: number = window.innerWidth * 0.98;
  const GAME_HEIGHT: number = window.innerHeight * 0.78;
  const PLAYER_SIZE: number = 60;
  const ENEMY_SIZE: number = 40;
  const ASTEROID_SIZE: number = 50;
  const COIN_SIZE: number = 30;
  const BULLET_SIZE: number = 5;
  const SPAWN_INTERVAL_ENEMY: number = 1500;
  const SPAWN_INTERVAL_ASTEROID: number = 800;
  const SPAWN_INTERVAL_COIN: number = 2000;
  const ENEMY_HEALTH: number = 2;
  const ENEMY_SHOOT_INTERVAL: number = 2000;
  const PLAYER_SHOOT_INTERVAL: number = 200;

  // Initialize player position
  useEffect(() => {
    playerRef.current = {
      x: GAME_WIDTH / 2 - PLAYER_SIZE / 2,
      y: GAME_HEIGHT - PLAYER_SIZE - 10,
      size: PLAYER_SIZE,
      speed: 5,
    };
  }, []);

  // Static stars
  const stars = useRef<Star[]>(
    Array.from({ length: 50 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
    }))
  );

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    canvas.style.width = `${GAME_WIDTH}px`;
    canvas.style.height = `${GAME_HEIGHT}px`;

    let animationFrameId: number;

    const gameLoop = () => {
      if (!gameOver) {
        updateGame();
      }
      renderGame(ctx);
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    gameLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameOver]);

  // Prevent scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const updateGame = () => {
    updatePlayer();
    updateEnemies();
    updateAsteroids();
    updateCoins();
    updateBullets();
    updateEnemyBullets();
    checkCollisions();
    spawnObjects();
  };

  const updatePlayer = () => {
    const player = playerRef.current;
    if (keys.current.left) player.x -= player.speed;
    if (keys.current.right) player.x += player.speed;
    player.x = Math.max(0, Math.min(GAME_WIDTH - player.size, player.x));

    const now = Date.now();
    if (now - lastPlayerShotTime.current > PLAYER_SHOOT_INTERVAL) {
      bulletsRef.current = [
        ...bulletsRef.current,
        {
          x: player.x + player.size / 2 - BULLET_SIZE / 2,
          y: player.y,
          size: BULLET_SIZE,
          speed: -10,
        },
      ];
      lastPlayerShotTime.current = now;
    }
  };

  const updateEnemies = () => {
    const now = Date.now();
    enemiesRef.current = enemiesRef.current
      .map(enemy => {
        if (now - enemy.lastShotTime > ENEMY_SHOOT_INTERVAL) {
          enemyBulletsRef.current = [
            ...enemyBulletsRef.current,
            {
              x: enemy.x + enemy.size / 2 - BULLET_SIZE / 2,
              y: enemy.y + enemy.size,
              size: BULLET_SIZE,
              speed: 5,
            },
          ];
          return { ...enemy, y: enemy.y + enemy.speed, lastShotTime: now };
        }
        return { ...enemy, y: enemy.y + enemy.speed };
      })
      .filter(enemy => enemy.y < GAME_HEIGHT);
  };

  const updateAsteroids = () => {
    asteroidsRef.current = asteroidsRef.current
      .map(asteroid => ({ ...asteroid, y: asteroid.y + asteroid.speed }))
      .filter(asteroid => asteroid.y < GAME_HEIGHT);
  };

  const updateCoins = () => {
    coinsRef.current = coinsRef.current
      .map(coin => ({ ...coin, y: coin.y + coin.speed }))
      .filter(coin => coin.y < GAME_HEIGHT);
  };

  const updateBullets = () => {
    bulletsRef.current = bulletsRef.current
      .map(bullet => ({ ...bullet, y: bullet.y + bullet.speed }))
      .filter(bullet => bullet.y > 0);
  };

  const updateEnemyBullets = () => {
    enemyBulletsRef.current = enemyBulletsRef.current
      .map(bullet => ({ ...bullet, y: bullet.y + bullet.speed }))
      .filter(bullet => bullet.y < GAME_HEIGHT);
  };

  const spawnObjects = () => {
    const now = Date.now();
    if (now - lastEnemySpawn.current > SPAWN_INTERVAL_ENEMY) {
      enemiesRef.current = [
        ...enemiesRef.current,
        {
          x: Math.random() * (GAME_WIDTH - ENEMY_SIZE),
          y: 0,
          size: ENEMY_SIZE,
          speed: 2,
          health: ENEMY_HEALTH,
          lastShotTime: now,
        },
      ];
      lastEnemySpawn.current = now;
    }
    if (now - lastAsteroidSpawn.current > SPAWN_INTERVAL_ASTEROID) {
      asteroidsRef.current = [
        ...asteroidsRef.current,
        {
          x: Math.random() * (GAME_WIDTH - ASTEROID_SIZE),
          y: 0,
          size: ASTEROID_SIZE,
          speed: 3,
        },
      ];
      lastAsteroidSpawn.current = now;
    }
    if (now - lastCoinSpawn.current > SPAWN_INTERVAL_COIN) {
      coinsRef.current = [
        ...coinsRef.current,
        {
          x: Math.random() * (GAME_WIDTH - COIN_SIZE),
          y: 0,
          size: COIN_SIZE,
          speed: 2,
        },
      ];
      lastCoinSpawn.current = now;
    }
  };

  const checkCollisions = () => {
    const player = playerRef.current;

    if (
      enemiesRef.current.some(enemy => checkCollision(player, enemy)) ||
      asteroidsRef.current.some(asteroid => checkCollision(player, asteroid)) ||
      enemyBulletsRef.current.some(bullet => checkCollision(player, bullet))
    ) {
      setGameOver(true);
    }

    coinsRef.current = coinsRef.current.filter(coin => {
      if (checkCollision(player, coin)) {
        setScore(prev => prev + 1);
        return false;
      }
      return true;
    });

    bulletsRef.current.forEach((bullet, bulletIdx) => {
      enemiesRef.current = enemiesRef.current
        .map(enemy => {
          if (checkCollision(bullet, enemy)) {
            bulletsRef.current = bulletsRef.current.filter((_, i) => i !== bulletIdx);
            const updatedEnemy = { ...enemy, health: enemy.health - 1 };
            if (updatedEnemy.health <= 0) {
              setScore(prev => prev + 3);
              return null;
            }
            return updatedEnemy;
          }
          return enemy;
        })
        .filter(enemy => enemy !== null) as Enemy[];
    });
  };

  const checkCollision = (obj1: GameObject, obj2: GameObject): boolean => {
    return (
      obj1.x < obj2.x + obj2.size &&
      obj1.x + obj1.size > obj2.x &&
      obj1.y < obj2.y + obj2.size &&
      obj1.y + obj1.size > obj2.y
    );
  };

  const renderGame = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = darkMode ? 'white' : 'black';
    stars.current.forEach(star => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, 1, 0, Math.PI * 2);
      ctx.fill();
    });

    const player = playerRef.current;
    ctx.font = `${player.size}px Arial`;
    ctx.fillText('🚀', player.x, player.y + player.size);

    enemiesRef.current.forEach(enemy => {
      ctx.font = `${enemy.size}px Arial`;
      ctx.fillText('👾', enemy.x, enemy.y + enemy.size);
    });

    asteroidsRef.current.forEach(asteroid => {
      ctx.font = `${asteroid.size}px Arial`;
      ctx.fillText('🌑', asteroid.x, asteroid.y + asteroid.size);
    });

    coinsRef.current.forEach(coin => {
      ctx.font = `${coin.size}px Arial`;
      ctx.fillText('💰', coin.x, coin.y + coin.size);
    });

    ctx.fillStyle = darkMode ? '#FFFFFF' : '#000000';
    bulletsRef.current.forEach(bullet => {
      ctx.font = `${bullet.size * 5}px Arial`;
      ctx.fillText('•', bullet.x, bullet.y);
    });
    enemyBulletsRef.current.forEach(bullet => {
      ctx.font = `${bullet.size * 5}px Arial`;
      ctx.fillText('•', bullet.x, bullet.y);
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = true;
      if (e.key === 'ArrowRight') keys.current.right = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = false;
      if (e.key === 'ArrowRight') keys.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const restartGame = () => {
    playerRef.current.x = GAME_WIDTH / 2 - PLAYER_SIZE / 2;
    enemiesRef.current = [];
    asteroidsRef.current = [];
    coinsRef.current = [];
    bulletsRef.current = [];
    enemyBulletsRef.current = [];
    setScore(0);
    setGameOver(false);
  };

  return (
    <div
      className={`${darkMode ? 'bg-black' : 'bg-white'} flex flex-col items-center m-0 p-0 overflow-hidden relative`}
      style={{ height: '100vh' }}
    >
      <header className="flex justify-between items-center p-2 w-full z-20">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Pixel Rocket
        </h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-3 rounded-full transition-all duration-300 ${
            darkMode
              ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600 hover:shadow-[0_0_10px_rgba(255,255,0,0.5)]'
              : 'bg-white text-indigo-600 shadow-md hover:bg-gray-100 hover:shadow-[0_0_10px_rgba(79,70,229,0.5)]'
          } ${gameOver ? 'pointer-events-none opacity-50' : ''}`}
        >
          {darkMode ? <SunIcon size={28} /> : <MoonIcon size={28} />}
        </button>
      </header>

      <div
        className={`absolute top-28 left-4 z-10 ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'
        } p-4 rounded-lg shadow-md`}
      >
        <h2 className="text-2xl font-bold">Score: {score}</h2>
      </div>

      <div className="relative">
        <canvas ref={canvasRef} className="mt-4 border border-gray-500 z-10" />

        {gameOver && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20"
            style={{
              top: '0',
              left: '0',
              width: `${GAME_WIDTH}px`,
              height: `${GAME_HEIGHT}px`,
              marginTop: '1rem', // Adjust to align with canvas margin
            }}
          >
            <div
              className={`${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'
              } p-8 rounded-lg text-center`}
            >
              <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
              <p className="text-xl mb-4">Final Score: {score}</p>
              <button
                onClick={restartGame}
                className={`${
                  darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                } px-6 py-2 rounded-lg text-white transition-colors`}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}