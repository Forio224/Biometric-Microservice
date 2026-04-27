import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}

export const SectionHeader: React.FC<Props> = ({ eyebrow, title, description, right }) => {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-600 mb-1.5">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-[26px] sm:text-[30px] font-semibold text-ink-900 leading-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-ink-600 mt-1.5 max-w-[640px] leading-relaxed">
            {description}
          </p>
        )}
      </motion.div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
};
