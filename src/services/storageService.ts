import { AttemptHistoryItem } from '../types';

const HISTORY_KEY = 'keystrokeid.history.v1';
const SESSION_KEY = 'keystrokeid.session.v1';

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const HistoryStore = {
  list(): AttemptHistoryItem[] {
    if (typeof window === 'undefined') return [];
    return safeParse<AttemptHistoryItem[]>(localStorage.getItem(HISTORY_KEY), []);
  },
  push(item: AttemptHistoryItem) {
    if (typeof window === 'undefined') return;
    const next = [item, ...this.list()].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  },
  clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(HISTORY_KEY);
  },
};

export interface LastSession {
  username: string;
  ts: string;
  score: number;
  success: boolean;
}

export const SessionStore = {
  get(): LastSession | null {
    if (typeof window === 'undefined') return null;
    return safeParse<LastSession | null>(localStorage.getItem(SESSION_KEY), null);
  },
  set(s: LastSession) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  },
  clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
  },
};
