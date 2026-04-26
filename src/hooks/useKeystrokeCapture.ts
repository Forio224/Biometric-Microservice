import React, { useCallback, useRef, useState } from 'react';

export interface KeystrokeEvent {
  key: string;
  code: string;
  type: 'down' | 'up';
  t: number; // performance.now()
}

export interface CaptureFeatures {
  dwellTimes: { key: string; ms: number }[];
  flightTimes: { pair: string; ms: number }[];
  totalMs: number;
  charsTyped: number;
}

const BLOCKED_KEYS = ['Shift', 'Tab', 'Control', 'Alt', 'Meta', 'CapsLock'];

export function useKeystrokeCapture() {
  const [events, setEvents] = useState<KeystrokeEvent[]>([]);
  const downMapRef = useRef<Record<string, number>>({});
  const lastKeyRef = useRef<{ code: string; key: string; upAt: number } | null>(null);

  const reset = useCallback(() => {
    setEvents([]);
    downMapRef.current = {};
    lastKeyRef.current = null;
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (BLOCKED_KEYS.includes(e.key)) return;
    if (e.repeat) return;
    const t = performance.now();
    downMapRef.current[e.code] = t;
    setEvents((prev) => [...prev, { key: e.key, code: e.code, type: 'down', t }]);
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (BLOCKED_KEYS.includes(e.key)) return;
    const t = performance.now();
    setEvents((prev) => [...prev, { key: e.key, code: e.code, type: 'up', t }]);
    lastKeyRef.current = { code: e.code, key: e.key, upAt: t };
  }, []);

  const computeFeatures = useCallback((): CaptureFeatures => {
    const sorted = [...events].sort((a, b) => a.t - b.t);
    const dwellTimes: { key: string; ms: number }[] = [];
    const flightTimes: { pair: string; ms: number }[] = [];

    const downMap: Record<string, number> = {};
    let prev: { key: string; upAt: number } | null = null;

    sorted.forEach((ev) => {
      if (ev.type === 'down') {
        downMap[ev.code] = ev.t;
        if (prev) {
          flightTimes.push({ pair: `${prev.key}→${ev.key}`, ms: Math.max(0, ev.t - prev.upAt) });
        }
      } else {
        const downAt = downMap[ev.code];
        if (downAt !== undefined) {
          dwellTimes.push({ key: ev.key, ms: ev.t - downAt });
          prev = { key: ev.key, upAt: ev.t };
        }
      }
    });

    const totalMs = sorted.length > 0 ? sorted[sorted.length - 1].t - sorted[0].t : 0;
    const charsTyped = sorted.filter((e) => e.type === 'down' && e.key.length === 1).length;

    return { dwellTimes, flightTimes, totalMs, charsTyped };
  }, [events]);

  return { events, reset, onKeyDown, onKeyUp, computeFeatures };
}
