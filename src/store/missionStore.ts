import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Mission {
  id: string;
  name: string;
  organization: string;
  country: string;
  type: 'current' | 'future' | 'past';
  startDate: string;
  endDate?: string;
  description: string;
}

interface MissionStore {
  missions: Mission[];
  setMissions: (missions: Mission[]) => void;
  filterByOrganization: (org: string) => Mission[];
  filterByCountry: (country: string) => Mission[];
  filterByType: (type: 'current' | 'future' | 'past') => Mission[];
}

export const useMissionStore = create<MissionStore>()(
  persist(
    (set, get) => ({
      missions: [],
      setMissions: (missions) => set({ missions }),
      filterByOrganization: (org) => 
        get().missions.filter(m => m.organization === org),
      filterByCountry: (country) => 
        get().missions.filter(m => m.country === country),
      filterByType: (type) => 
        get().missions.filter(m => m.type === type),
    }),
    {
      name: 'mission-store',
    }
  )
);