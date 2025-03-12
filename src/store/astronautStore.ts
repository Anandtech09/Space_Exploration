import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Astronaut {
  id: string;
  name: string;
  nationality: string;
  agency: string;
  missions: string[];
  status: 'active' | 'retired' | 'deceased';
}

interface AstronautStore {
  astronauts: Astronaut[];
  setAstronauts: (astronauts: Astronaut[]) => void;
  filterByNationality: (nationality: string) => Astronaut[];
  filterByAgency: (agency: string) => Astronaut[];
  filterByStatus: (status: 'active' | 'retired' | 'deceased') => Astronaut[];
}

export const useAstronautStore = create<AstronautStore>()(
  persist(
    (set, get) => ({
      astronauts: [],
      setAstronauts: (astronauts) => set({ astronauts }),
      filterByNationality: (nationality) =>
        get().astronauts.filter((a) => !nationality || a.nationality === nationality),
      filterByAgency: (agency) =>
        get().astronauts.filter((a) => !agency || a.agency === agency),
      filterByStatus: (status) =>
        get().astronauts.filter((a) => !status || a.status === status),
    }),
    {
      name: 'astronaut-store',
    }
  )
);