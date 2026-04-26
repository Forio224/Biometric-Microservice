import React, { useCallback, useRef, useState } from 'react';
import { extractFeatures } from '../utils/biometrics';
import { KeystrokeFeatures, RawKeyEvent } from '../types';

const BLOCKED_KEYS = ['Shift', 'Tab', 'Control', 'Alt', 'Meta', 'CapsLock'];

export function useKeystrokeCapture() {
  const [events, setEvents] = useState<RawKeyEvent[]>([]);

  const reset = useCallback(() => setEvents([]), []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (BLOCKED_KEYS.includes(e.key)) return;
    if (e.repeat) return;
    const ev: RawKeyEvent = {
      code: e.code,
      key: e.key,
      type: 'keydown',
      timestamp: performance.now(),
    };
    setEvents((prev) => [...prev, ev]);
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (BLOCKED_KEYS.includes(e.key)) return;
    const ev: RawKeyEvent = {
      code: e.code,
      key: e.key,
      type: 'keyup',
      timestamp: performance.now(),
    };
    setEvents((prev) => [...prev, ev]);
  }, []);

  const computeFeatures = useCallback((): KeystrokeFeatures => extractFeatures(events), [events]);

  // Для совместимости с UI, который раньше показывал «События / Символы / Длительность».
  // Возвращаем плоские массивы dwell/flight для индикаторов (без сортировки и фильтрации).
  const liveStats = useCallback(() => {
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const charsTyped = sorted.filter((e) => e.type === 'keydown' && e.key.length === 1).length;
    const totalMs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp - sorted[0].timestamp : 0;
    return {
      events: sorted.length,
      charsTyped,
      totalMs,
    };
  }, [events]);

  // Глобально доступная ссылка на «сырые» события (нужно для AnalysisPage).
  const eventsRef = useRef<RawKeyEvent[]>([]);
  eventsRef.current = events;

  return {
    events,
    eventsRef,
    reset,
    onKeyDown,
    onKeyUp,
    computeFeatures,
    liveStats,
  };
}
