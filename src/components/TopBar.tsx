import React from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, ShieldCheck, ScanLine, LayoutDashboard } from 'lucide-react';
import { StatusPill } from '../ui/StatusPill';

export type RouteId = 'auth' | 'analysis' | 'dashboard';

interface Props {
  route: RouteId;
  onChange: (r: RouteId) => void;
}

const ITEMS: { id: RouteId; label: string; icon: React.ReactNode }[] = [
  { id: 'auth',      label: 'Аутентификация', icon: <ShieldCheck size={16} /> },
  { id: 'analysis',  label: 'Анализ почерка', icon: <ScanLine size={16} /> },
  { id: 'dashboard', label: 'Панель системы', icon: <LayoutDashboard size={16} /> },
];

export const TopBar: React.FC<Props> = ({ route, onChange }) => {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/55 border-b border-white/60">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-glow">
            <Fingerprint size={18} className="text-white" />
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/40 pointer-events-none" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-[15px] text-ink-900">KeystrokeID</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500">behavioral biometrics · ВКР</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-white/60 border border-white/60 shadow-soft">
          {ITEMS.map((it) => {
            const active = it.id === route;
            return (
              <button
                key={it.id}
                onClick={() => onChange(it.id)}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'text-white' : 'text-ink-700 hover:text-ink-900'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {it.icon}
                  {it.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <StatusPill tone="success" pulse>система · онлайн</StatusPill>
          <span className="hidden sm:inline-flex text-[11px] num text-ink-500 px-2 py-1 rounded-md bg-white/60 border border-white/60">
            v1.0 · demo
          </span>
        </div>
      </div>

      {/* Мобильная навигация */}
      <nav className="md:hidden px-5 pb-3 flex items-center gap-1">
        {ITEMS.map((it) => {
          const active = it.id === route;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? 'bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow'
                  : 'bg-white/60 border border-white/60 text-ink-700'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">{it.icon}{it.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
