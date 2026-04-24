import { KeystrokeFeatures, RegistrationResponse, UserSummary, VerificationResponse } from '../types';
import { StorageService } from './storageService';

const API_URL = 'http://localhost:8000';

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
      throw new Error(err.detail || 'Registration failed');
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
        throw new Error(err.detail || 'Verification failed');
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