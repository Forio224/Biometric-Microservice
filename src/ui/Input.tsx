import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  hint?: string;
  icon?: React.ReactNode;
  error?: string;
  onChange?: (value: string) => void;
  /** Пульсация при вводе (для биометрии) */
  pulseOnInput?: boolean;
}

export const Input: React.FC<Props> = ({
  label,
  hint,
  icon,
  error,
  className = '',
  onChange,
  pulseOnInput = false,
  ...rest
}) => {
  const [pulse, setPulse] = useState(0);
  const [focused, setFocused] = useState(false);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 mb-1.5">
          {label}
        </label>
      )}
      <div className={`relative group rounded-xl ${focused ? 'shadow-glow' : 'shadow-soft'} transition-shadow`}>
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          {...rest}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (pulseOnInput) setPulse((p) => p + 1);
          }}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          className={`w-full rounded-xl bg-white/80 backdrop-blur border ${
            error ? 'border-rose-300' : 'border-white/70'
          } ${icon ? 'pl-10' : 'pl-4'} pr-4 py-3 text-[15px] text-ink-900 placeholder:text-ink-400
              focus:outline-none focus:border-brand-400 focus:bg-white transition-all ${className}`}
        />
        {/* Pulse ripple на каждый ввод */}
        <AnimatePresence>
          {pulseOnInput && pulse > 0 && (
            <motion.span
              key={pulse}
              initial={{ scale: 0.92, opacity: 0.7 }}
              animate={{ scale: 1.06, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-brand-400/60"
            />
          )}
        </AnimatePresence>
      </div>
      {hint && !error && (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
};
