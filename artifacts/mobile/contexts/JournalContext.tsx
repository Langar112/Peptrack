import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@peptidepro/cycles';

export interface Cycle {
  id: string;
  peptideName: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate?: string; // ISO date string YYYY-MM-DD — optional (ongoing cycles have no end)
  dosage: string; // e.g. "250 mcg"
  frequency: string; // e.g. "Daily"
  notes: string;
  createdAt: string;
}

export type CycleStatus = 'upcoming' | 'active' | 'completed';

export function getCycleStatus(startDate: string, endDate?: string): CycleStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate + 'T00:00:00');
  if (now < start) return 'upcoming';
  if (!endDate) return 'active'; // ongoing — no end date means always active once started
  const end = new Date(endDate + 'T23:59:59');
  if (now > end) return 'completed';
  return 'active';
}

export interface WeekEntry {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  status: 'completed' | 'current' | 'upcoming';
}

export function getWeeks(startDate: string, endDate?: string): WeekEntry[] {
  const start = new Date(startDate + 'T00:00:00');
  // If no end date, show weeks from start through today (current week)
  const end = endDate
    ? new Date(endDate + 'T23:59:59')
    : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();
  const today = new Date();
  const weeks: WeekEntry[] = [];
  let current = new Date(start);
  let weekNum = 1;

  while (current <= end) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > end) weekEnd.setTime(end.getTime());

    let status: WeekEntry['status'];
    if (today > weekEnd) status = 'completed';
    else if (today >= weekStart && today <= weekEnd) status = 'current';
    else status = 'upcoming';

    weeks.push({ weekNumber: weekNum, startDate: weekStart, endDate: weekEnd, status });
    current.setDate(current.getDate() + 7);
    weekNum++;
  }

  return weeks;
}

interface JournalContextType {
  cycles: Cycle[];
  isLoading: boolean;
  addCycle: (cycle: Omit<Cycle, 'id' | 'createdAt'>) => void;
  deleteCycle: (id: string) => void;
  getCycleById: (id: string) => Cycle | undefined;
}

const JournalContext = createContext<JournalContextType | null>(null);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (data) {
          try {
            setCycles(JSON.parse(data));
          } catch {
            // ignore corrupt data
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const addCycle = useCallback((cycle: Omit<Cycle, 'id' | 'createdAt'>) => {
    const newCycle: Cycle = {
      ...cycle,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setCycles((prev) => {
      const updated = [newCycle, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteCycle = useCallback((id: string) => {
    setCycles((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getCycleById = useCallback(
    (id: string) => cycles.find((c) => c.id === id),
    [cycles]
  );

  return (
    <JournalContext.Provider value={{ cycles, isLoading, addCycle, deleteCycle, getCycleById }}>
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used within JournalProvider');
  return ctx;
}
