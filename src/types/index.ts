export interface Planet {
  id: string;
  name: string;
  type: string;
  image: string;
  distance: string;
  mass: string;
  diameter: string;
  gravity: string;
  escapeVelocity: string;
  orbitalPeriod: string;
  temperature: string;
  moons: number;
  description: string;
}

export interface Astronaut {
  id: string;
  name: string;
  photo: string;
  nationality: string;
  birthDate: string;
  spaceWalks: number;
  missions: string[];
  totalDaysInSpace: number;
  status: 'active' | 'retired' | 'deceased';
  biography: string;
}

export interface Mission {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: 'planned' | 'in-progress' | 'completed' | 'failed';
  description: string;
  objectives: string[];
  crew: string[];
  vehicle: string;
  destination: string;
  images: string[];
}

export interface SpaceQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'planets' | 'space-history' | 'astronomy' | 'technology';
}