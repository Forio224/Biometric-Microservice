import React from 'react';
import { motion } from 'framer-motion';
import { KEYBOARD_ROWS } from '../mock/data';

interface Props {
  values: Record<string, number>; // 0..1 для каждой клавиши
  highlight?: string | null;       // последняя нажатая клавиша
}

const heat = (v: number) => {
  // 0..1 → from cyan 50 to brand 600
  const stops = [
    { t: 0.0, c: '236,254,255' }, // accent-50
    { t: 0.3, c: '199,233,255' },
    { t: 0.6, c: '142,180,255' }, // brand-300
    { t: 0.9, c: '50,102,255' },  // brand-500
    { t: 1.0, c: '31,74,224' },   // brand-600
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i].t) {
      const k = (v - stops[i - 1].t) / (stops[i].t - stops[i - 1].t);
      const a = stops[i - 1].c.split(',').map(Number);
      const b = stops[i].c.split(',').map(Number);
      const r = a.map((x, j) => Math.round(x + (b[j] - x) * k));
      return `rgb(${r.join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1].c})`;
};

export const KeyHeatmap: React.FC<Props> = ({ values, highlight }) => {
  return (
    <div className="space-y-2">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1.5" style={{ paddingLeft: ri * 12 }}>
          {row.map((k) => {
            const v = values[k] ?? 0.2;
            const isHot = (highlight ?? '').toLowerCase() === k.toLowerCase();
            return (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="relative w-9 h-10 rounded-md grid place-items-center text-[12px] font-semibold border border-white/70 select-none"
                style={{
                  background: heat(v),
                  color: v > 0.55 ? 'white' : '#1d2540',
                  boxShadow: '0 1px 2px rgba(15,22,40,0.06), inset 0 1px 0 rgba(255,255,255,0.4)',
                }}
              >
                {k}
                {isHot && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0 rounded-md ring-2 ring-brand-400/80 pointer-events-none"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-2 justify-center pt-2">
        <span className="text-[11px] text-ink-500 uppercase tracking-[0.18em]">холоднее</span>
        <div className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(236,254,255), rgb(50,102,255))' }} />
        <span className="text-[11px] text-ink-500 uppercase tracking-[0.18em]">горячее</span>
      </div>
    </div>
  );
};
