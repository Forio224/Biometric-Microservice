import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { TopBar, type RouteId } from './components/TopBar';
import { AuthPage } from './pages/AuthPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { DashboardPage } from './pages/DashboardPage';
import { ToastProvider } from './ui/Toast';

const App: React.FC = () => {
  const [route, setRoute] = useState<RouteId>('auth');

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <TopBar route={route} onChange={setRoute} />

        <main className="flex-1 max-w-[1280px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {route === 'auth' && <AuthPage />}
              {route === 'analysis' && <AnalysisPage />}
              {route === 'dashboard' && <DashboardPage />}
            </motion.div>
          </AnimatePresence>
        </main>

        <Footer />
      </div>
    </ToastProvider>
  );
};

const Footer: React.FC = () => (
  <footer className="mt-auto border-t border-white/60 bg-white/40 backdrop-blur-md">
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-ink-600">
      <div>
        <div className="font-display font-semibold text-ink-900 mb-1">KeystrokeID</div>
        <p className="leading-relaxed">
          Прототип системы биометрической аутентификации на основе клавиатурного почерка.
          Демонстрационный интерфейс для выпускной квалификационной работы.
        </p>
      </div>
      <div>
        <div className="font-display font-semibold text-ink-900 mb-1">Стек</div>
        <p className="leading-relaxed">
          React 19 · TypeScript · Vite · TailwindCSS · Framer Motion · Recharts.
          Модель верификации: Gaussian Mixture Model (GMM) на признаках dwell / flight.
        </p>
      </div>
      <div className="md:text-right">
        <div className="font-display font-semibold text-ink-900 mb-1">Год</div>
        <p className="num text-[18px] text-ink-900 font-semibold">2026</p>
        <p>«Клавиатурный почерк — уникальная поведенческая характеристика».</p>
      </div>
    </div>
    <div className="border-t border-white/60">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-3 text-[11px] uppercase tracking-[0.22em] text-ink-500 text-center">
        Выпускная квалификационная работа · прототип программного комплекса · {new Date().getFullYear()}
      </div>
    </div>
  </footer>
);

export default App;
