import { KeystrokeFeatures, RegistrationResponse, UserSummary, VerificationResponse } from '../types';
import { StorageService } from './storageService';

const API_URL = 'http://localhost:8000';

const formatApiError = (err: any, fallback: string): string => {
  if (!err) return fallback;
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) {
    const messages = err.detail
      .map((item: any) => {
        if (!item) return null;
        if (typeof item === 'string') return item;
        const path = Array.isArray(item.loc) ? item.loc.join('.') : '';
        const msg = item.msg || item.message || JSON.stringify(item);
        return path ? `${path}: ${msg}` : msg;
      })
      .filter(Boolean);
    return messages.length > 0 ? messages.join('; ') : fallback;
  }
  return err.message || fallback;
};

// Флаг режима работы. По умолчанию пытаемся работать с сервером, но App.tsx может переключить.
let isLocalMode = false;

export const ApiService = {
  // Управление режимом
  setLocalMode: (enabled: boolean) => {
    isLocalMode = enabled;
  },
  
  isLocalMode: () => isLocalMode,

  healthCheck: async (): Promise<boolean> => {
    if (isLocalMode) return true; // Локальный режим всегда "онлайн"
    try {
      const res = await fetch(`${API_URL}/health`);
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  getUsers: async (): Promise<UserSummary[]> => {
    if (isLocalMode) {
      // Имитация асинхронности
      return new Promise(resolve => setTimeout(() => resolve(StorageService.getUsers()), 300));
    }
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  registerUser: async (username: string, samples: KeystrokeFeatures[]): Promise<RegistrationResponse> => {
    if (isLocalMode) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                resolve(StorageService.saveUser(username, samples));
            } catch (e: any) {
                reject(e);
            }
        }, 500);
      });
    }
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, samples }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(formatApiError(err, 'Registration failed'));
    }
    return res.json();
  },

  verifyUser: async (username: string, sample: KeystrokeFeatures): Promise<VerificationResponse> => {
    if (isLocalMode) {
       return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                resolve(StorageService.verifyUser(username, sample));
            } catch (e: any) {
                reject(e);
            }
        }, 300);
      });
    }
    const res = await fetch(`${API_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sample }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(formatApiError(err, 'Verification failed'));
    }
    return res.json();
  },
  
  getTemplate: async (username: string) => {
      if (isLocalMode) {
          return StorageService.getTemplate(username);
      }
      const res = await fetch(`${API_URL}/users/${username}/template`);
      if (!res.ok) return null;
      return res.json();
  },

  // Только для локального режима
  clearLocalDb: () => {
    StorageService.clear();
  }
};