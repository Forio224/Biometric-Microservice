import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  label?: string;
  size?: number;
}

export const Loader: React.FC<Props> = ({ label = 'Анализ…', size = 36 }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-brand-500/30"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 border-r-accent-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-transparent border-t-accent-400"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.6, ease: 'linear', repeat: Infinity }}
        />
      </div>
      <span className="text-sm font-medium text-ink-700">{label}</span>
    </div>
  );
};
