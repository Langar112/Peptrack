import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const TOKEN_KEY = '@peptidetracker/auth_token';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  return AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? 'Request failed');
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth
export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: User }>('/auth/me'),
    updateSettings: (settings: Partial<UserSettings>) =>
      request<{ user: User }>('/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    deleteAccount: () =>
      request<{ success: boolean }>('/auth/account', { method: 'DELETE' }),
  },

  cycles: {
    list: () => request<{ cycles: CycleWithRule[] }>('/cycles'),
    get: (id: string) => request<{ cycle: CycleWithRule }>(`/cycles/${id}`),
    create: (data: CreateCycleInput) =>
      request<{ cycle: CycleWithRule }>('/cycles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CreateCycleInput> & { applyFrom?: string }) =>
      request<{ cycle: CycleWithRule }>(`/cycles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/cycles/${id}`, { method: 'DELETE' }),
    archive: (id: string) =>
      request<{ cycle: CycleWithRule }>(`/cycles/${id}/archive`, { method: 'POST' }),
    pause: (id: string) =>
      request<{ cycle: CycleWithRule }>(`/cycles/${id}/pause`, { method: 'POST' }),
    resume: (id: string) =>
      request<{ cycle: CycleWithRule }>(`/cycles/${id}/resume`, { method: 'POST' }),
    catalog: () => request<{ catalog: PeptideCatalogItem[] }>('/cycles/catalog/list'),
  },

  injectionEvents: {
    list: (params?: { cycleId?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.cycleId) qs.set('cycleId', params.cycleId);
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      const q = qs.toString();
      return request<{ events: InjectionEvent[] }>(`/injection-events${q ? '?' + q : ''}`);
    },
    complete: (id: string, data?: CompleteEventInput) =>
      request<{ event: InjectionEvent }>(`/injection-events/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(data ?? {}),
      }),
    skip: (id: string, note?: string) =>
      request<{ event: InjectionEvent }>(`/injection-events/${id}/skip`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),
  },

  journal: {
    list: (params?: { type?: string; cycleId?: string; search?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.type) qs.set('type', params.type);
      if (params?.cycleId) qs.set('cycleId', params.cycleId);
      if (params?.search) qs.set('search', params.search);
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      const q = qs.toString();
      return request<{ entries: JournalEntry[] }>(`/journal${q ? '?' + q : ''}`);
    },
    create: (data: CreateJournalEntryInput) =>
      request<{ entry: JournalEntry }>('/journal', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CreateJournalEntryInput>) =>
      request<{ entry: JournalEntry }>(`/journal/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/journal/${id}`, { method: 'DELETE' }),
  },
};

// Types
export interface User {
  id: string;
  email: string;
  timezone: string;
  theme: string;
  firstDayOfWeek: string;
  defaultSyringeSize: string;
  disclaimerAccepted: boolean;
  createdAt: string;
}

export interface UserSettings {
  timezone: string;
  theme: string;
  firstDayOfWeek: string;
  defaultSyringeSize: string;
  disclaimerAccepted: boolean;
}

export interface PeptideCatalogItem {
  id: string;
  name: string;
  active: boolean;
  displayOrder: number;
}

export interface ScheduleRule {
  id: string;
  cycleId: string;
  frequencyType: string;
  injectionsPerWeek: number | null;
  daysOfWeek: string[] | null;
  intervalDays: number | null;
  injectionTimes: string[] | null;
  timezone: string;
}

export interface CycleWithRule {
  id: string;
  userId: string;
  peptideCatalogId: string | null;
  catalogName?: string | null;
  customCompoundName: string | null;
  cycleName: string | null;
  color: string;
  vialAmount: string;
  vialUnit: string;
  bacWaterMl: string;
  desiredDose: string;
  doseUnit: string;
  calculatedVolumeMl: string;
  calculatedSyringeUnits: string;
  syringeCapacityMl: string;
  startDate: string;
  endDate: string | null;
  durationWeeks: number | null;
  ongoing: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  scheduleRule: ScheduleRule | null;
}

export interface InjectionEvent {
  id: string;
  userId: string;
  cycleId: string;
  scheduledAt: string;
  plannedDose: string;
  plannedDoseUnit: string;
  plannedVolumeMl: string;
  plannedSyringeUnits: string;
  actualDose: string | null;
  actualDoseUnit: string | null;
  actualVolumeMl: string | null;
  actualSyringeUnits: string | null;
  status: string;
  injectionSite: string | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cycleName?: string | null;
  customCompoundName?: string | null;
  cycleColor?: string | null;
  cycleStartDate?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  cycleId: string | null;
  injectionEventId: string | null;
  entryType: string;
  entryDate: string;
  body: string | null;
  previousDose: string | null;
  newDose: string | null;
  doseUnit: string | null;
  previousSyringeUnits: string | null;
  newSyringeUnits: string | null;
  intensityRating: number | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
  cycleName?: string | null;
  customCompoundName?: string | null;
  cycleColor?: string | null;
}

export interface CreateCycleInput {
  peptideCatalogId?: string;
  customCompoundName?: string;
  cycleName?: string | null;
  color?: string;
  vialAmount: number;
  vialUnit: string;
  bacWaterMl: number;
  desiredDose: number;
  doseUnit: string;
  calculatedVolumeMl: number;
  calculatedSyringeUnits: number;
  syringeCapacityMl?: number;
  startDate: string;
  endDate?: string | null;
  durationWeeks?: number | null;
  ongoing?: boolean;
  scheduleRule?: {
    frequencyType: string;
    injectionsPerWeek?: number;
    daysOfWeek?: string[];
    intervalDays?: number;
    injectionTimes?: string[];
    timezone?: string;
  };
}

export interface CompleteEventInput {
  actualDose?: number;
  actualDoseUnit?: string;
  actualVolumeMl?: number;
  actualSyringeUnits?: number;
  injectionSite?: string;
  note?: string;
  completedAt?: string;
}

export interface CreateJournalEntryInput {
  cycleId?: string;
  injectionEventId?: string;
  entryType: string;
  entryDate: string;
  body?: string;
  previousDose?: string;
  newDose?: string;
  doseUnit?: string;
  previousSyringeUnits?: string;
  newSyringeUnits?: string;
  intensityRating?: number;
  tags?: string[];
}
