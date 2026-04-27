import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiService } from './services/apiService';
import { HistoryStore, SessionStore, type LastSession } from './services/storageService';
import { useBackendStatus } from './hooks/useBackendStatus';
import {
  AttemptHistoryItem,
  KeystrokeFeatures,
  UserSummary,
  UserTemplate,
  VerificationResponse,
} from './types';

interface AppState {
  online: boolean;
  ready: boolean;
  baseUrl: string;
  refresh: () => Promise<boolean>;

  users: UserSummary[];
  reloadUsers: () => Promise<void>;

  history: AttemptHistoryItem[];
  lastSession: LastSession | null;
  pushHistory: (item: AttemptHistoryItem, session?: LastSession) => void;
  clearHistory: () => void;

  // Последний шаблон + последние признаки — для страницы анализа
  lastTemplate: UserTemplate | null;
  lastFeatures: KeystrokeFeatures | null;
  setLastFeatures: (f: KeystrokeFeatures | null) => void;
  refreshTemplate: (username: string) => Promise<UserTemplate | null>;

  registerUser: (username: string, samples: KeystrokeFeatures[]) => Promise<{ message: string; user_id: string; source: 'api' | 'mock' }>;
  verifyUser: (username: string, sample: KeystrokeFeatures) => Promise<VerificationResponse & { source: 'api' | 'mock' }>;
}

const Ctx = createContext<AppState | null>(null);

export const useAppState = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAppState must be used inside <AppProvider>');
  return c;
};

const seededScore = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const norm = (Math.abs(h) % 10_000) / 10_000;
  return 0.55 + norm * 0.45; // 0.55..1.0
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useBackendStatus();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [history, setHistory] = useState<AttemptHistoryItem[]>(() => HistoryStore.list());
  const [lastSession, setLastSession] = useState<LastSession | null>(() => SessionStore.get());
  const [lastTemplate, setLastTemplate] = useState<UserTemplate | null>(null);
  const [lastFeatures, setLastFeatures] = useState<KeystrokeFeatures | null>(null);

  const reloadUsers = useCallback(async () => {
    if (!status.online) return;
    try {
      const list = await ApiService.getUsers();
      setUsers(list);
    } catch {
      /* keep current */
    }
  }, [status.online]);

  // Догружаем пользователей, когда бэк доступен
  useEffect(() => {
    if (status.online) reloadUsers();
  }, [status.online, reloadUsers]);

  const pushHistory = useCallback((item: AttemptHistoryItem, session?: LastSession) => {
    HistoryStore.push(item);
    setHistory(HistoryStore.list());
    if (session) {
      SessionStore.set(session);
      setLastSession(session);
    }
  }, []);

  const clearHistory = useCallback(() => {
    HistoryStore.clear();
    SessionStore.clear();
    setHistory([]);
    setLastSession(null);
  }, []);

  const refreshTemplate = useCallback(async (username: string): Promise<UserTemplate | null> => {
    if (!status.online || !username) {
      setLastTemplate(null);
      return null;
    }
    try {
      const t = await ApiService.getTemplate(username);
      setLastTemplate(t);
      return t;
    } catch {
      setLastTemplate(null);
      return null;
    }
  }, [status.online]);

  const registerUser: AppState['registerUser'] = useCallback(async (username, samples) => {
    if (status.online) {
      const res = await ApiService.registerUser(username, samples);
      await reloadUsers();
      return { ...res, source: 'api' as const };
    }
    // Mock-fallback: имитируем успех, чтобы можно было показать поведение
    return {
      message: 'Пользователь зарегистрирован локально (mock)',
      user_id: `mock-${Math.random().toString(16).slice(2, 8)}`,
      source: 'mock' as const,
    };
  }, [status.online, reloadUsers]);

  const verifyUser: AppState['verifyUser'] = useCallback(async (username, sample) => {
    let result: VerificationResponse & { source: 'api' | 'mock' };

    if (status.online) {
      const r = await ApiService.verifyUser(username, sample);
      result = { ...r, source: 'api' };
      // Подгружаем шаблон для страницы анализа
      ApiService.getTemplate(username).then((t) => setLastTemplate(t)).catch(() => {});
    } else {
      // Mock fallback: детерминированный score от пары username + длина ввода
      const seed = `${username}::${sample.totalDuration.toFixed(0)}::${(sample.typedChars ?? 0)}`;
      const raw = seededScore(seed);
      const threshold = 0.72;
      const success = raw >= threshold;
      result = {
        success,
        score: raw,
        threshold,
        details: success
          ? 'Локальная проверка: ритм совпадает с эталоном (mock)'
          : 'Локальная проверка: ритм отличается от эталона (mock)',
        username,
        method: 'mock-fallback',
        source: 'mock',
      };
    }

    setLastFeatures(sample);

    const item: AttemptHistoryItem = {
      id: `att-${Date.now().toString(36)}`,
      username,
      timestamp: new Date().toISOString(),
      status: result.success ? 'success' : 'denied',
      score: result.score,
      threshold: result.threshold,
      method: result.method,
      details: result.details,
      source: result.source,
    };
    pushHistory(item, {
      username,
      ts: item.timestamp,
      score: result.score,
      success: result.success,
    });

    return result;
  }, [status.online, pushHistory]);

  const value: AppState = useMemo(() => ({
    online: status.online,
    ready: status.ready,
    baseUrl: status.baseUrl,
    refresh: status.refresh,
    users,
    reloadUsers,
    history,
    lastSession,
    pushHistory,
    clearHistory,
    lastTemplate,
    lastFeatures,
    setLastFeatures,
    refreshTemplate,
    registerUser,
    verifyUser,
  }), [
    status.online, status.ready, status.baseUrl, status.refresh,
    users, reloadUsers,
    history, lastSession, pushHistory, clearHistory,
    lastTemplate, lastFeatures,
    refreshTemplate, registerUser, verifyUser,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
