import React from 'react';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const toneStyles: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger:  'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info:    'bg-brand-50 text-brand-700 border-brand-200',
  neutral: 'bg-white/70 text-ink-600 border-white/70',
};

interface Props {
  tone?: Tone;
  pulse?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const StatusPill: React.FC<Props> = ({ tone = 'neutral', pulse = false, icon, children, className = '' }) => {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${toneStyles[tone]} ${className}`}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {icon}
      {children}
    </span>
  );
};
