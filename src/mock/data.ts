// Mock-данные для прототипа ВКР. Без бэкенда, без сети.

export interface MockUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  trust: number; // 0..1
  registeredAt: string;
  lastLogin: string;
  samples: number;
}

export interface AttemptRecord {
  id: string;
  username: string;
  timestamp: string;
  status: 'success' | 'denied';
  score: number; // 0..1
  device: string;
  ip: string;
  reason?: string;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u-001',
    username: 'a.ivanov',
    fullName: 'Иванов А. С.',
    role: 'Администратор',
    trust: 0.94,
    registeredAt: '2025-09-12T10:14:00Z',
    lastLogin: '2026-04-25T19:22:00Z',
    samples: 12,
  },
  {
    id: 'u-002',
    username: 'm.petrova',
    fullName: 'Петрова М. И.',
    role: 'Аналитик ИБ',
    trust: 0.87,
    registeredAt: '2025-10-03T08:42:00Z',
    lastLogin: '2026-04-25T18:05:00Z',
    samples: 10,
  },
  {
    id: 'u-003',
    username: 'k.smirnov',
    fullName: 'Смирнов К. В.',
    role: 'Инженер',
    trust: 0.78,
    registeredAt: '2025-11-22T15:20:00Z',
    lastLogin: '2026-04-24T09:11:00Z',
    samples: 10,
  },
];

export const MOCK_ATTEMPTS: AttemptRecord[] = [
  { id: 'a-2041', username: 'a.ivanov',  timestamp: '2026-04-25T19:22:14Z', status: 'success', score: 0.93, device: 'Lenovo T14',     ip: '10.0.4.11',  reason: 'Совпадение шаблона' },
  { id: 'a-2040', username: 'a.ivanov',  timestamp: '2026-04-25T19:08:02Z', status: 'success', score: 0.88, device: 'Lenovo T14',     ip: '10.0.4.11' },
  { id: 'a-2039', username: 'm.petrova', timestamp: '2026-04-25T18:05:51Z', status: 'success', score: 0.81, device: 'MacBook Air',     ip: '10.0.4.34' },
  { id: 'a-2038', username: 'unknown',   timestamp: '2026-04-25T17:41:09Z', status: 'denied',  score: 0.42, device: 'Tor browser',     ip: '185.220.x.x', reason: 'Низкий уровень совпадения' },
  { id: 'a-2037', username: 'k.smirnov', timestamp: '2026-04-25T16:33:27Z', status: 'success', score: 0.79, device: 'Dell Latitude',   ip: '10.0.4.7' },
  { id: 'a-2036', username: 'a.ivanov',  timestamp: '2026-04-25T13:11:00Z', status: 'denied',  score: 0.55, device: 'Lenovo T14',     ip: '10.0.4.11', reason: 'Аномальный ритм нажатий' },
  { id: 'a-2035', username: 'm.petrova', timestamp: '2026-04-25T11:48:10Z', status: 'success', score: 0.84, device: 'MacBook Air',     ip: '10.0.4.34' },
  { id: 'a-2034', username: 'a.ivanov',  timestamp: '2026-04-25T10:02:21Z', status: 'success', score: 0.91, device: 'Lenovo T14',     ip: '10.0.4.11' },
  { id: 'a-2033', username: 'k.smirnov', timestamp: '2026-04-24T18:51:55Z', status: 'success', score: 0.76, device: 'Dell Latitude',   ip: '10.0.4.7' },
  { id: 'a-2032', username: 'a.ivanov',  timestamp: '2026-04-24T09:11:08Z', status: 'success', score: 0.95, device: 'Lenovo T14',     ip: '10.0.4.11' },
];

// Эталонные dwell/flight времена (мс) для контрольной фразы.
// Названия пар клавиш условные — для презентации это убедительно.
export const REFERENCE_DWELL: { key: string; reference: number }[] = [
  { key: 'С', reference: 96 },
  { key: 'ъ', reference: 88 },
  { key: 'е', reference: 102 },
  { key: 'ш', reference: 110 },
  { key: 'ь', reference: 84 },
  { key: 'ж', reference: 118 },
  { key: 'е', reference: 100 },
  { key: 'е', reference: 98 },
  { key: 'щ', reference: 124 },
  { key: 'ё', reference: 92 },
  { key: 'э', reference: 96 },
  { key: 'т', reference: 90 },
  { key: 'и', reference: 88 },
  { key: 'х', reference: 104 },
];

export const REFERENCE_FLIGHT: { pair: string; reference: number }[] = [
  { pair: 'С→ъ', reference: 142 },
  { pair: 'ъ→е', reference: 121 },
  { pair: 'е→ш', reference: 148 },
  { pair: 'ш→ь', reference: 135 },
  { pair: 'ь→ ', reference: 168 },
  { pair: ' →ж', reference: 179 },
  { pair: 'ж→е', reference: 152 },
  { pair: 'е→ ', reference: 161 },
  { pair: ' →е', reference: 174 },
  { pair: 'е→щ', reference: 155 },
  { pair: 'щ→ё', reference: 138 },
  { pair: 'ё→ ', reference: 167 },
  { pair: ' →э', reference: 173 },
  { pair: 'э→т', reference: 132 },
];

export interface BiometricMetrics {
  far: number;       // False Acceptance Rate (%)
  frr: number;       // False Rejection Rate (%)
  accuracy: number;  // %
  precision: number; // %
  recall: number;    // %
  f1: number;        // %
  eer: number;       // Equal Error Rate (%)
  threshold: number; // 0..1
  totalAttempts: number;
  blockedThreats: number;
}

export const MOCK_METRICS: BiometricMetrics = {
  far: 1.8,
  frr: 3.4,
  accuracy: 96.2,
  precision: 95.1,
  recall: 96.6,
  f1: 95.9,
  eer: 2.5,
  threshold: 0.72,
  totalAttempts: 1843,
  blockedThreats: 27,
};

// История качества по неделям — для графика на дашборде
export const ACCURACY_TIMELINE = [
  { week: 'W14', accuracy: 91.2, far: 4.1, frr: 5.6 },
  { week: 'W15', accuracy: 93.5, far: 3.2, frr: 4.3 },
  { week: 'W16', accuracy: 94.8, far: 2.7, frr: 3.9 },
  { week: 'W17', accuracy: 95.7, far: 2.2, frr: 3.6 },
  { week: 'W18', accuracy: 96.0, far: 2.0, frr: 3.5 },
  { week: 'W19', accuracy: 96.2, far: 1.8, frr: 3.4 },
];

// Распределение score попыток (для гистограммы)
export const SCORE_DISTRIBUTION = [
  { bin: '0.0–0.1', count: 4 },
  { bin: '0.1–0.2', count: 6 },
  { bin: '0.2–0.3', count: 8 },
  { bin: '0.3–0.4', count: 14 },
  { bin: '0.4–0.5', count: 22 },
  { bin: '0.5–0.6', count: 38 },
  { bin: '0.6–0.7', count: 71 },
  { bin: '0.7–0.8', count: 142 },
  { bin: '0.8–0.9', count: 218 },
  { bin: '0.9–1.0', count: 184 },
];

// Имитация heatmap клавиатуры (значения 0..1 — насколько «характерна» клавиша для пользователя)
export const KEYBOARD_ROWS: string[][] = [
  ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ъ'],
  ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж','Э'],
  ['Я','Ч','С','М','И','Т','Ь','Б','Ю'],
];

// Сид-функция, чтобы значения «прыгали» при перерисовке, но оставались осмысленными
export const buildHeatmap = (seed = 0.42): Record<string, number> => {
  const map: Record<string, number> = {};
  let s = seed;
  KEYBOARD_ROWS.flat().forEach((k) => {
    s = (s * 9301 + 49297) % 233280;
    const v = (s / 233280);
    map[k] = Math.min(1, 0.15 + v * 0.85);
  });
  return map;
};
