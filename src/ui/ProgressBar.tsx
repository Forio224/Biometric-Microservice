import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  value: number; // 0..100
  /** Цветовой акцент */
  tone?: 'brand' | 'success' | 'danger' | 'warning';
  /** Скрыть подпись справа */
  hideLabel?: boolean;
  /** Бегущий блик */
  shimmer?: boolean;
  className?: string;
}

const toneToFill: Record<NonNullable<Props['tone']>, string> = {
  brand:   'from-brand-500 to-accent-500',
  success: 'from-emerald-500 to-teal-400',
  danger:  'from-rose-500 to-orange-500',
  warning: 'from-amber-400 to-orange-500',
};

export const ProgressBar: React.FC<Props> = ({ value, tone = 'brand', hideLabel = false, shimmer = false, className = '' }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex-1 h-2.5 rounded-full bg-ink-200/60 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${toneToFill[tone]}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        {shimmer && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2s_linear_infinite]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              backgroundSize: '200% 100%',
            }}
          />
        )}
      </div>
      {!hideLabel && (
        <span className="num text-xs font-semibold text-ink-700 w-10 text-right">{pct}%</span>
      )}
    </div>
  );
};
