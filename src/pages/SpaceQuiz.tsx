import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { SunIcon, MoonIcon } from 'lucide-react';
import { SpaceQuizQuestion } from '../types';

interface Star {
  x: number;
  y: number;
  speed: number;
}

export function SpaceQuiz() {
  const [questions, setQuestions] = useState<SpaceQuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  // Canvas for stars
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stars = useRef<Star[]>([]);

  // Canvas dimensions
  const GAME_WIDTH = window.innerWidth;
  const GAME_HEIGHT = window.innerHeight;

  // Initialize stars
  useEffect(() => {
    stars.current = Array.from({ length: 100 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      speed: Math.random() * 2 + 1, // Random speed between 1 and 3
    }));
  }, []);

  // Animate stars
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

    const animateStars = () => {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw stars
      ctx.fillStyle = darkMode ? 'white' : 'black';
      stars.current.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, 1, 0, Math.PI * 2);
        ctx.fill();

        // Move star downward
        star.y += star.speed;
        if (star.y > GAME_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * GAME_WIDTH;
        }
      });

      animationFrameId = requestAnimationFrame(animateStars);
    };

    animateStars();

    return () => cancelAnimationFrame(animationFrameId);
  }, [darkMode]);

  // Fetch quiz questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/quiz');
        setQuestions(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching quiz questions:', error);
        setError('Failed to fetch quiz questions.');
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleAnswer = (selectedAnswer: string) => {
    if (showAnswer) return;

    const isCorrect = selectedAnswer === questions[currentQuestion].correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
    }
    setShowAnswer(true);
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowAnswer(false);
    }
  };

  const restartQuiz = async () => {
    const response = await axios.get('http://localhost:5000/api/quiz');
    setQuestions(response.data);
    setCurrentQuestion(0);
    setScore(0);
    setShowAnswer(false);
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

  const question = questions[currentQuestion];
  const isLastQuestion = currentQuestion === questions.length - 1;

  return (
    <div className={`relative min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'} transition-colors duration-500 overflow-hidden`}>
      {/* Background Stars Canvas */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 z-0" style={{ pointerEvents: 'none' }} />

      {/* Header */}
      <header className="flex justify-between items-center p-4 w-full z-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500">
          Space Quiz
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
      <div className={`absolute top-16 left-4 z-10 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'} p-4 rounded-lg shadow-md`}>
        <h2 className="text-2xl font-bold">Score: {score}/{questions.length}</h2>
      </div>

      {/* Quiz Content */}
      <div className="max-w-2xl mx-auto pt-20 pb-8 px-4 z-10 relative">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} rounded-lg p-8 space-y-6 shadow-lg`}>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">{question.question}</h2>
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  disabled={showAnswer}
                  className={`w-full p-4 text-left rounded-lg transition-colors ${
                    showAnswer
                      ? option === question.correctAnswer
                        ? 'bg-green-500'
                        : 'bg-red-500 opacity-50'
                      : darkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-300 hover:bg-gray-400'
                  } ${darkMode ? 'text-white' : 'text-gray-800'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {showAnswer && (
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-300'} p-4 rounded-lg`}>
              <p className="font-semibold">Explanation:</p>
              <p>{question.explanation}</p>
            </div>
          )}

          <div className="flex justify-between items-center">
            {showAnswer && (
              <button
                onClick={isLastQuestion ? restartQuiz : nextQuestion}
                className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg text-white transition-colors"
              >
                {isLastQuestion ? 'Restart Quiz' : 'Next Question'}
              </button>
            )}
            <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Question {currentQuestion + 1} of {questions.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

