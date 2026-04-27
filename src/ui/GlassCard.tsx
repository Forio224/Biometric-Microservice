import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type Props = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode;
  className?: string;
  /** Включает gradient-ring (тонкая градиентная рамка) */
  ring?: boolean;
  /** Усиленная стеклянная подложка */
  strong?: boolean;
  /** Без motion-анимации появления */
  static?: boolean;
};

export const GlassCard: React.FC<Props> = ({
  children,
  className = '',
  ring = false,
  strong = false,
  static: noMotion = false,
  ...rest
}) => {
  const base = `glass ${strong ? 'glass-strong' : ''} ${ring ? 'gradient-ring' : ''} ${className}`;
  if (noMotion) {
    return <div className={base}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={base}
      {...rest}
    >
      {children}
    </motion.div>
  );
};
