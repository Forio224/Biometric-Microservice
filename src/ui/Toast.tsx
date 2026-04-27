import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface Ctx {
  push: (t: Omit<ToastItem, 'id'>) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export const useToast = () => {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast must be inside <ToastProvider>');
  return c;
};

const iconFor = (t: Tone) => {
  switch (t) {
    case 'success': return <CheckCircle2 size={18} className="text-emerald-600" />;
    case 'error':   return <AlertTriangle size={18} className="text-rose-600" />;
    case 'warning': return <AlertTriangle size={18} className="text-amber-600" />;
    default:        return <Info size={18} className="text-brand-600" />;
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-[360px] max-w-[90vw]">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="glass glass-strong gradient-ring rounded-2xl p-3.5 flex items-start gap-3"
            >
              <div className="mt-0.5">{iconFor(t.tone)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900">{t.title}</div>
                {t.description && (
                  <div className="text-xs text-ink-600 mt-0.5">{t.description}</div>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-ink-400 hover:text-ink-700 p-1 -m-1 rounded-md transition-colors"
                aria-label="Закрыть"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
};
