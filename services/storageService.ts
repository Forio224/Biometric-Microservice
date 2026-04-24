import { KeystrokeFeatures, UserSummary, UserTemplate, VerificationResponse } from '../types';
import { createTemplate, verifyUser as verifyUserAlgo } from '../utils/biometrics';

const STORAGE_KEY = 'bioauth_users_v2';

interface LocalUser {
  id: string;
  username: string;
  created_at: number;
  template: UserTemplate;
}

export const StorageService = {
  // Получить всех пользователей (без тяжелых шаблонов)
  getUsers: (): UserSummary[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const users: LocalUser[] = JSON.parse(data);
    return users.map(u => ({
      id: u.id,
      username: u.username,
      created_at: new Date(u.created_at).toISOString()
    }));
  },

  // Сохранить нового пользователя (Обучение)
  saveUser: (username: string, samples: KeystrokeFeatures[]): { message: string, user_id: string } => {
    const data = localStorage.getItem(STORAGE_KEY);
    const users: LocalUser[] = data ? JSON.parse(data) : [];

    if (users.find(u => u.username === username)) {
      throw new Error("Пользователь уже существует (Local DB)");
    }

    // Локально используем GMM (Log-Likelihood)
    const template = createTemplate(samples, "контрольная-фраза-2025");
    template.method = "GMM (Local)";

    const newUser: LocalUser = {
      id: crypto.randomUUID(),
      username,
      created_at: Date.now(),
      template
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

    return { message: "User registered locally", user_id: newUser.id };
  },

  // Найти пользователя и проверить (Верификация)
  verifyUser: (username: string, sample: KeystrokeFeatures): VerificationResponse => {
    const data = localStorage.getItem(STORAGE_KEY);
    const users: LocalUser[] = data ? JSON.parse(data) : [];
    const user = users.find(u => u.username === username);

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    // Используем алгоритм из biometrics.ts
    const result = verifyUserAlgo(sample, user.template);

    return {
      success: result.isMatch,
      score: result.score,
      threshold: user.template.threshold,
      details: result.isMatch 
        ? "Локальная верификация успешна" 
        : `Отклонение почерка (${result.score.toFixed(2)} < ${user.template.threshold})`,
      username: username,
      method: "GMM (Local)"
    };
  },

  // Получить шаблон для графиков
  getTemplate: (username: string): UserTemplate | null => {
    const data = localStorage.getItem(STORAGE_KEY);
    const users: LocalUser[] = data ? JSON.parse(data) : [];
    const user = users.find(u => u.username === username);
    return user ? user.template : null;
  },

  // Очистка БД
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};