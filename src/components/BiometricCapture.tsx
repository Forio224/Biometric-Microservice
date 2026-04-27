import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint } from 'lucide-react';

interface Props {
  /** Сколько символов уже введено — управляет «уровнем» захвата */
  charsTyped: number;
  /** Максимум, после которого захват считается полным */
  expected?: number;
  /** Активна ли стадия захвата (ввод идёт) */
  active: boolean;
  /** Подсветить вспышку на каждом нажатии (используется родителем через key) */
  pulseKey?: number;
}

export const BiometricCapture: React.FC<Props> = ({ charsTyped, expected = 56, active, pulseKey = 0 }) => {
  const captureRatio = Math.max(0, Math.min(1, charsTyped / expected));
  const captured = Math.round(captureRatio * 100);

  const orbitDots = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        radius: 78,
        delay: i * 0.07,
      })),
    []
  );

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1200);
    return () => window.clearInterval(id);
  }, [active]);

  return (
    <div className="relative w-full h-[260px] flex items-center justify-center scanline overflow-hidden rounded-2xl grid-bg">
      {/* центр */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 m-auto w-40 h-40 rounded-full"
          animate={{
            boxShadow: active
              ? [
                  '0 0 0 0 rgba(50,102,255,0.35)',
                  '0 0 0 22px rgba(50,102,255,0)',
                ]
              : '0 0 0 0 rgba(50,102,255,0)',
          }}
          transition={{ duration: 1.6, ease: 'easeOut', repeat: Infinity }}
        />
        <div className="relative z-10 w-40 h-40 rounded-full grid place-items-center bg-white/70 backdrop-blur border border-white/70 shadow-glass">
          <div className="absolute inset-2 rounded-full gradient-ring" />
          <div className="text-center">
            <Fingerprint className="mx-auto text-brand-600" size={36} />
            <div className="num text-2xl font-semibold text-ink-900 mt-1.5">{captured}%</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 mt-0.5">
              захват биометрии
            </div>
          </div>
        </div>

        {/* орбитальные точки */}
        {orbitDots.map((d, i) => {
          const intensity = captureRatio > 0 ? Math.min(1, captureRatio + 0.2) : 0.35;
          const x = Math.cos(d.angle) * d.radius;
          const y = Math.sin(d.angle) * d.radius;
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: `rgba(50,102,255,${intensity})`,
                boxShadow: '0 0 6px rgba(50,102,255,0.6)',
                translateX: x,
                translateY: y,
              }}
              animate={{
                scale: active ? [1, 1.6, 1] : 1,
                opacity: active ? [0.5, 1, 0.5] : 0.4,
              }}
              transition={{
                duration: 1.4,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: d.delay,
              }}
            />
          );
        })}
      </div>

      {/* вспышка на каждое нажатие */}
      <AnimatePresence>
        {pulseKey > 0 && (
          <motion.span
            key={pulseKey}
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 1.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="pointer-events-none absolute w-40 h-40 rounded-full ring-2 ring-brand-400/60"
          />
        )}
      </AnimatePresence>

      {/* нижняя «телеметрия» */}
      <div className="absolute left-4 right-4 bottom-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink-500 num">
        <span>tick #{String(tick).padStart(3, '0')}</span>
        <span>events: {charsTyped}</span>
        <span className={active ? 'text-emerald-600' : 'text-ink-400'}>
          {active ? '● capturing' : '○ idle'}
        </span>
      </div>
    </div>
  );
};
