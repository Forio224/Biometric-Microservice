import React from 'react';
import { motion } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow hover:shadow-[0_0_0_4px_rgba(50,102,255,0.18),0_18px_44px_-10px_rgba(50,102,255,0.45)]',
  secondary:
    'bg-white/80 text-ink-800 border border-white/70 shadow-soft hover:bg-white',
  ghost:
    'bg-transparent text-ink-700 hover:bg-white/60 border border-transparent',
  danger:
    'bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-soft hover:shadow-[0_18px_44px_-10px_rgba(244,63,94,0.5)]',
};

export const AnimatedButton: React.FC<Props> = ({
  variant = 'primary',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20
                  ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
      )}
      {!loading && icon}
      <span>{children}</span>
    </motion.button>
  );
};
