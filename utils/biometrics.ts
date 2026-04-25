import { RawKeyEvent, KeystrokeFeatures, UserTemplate } from '../types';

const average = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const robustMean = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.1);
  const core = sorted.slice(trim, sorted.length - trim);
  return average(core.length > 0 ? core : sorted);
};

// Преобразование "сырых" событий клавиатуры в вектор признаков
export const extractFeatures = (events: RawKeyEvent[]): KeystrokeFeatures => {
  const dwellTimes: Record<string, number> = {};
  const flightTimes: Record<string, number> = {};
  const globalDwells: number[] = [];
  const globalFlights: number[] = [];
  let typedChars = 0;
  let backspaceCount = 0;
  let deleteCount = 0;
  
  // Сортировка по времени
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  // Временные карты для поиска пар нажатие-отпускание
  const downMap: Record<string, number> = {};
  
  let previousUpTimestamp: number | null = null;
  let previousKey: string | null = null;

  sortedEvents.forEach((event) => {
    if (event.type === 'keydown') {
      if (event.key === 'Backspace') backspaceCount++;
      if (event.key === 'Delete') deleteCount++;
      if (event.key.length === 1) typedChars++;

      downMap[event.code] = event.timestamp;
      
      if (previousKey && previousUpTimestamp !== null) {
          const flight = event.timestamp - previousUpTimestamp;
          const digraph = `${previousKey}->${event.code}`;
          flightTimes[digraph] = flight;
          globalFlights.push(flight);
      }
    } else if (event.type === 'keyup') {
      const downTime = downMap[event.code];
      if (downTime !== undefined) {
        const dwell = event.timestamp - downTime;
        dwellTimes[event.code] = dwell;
        globalDwells.push(dwell);
        
        previousUpTimestamp = event.timestamp;
        previousKey = event.code;
      }
    }
  });

  const startTime = sortedEvents[0]?.timestamp || 0;
  const endTime = sortedEvents[sortedEvents.length - 1]?.timestamp || 0;
  const correctionRate = (backspaceCount + deleteCount) / Math.max(typedChars, 1);

  return {
    totalDuration: endTime - startTime,
    dwellTimes,
    flightTimes,
    globalDwells,
    globalFlights,
    typedChars,
    backspaceCount,
    deleteCount,
    correctionRate,
  };
};

// Валидация извлеченных признаков (защита от ботов, копипаста и аномалий)
export const validateFeatures = (features: KeystrokeFeatures, expectedLength: number): string | null => {
  if (features.totalDuration < 500) return "Слишком быстрый ввод (подозрение на копирование или бота).";
  if (features.totalDuration > 30000) return "Слишком медленный ввод. Пожалуйста, печатайте в естественном темпе.";
  
  const dwellValues = Object.values(features.dwellTimes);
  if (dwellValues.length === 0) return "Нет данных о нажатиях.";
  // Проверка на < 10 мс убрана, так как она может ложно срабатывать при первом вводе из-за особенностей браузера (автозаполнение, синтетические события)
  if (dwellValues.some(t => t > 2000)) return "Некоторые клавиши удерживались слишком долго (более 2 секунд).";

  const flightValues = Object.values(features.flightTimes);
  const nearZeroFlights = flightValues.filter(t => Math.abs(t) < 5).length;
  // Если больше половины переходов происходят почти мгновенно - это подозрительно
  if (flightValues.length > 0 && nearZeroFlights > flightValues.length * 0.6) {
    return "Аномальный ритм переходов (подозрение на автоматический ввод).";
  }

  return null;
};

// Создание шаблона из нескольких попыток ввода (Training)
export const createTemplate = (samples: KeystrokeFeatures[], phrase: string): UserTemplate => {
  const count = samples.length;
  if (count === 0) throw new Error("No samples provided");

  // 1. Сбор всех ключей
  const allDwellKeys = new Set<string>();
  const allFlightKeys = new Set<string>();
  
  samples.forEach(s => {
    Object.keys(s.dwellTimes).forEach(k => allDwellKeys.add(k));
    Object.keys(s.flightTimes).forEach(k => allFlightKeys.add(k));
  });

  // 2. Расчет средних (Mean)
  const means: UserTemplate['means'] = { dwell: {}, flight: {} };
  
  allDwellKeys.forEach(key => {
    const sum = samples.reduce((acc, s) => acc + (s.dwellTimes[key] || 0), 0);
    means.dwell[key] = sum / count;
  });
  
  allFlightKeys.forEach(key => {
    const sum = samples.reduce((acc, s) => acc + (s.flightTimes[key] || 0), 0);
    means.flight[key] = sum / count;
  });

  // 3. Расчет дисперсий (Variance) и стандартных отклонений (Std Dev)
  const variances: UserTemplate['variances'] = { dwell: {}, flight: {} };
  const deviations: UserTemplate['deviations'] = { dwell: {}, flight: {} };

  allDwellKeys.forEach(key => {
    const mean = means.dwell[key];
    const variance = samples.reduce((acc, s) => acc + Math.pow((s.dwellTimes[key] || mean) - mean, 2), 0) / count;
    // Добавляем минимальную дисперсию для стабильности
    const safeVariance = Math.max(variance, 400); // 20ms^2 (реалистичная погрешность человека)
    variances.dwell[key] = safeVariance;
    deviations.dwell[key] = Math.sqrt(safeVariance);
  });

  allFlightKeys.forEach(key => {
    const mean = means.flight[key];
    const variance = samples.reduce((acc, s) => acc + Math.pow((s.flightTimes[key] || mean) - mean, 2), 0) / count;
    const safeVariance = Math.max(variance, 400); // 20ms^2
    variances.flight[key] = safeVariance;
    deviations.flight[key] = Math.sqrt(safeVariance);
  });

  // 4. Расчет глобальных признаков (Global Features)
  const allGlobalDwells = samples.flatMap(s => s.globalDwells || []).filter(v => !isNaN(v));
  const allGlobalFlights = samples.flatMap(s => s.globalFlights || []).filter(v => !isNaN(v));

  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const stdDev = (arr: number[], m: number) => arr.length > 0 ? Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length) : 0;

  const globalDwellMean = mean(allGlobalDwells);
  const globalDwellStd = Math.max(stdDev(allGlobalDwells, globalDwellMean), 5); // min 5ms variance
  
  const globalFlightMean = mean(allGlobalFlights);
  const globalFlightStd = Math.max(stdDev(allGlobalFlights, globalFlightMean), 10); // min 10ms variance
  const correctionRates = samples.map(s => s.correctionRate ?? 0);
  const correctionRateMean = mean(correctionRates);
  const correctionRateStd = Math.max(stdDev(correctionRates, correctionRateMean), 0.02);

  // 5. Установка порога для GMM (Log-Likelihood threshold)
  // Для GMM порог обычно подбирается. Здесь мы будем использовать нормализованный Log-Likelihood.
  const threshold = -12.0; // Более мягкий порог для реальных условий

  return {
    phrase,
    sampleCount: count,
    method: 'GMM',
    means,
    variances,
    deviations,
    globalDwellMean,
    globalDwellStd,
    globalFlightMean,
    globalFlightStd,
    correctionRateMean,
    correctionRateStd,
    threshold,
  };
};

// Верификация для непрерывной аутентификации (Свободный текст)
// Использует Z-оценку глобальных признаков + GMM для конкретных совпавших клавиш
export const verifyContinuous = (features: KeystrokeFeatures, template: UserTemplate): { score: number, isMatch: boolean, matchedCount: number, anomalyScore: number } => {
  const filteredDwells = (features.globalDwells || []).filter(v => Number.isFinite(v) && v >= 10 && v <= 2000);
  const filteredFlights = (features.globalFlights || []).filter(v => Number.isFinite(v) && v >= -300 && v <= 2000);
  const currentDwellMean = robustMean(filteredDwells);
  const currentFlightMean = robustMean(filteredFlights);

  // Если данных совсем нет или шаблон старый (без глобальных признаков)
  if (isNaN(currentDwellMean) || isNaN(currentFlightMean) || template.globalDwellMean === undefined || template.globalFlightMean === undefined) {
    return { score: 0, isMatch: true, matchedCount: 0, anomalyScore: 0 };
  }

  // 1. Оценка глобального ритма (Z-score)
  const zDwell = Math.abs(currentDwellMean - template.globalDwellMean) / (template.globalDwellStd || 1);
  const zFlight = Math.abs(currentFlightMean - template.globalFlightMean) / (template.globalFlightStd || 1);
  const globalAnomaly = (zDwell + zFlight) / 2;
  const currentCorrectionRate = features.correctionRate ?? 0;
  const correctionRateAnomaly =
    template.correctionRateMean !== undefined
      ? Math.abs(currentCorrectionRate - template.correctionRateMean) / (template.correctionRateStd || 0.02)
      : globalAnomaly;

  // 2. Оценка конкретных клавиш (если есть совпадения)
  let specificAnomaly = 0;
  let specificCount = 0;

  Object.keys(features.dwellTimes).forEach(key => {
    if (template.means.dwell[key] !== undefined) {
      const tMean = template.means.dwell[key];
      const tStd = template.deviations.dwell[key] || 1;
      const current = features.dwellTimes[key];
      
      const z = Math.abs(current - tMean) / tStd;
      specificAnomaly += z;
      specificCount++;
    }
  });

  Object.keys(features.flightTimes).forEach(key => {
    if (template.means.flight[key] !== undefined) {
      const tMean = template.means.flight[key];
      const tStd = template.deviations.flight[key] || 1;
      const current = features.flightTimes[key];
      
      const z = Math.abs(current - tMean) / tStd;
      specificAnomaly += z;
      specificCount++;
    }
  });

  const avgSpecificAnomaly = specificCount > 0 ? specificAnomaly / specificCount : globalAnomaly;
  // Уверенность specific-части зависит от числа совпавших признаков:
  // при малом числе совпадений она должна иметь меньший вес.
  const specificConfidence = Math.min(1, specificCount / 25);
  const specificWeight = 0.25 + specificConfidence * 0.5; // 0.25 ... 0.75
  const globalWeight = 1 - specificWeight;

  // 3. Итоговая аномальность (смешиваем глобальный ритм и конкретные клавиши)
  const finalAnomaly =
    (globalAnomaly * globalWeight * 0.8) +
    (avgSpecificAnomaly * specificWeight * 0.8) +
    (correctionRateAnomaly * 0.2);

  // Если отклонение больше 1.8 сигм - это аномалия (чужой почерк)
  const isMatch = finalAnomaly < 1.8;

  return { score: finalAnomaly, isMatch, matchedCount: specificCount, anomalyScore: finalAnomaly };
};
// Используем упрощенный GMM (Log-Likelihood)
export const verifyUser = (features: KeystrokeFeatures, template: UserTemplate): { score: number, isMatch: boolean } => {
  let logLikelihood = 0;
  let featuresCount = 0;

  const calculateGaussianLogPdf = (x: number, mean: number, variance: number) => {
    // ln( 1 / sqrt(2 * pi * var) * exp( -0.5 * (x - mean)^2 / var ) )
    // = -0.5 * ln(2 * pi * var) - 0.5 * (x - mean)^2 / var
    return -0.5 * Math.log(2 * Math.PI * variance) - 0.5 * Math.pow(x - mean, 2) / variance;
  };

  // Сравнение Dwell Times
  Object.keys(template.means.dwell).forEach(key => {
    const mean = template.means.dwell[key];
    const variance = template.variances?.dwell[key] || Math.pow(template.deviations.dwell[key], 2);
    const current = features.dwellTimes[key];

    if (current !== undefined) {
      logLikelihood += calculateGaussianLogPdf(current, mean, variance);
      featuresCount++;
    } else {
      logLikelihood -= 10; // Штраф за пропуск
      featuresCount++;
    }
  });

  // Сравнение Flight Times
  Object.keys(template.means.flight).forEach(key => {
    const mean = template.means.flight[key];
    const variance = template.variances?.flight[key] || Math.pow(template.deviations.flight[key], 2);
    const current = features.flightTimes[key];

    if (current !== undefined) {
      logLikelihood += calculateGaussianLogPdf(current, mean, variance);
      featuresCount++;
    } else {
      logLikelihood -= 10;
      featuresCount++;
    }
  });

  if (featuresCount === 0) return { score: -100, isMatch: false };

  // Нормализованная оценка (средний log-likelihood на один признак)
  const finalScore = logLikelihood / featuresCount;
  const correctionRate = features.correctionRate ?? 0;
  const correctionMean = template.correctionRateMean ?? 0;
  const correctionStd = template.correctionRateStd ?? 0.02;
  const correctionZ = Math.abs(correctionRate - correctionMean) / correctionStd;
  const correctionPenalty = Math.min(2.5, correctionZ) * 0.35;
  const blendedScore = finalScore - correctionPenalty;
  
  // В GMM чем ВЫШЕ score (ближе к 0), тем лучше совпадение
  const isMatch = blendedScore > template.threshold;

  return { score: blendedScore, isMatch };
};
