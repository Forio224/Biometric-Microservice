import { useCallback, useRef, useState } from 'react';

export type AnalysisStage = 'idle' | 'collecting' | 'extracting' | 'matching' | 'verifying' | 'done';

export interface AnalysisResult {
  success: boolean;
  matchPercent: number;     // 0..100
  threshold: number;        // 0..100
  far: number;              // %
  frr: number;              // %
  reason: string;
  stages: { stage: AnalysisStage; label: string; ms: number }[];
}

const STAGE_PIPELINE: { stage: AnalysisStage; label: string; ms: number }[] = [
  { stage: 'collecting', label: 'Сбор клавиатурных событий',     ms: 600 },
  { stage: 'extracting', label: 'Извлечение признаков (dwell/flight)', ms: 700 },
  { stage: 'matching',   label: 'Сопоставление с эталоном GMM',  ms: 800 },
  { stage: 'verifying',  label: 'Принятие решения по порогу',     ms: 500 },
];

// Простой PRNG на основе сида, чтобы результат был детерминированным от username + phrase
const seededRng = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

const stringSeed = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export function useAnalysisSimulation() {
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const timersRef = useRef<number[]>([]);

  const cancel = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const reset = useCallback(() => {
    cancel();
    setStage('idle');
    setProgress(0);
    setResult(null);
  }, [cancel]);

  const start = useCallback((username: string, phrase: string) => {
    cancel();
    setResult(null);
    setProgress(0);

    const rng = seededRng(stringSeed(`${username || 'anon'}::${phrase || ''}`));
    const baseScore = 0.62 + rng() * 0.34;          // 0.62..0.96
    const noise = (rng() - 0.5) * 0.08;             // ±4%
    const matchPercent = Math.max(0, Math.min(100, Math.round((baseScore + noise) * 100)));
    const threshold = 72;
    const success = matchPercent >= threshold;

    const totalMs = STAGE_PIPELINE.reduce((s, p) => s + p.ms, 0);
    let elapsed = 0;
    STAGE_PIPELINE.forEach((step) => {
      const id = window.setTimeout(() => {
        setStage(step.stage);
        const next = elapsed + step.ms;
        setProgress(Math.min(100, Math.round((next / totalMs) * 100)));
      }, elapsed);
      timersRef.current.push(id);
      elapsed += step.ms;
    });

    const finalId = window.setTimeout(() => {
      setStage('done');
      setProgress(100);
      setResult({
        success,
        matchPercent,
        threshold,
        far: 1.8,
        frr: 3.4,
        reason: success
          ? 'Шаблон соответствует эталону: ритм нажатий и пауз совпадает.'
          : 'Отклонено: ритм нажатий отличается от эталона выше порога.',
        stages: STAGE_PIPELINE,
      });
    }, elapsed + 60);
    timersRef.current.push(finalId);
  }, [cancel]);

  return { stage, progress, result, start, reset };
}
