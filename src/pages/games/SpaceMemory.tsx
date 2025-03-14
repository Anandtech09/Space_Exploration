import { useEffect, useState } from 'react';
import axios from 'axios';
import { SunIcon, MoonIcon } from 'lucide-react';

interface Card {
  id: number;
  name: string;
  image: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export function SpaceMemory() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await axios.get(`https://space-exploration-5x72.onrender.com/api/memory-cards`);
        const items = response.data;
        const duplicatedItems = [...items, ...items].map((item: { name: string; image_url: string }, index: number) => ({
          id: index,
          name: item.name,
          image: item.image_url,
          isFlipped: false,
          isMatched: false
        }));

        // Shuffle cards
        for (let i = duplicatedItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [duplicatedItems[i], duplicatedItems[j]] = [duplicatedItems[j], duplicatedItems[i]];
        }

        setCards(duplicatedItems);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching cards:', error);
        setError('Lost in Space: Memory Cards Not Found (404)');
        setLoading(false);
      }
    };

    fetchCards();
  }, []);

  const handleCardClick = (id: number) => {
    if (flippedCards.length === 2) return;
    if (cards.find(card => card.id === id)?.isMatched) return;
    if (flippedCards.includes(id)) return;

    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, isFlipped: true } : card
    ));

    setFlippedCards(prev => [...prev, id]);

    if (flippedCards.length === 1) {
      setMoves(prev => prev + 1);
      const firstCard = cards.find(card => card.id === flippedCards[0]);
      const secondCard = cards.find(card => card.id === id);

      if (firstCard?.name === secondCard?.name) {
        setCards(prev => prev.map(card => 
          card.id === flippedCards[0] || card.id === id
            ? { ...card, isMatched: true }
            : card
        ));
        setFlippedCards([]);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(card => 
            card.id === flippedCards[0] || card.id === id
              ? { ...card, isFlipped: false }
              : card
          ));
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && cards.every(card => card.isMatched)) {
      setGameWon(true);
    }
  }, [cards]);

  const resetGame = () => {
    setCards(prev => prev.map(card => ({
      ...card,
      isFlipped: false,
      isMatched: false
    })));
    setFlippedCards([]);
    setMoves(0);
    setGameWon(false);
  };

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

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500`}>
      {/* Header */}
      <header className="flex justify-between items-center p-4 z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Space Memory
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

      {/* Score Display */}
      <div className={`absolute top-40 left-4 z-10 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'} p-4 rounded-lg shadow-md`}>
        <h2 className="text-2xl font-bold">Moves: {moves}</h2>
      </div>

      {/* Game Grid */}
      <div className="max-w-4xl mx-auto pt-20 pb-8 px-6 flex justify-center">
        <div className="grid grid-cols-4 gap-4"> {/* Increased gap to 4 */}
          {cards.map(card => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={`w-24 h-24 cursor-pointer transform transition-transform duration-300 ${
                card.isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              <div className={`relative w-full h-full ${card.isFlipped ? 'rotate-y-180' : ''}`}>
                {card.isFlipped ? (
                  <div className="absolute inset-0 bg-white rounded-lg p-1">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="w-full h-full object-cover rounded"
                    />
                    <p className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs text-center truncate">
                      {card.name}
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-2xl text-white">?</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Win Modal */}
      {gameWon && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-8 rounded-lg text-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            <h2 className="text-3xl font-bold mb-4">Congratulations, Space Explorer!</h2>
            <p className="text-xl mb-4">You won in {moves} moves!</p>
            <button
              onClick={resetGame}
              className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg text-white transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}