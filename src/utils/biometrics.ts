import { KeystrokeFeatures, RawKeyEvent } from '../types';

const MODIFIER_KEYS = ['Control', 'Alt', 'Meta', 'Shift', 'CapsLock', 'Tab'];

const isSuspiciousKeyCode = (code: string) => {
  if (!code || !code.trim()) return true;
  return MODIFIER_KEYS.some((p) => code.startsWith(p));
};

/** Извлечь признаки клавиатурного почерка из «сырых» событий клавиатуры. */
export const extractFeatures = (events: RawKeyEvent[]): KeystrokeFeatures => {
  const dwellTimes: Record<string, number> = {};
  const flightTimes: Record<string, number> = {};
  const globalDwells: number[] = [];
  const globalFlights: number[] = [];

  let typedChars = 0;
  let backspaceCount = 0;
  let deleteCount = 0;

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const downMap: Record<string, number> = {};
  let previousUpTimestamp: number | null = null;
  let previousKey: string | null = null;

  sorted.forEach((ev) => {
    if (ev.type === 'keydown') {
      if (ev.key === 'Backspace') backspaceCount++;
      if (ev.key === 'Delete') deleteCount++;
      if (ev.key.length === 1) typedChars++;

      downMap[ev.code] = ev.timestamp;

      if (previousKey && previousUpTimestamp !== null) {
        const flight = ev.timestamp - previousUpTimestamp;
        const digraph = `${previousKey}->${ev.code}`;
        flightTimes[digraph] = flight;
        globalFlights.push(flight);
      }
    } else if (ev.type === 'keyup') {
      const downAt = downMap[ev.code];
      if (downAt !== undefined) {
        const dwell = ev.timestamp - downAt;
        dwellTimes[ev.code] = dwell;
        globalDwells.push(dwell);
        previousUpTimestamp = ev.timestamp;
        previousKey = ev.code;
      }
    }
  });

  const start = sorted[0]?.timestamp ?? 0;
  const end = sorted[sorted.length - 1]?.timestamp ?? 0;
  const correctionRate = (backspaceCount + deleteCount) / Math.max(typedChars, 1);

  return {
    totalDuration: Math.max(0, end - start),
    dwellTimes,
    flightTimes,
    globalDwells,
    globalFlights,
    typedChars,
    backspaceCount,
    deleteCount,
    correctionRate: Math.min(1, correctionRate),
  };
};

/** Базовая валидация признаков (анти-бот, защита от копи-паста). */
export const validateFeatures = (
  features: KeystrokeFeatures,
  _expectedLength: number,
  mode: 'registration' | 'auth' = 'auth'
): string | null => {
  if (features.totalDuration < 500) return 'Слишком быстрый ввод (подозрение на копирование или бота).';
  if (features.totalDuration > 60000) return 'Слишком медленный ввод. Пожалуйста, печатайте в естественном темпе.';

  const dwellValues = Object.values(features.dwellTimes);
  if (dwellValues.length === 0) return 'Нет данных о нажатиях.';
  if (dwellValues.some((t) => t > 2000)) return 'Некоторые клавиши удерживались слишком долго (более 2 секунд).';

  const flightValues = Object.values(features.flightTimes);
  const nearZero = flightValues.filter((t) => Math.abs(t) < 5).length;
  if (flightValues.length > 0 && nearZero > flightValues.length * 0.6) {
    return 'Аномальный ритм переходов (подозрение на автоматический ввод).';
  }

  if (mode === 'registration') {
    const validDwells = Object.entries(features.dwellTimes).filter(([code]) => !isSuspiciousKeyCode(code));
    if (validDwells.length < 5) return 'Недостаточно валидных нажатий для регистрации.';
  }

  return null;
};

/** Вспомогательное: сводный массив dwell/flight для графиков. */
export const featuresToSeries = (f: KeystrokeFeatures): { dwells: { key: string; ms: number }[]; flights: { pair: string; ms: number }[] } => {
  const dwells = Object.entries(f.dwellTimes)
    .filter(([code]) => !isSuspiciousKeyCode(code))
    .map(([code, ms]) => ({ key: code.replace('Key', ''), ms: Math.round(ms) }));

  const flights = Object.entries(f.flightTimes)
    .filter(([digraph]) => {
      const [a, b] = digraph.split('->');
      return a && b && !isSuspiciousKeyCode(a) && !isSuspiciousKeyCode(b);
    })
    .map(([digraph, ms]) => ({
      pair: digraph.replace(/Key/g, '').replace('->', '→'),
      ms: Math.round(ms),
    }));

  return { dwells, flights };
};
