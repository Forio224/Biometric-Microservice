import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';

import { TopBar, type RouteId } from './components/TopBar';
import { AuthPage } from './pages/AuthPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { DashboardPage } from './pages/DashboardPage';
import { ToastProvider } from './ui/Toast';
import { AppProvider, useAppState } from './AppContext';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
};

const Shell: React.FC = () => {
  const [route, setRoute] = useState<RouteId>('auth');
  const { online, ready, baseUrl, refresh } = useAppState();

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">Перейти к основному содержимому</a>
      <TopBar route={route} onChange={setRoute} />

      <AnimatePresence>
        {ready && !online && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className="bg-amber-50/80 border-y border-amber-200 backdrop-blur-md"
          >
            <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-2.5 flex items-center justify-between gap-3 text-amber-800 text-xs">
              <div className="flex items-center gap-2">
                <WifiOff size={14} />
                <span>
                  <b>Локальный режим</b> · программа работает локально, данные не будут сохранены в БД.
                </span>
              </div>
              <button
                onClick={refresh}
                className="num text-[11px] px-2 py-1 rounded-md border border-amber-300 bg-white/70 hover:bg-white transition-colors"
              >
                ↻ повторить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main" className="flex-1 max-w-[1280px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-10">
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
  );
};

const Footer: React.FC = () => (
  <footer className="mt-auto border-t backdrop-blur-md" style={{ backgroundColor: 'var(--footer-bg)', borderColor: 'var(--border-subtle)' }}>
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-ink-600">
      <div className="flex items-center gap-2.5">
        <div className="font-display font-semibold text-ink-900">KeystrokeID</div>
        <span className="text-ink-400">·</span>
        <span>Аутентификация по клавиатурному почерку</span>
      </div>
      <p className="text-ink-500">© {new Date().getFullYear()} KeystrokeID. Все права защищены.</p>
    </div>
  </footer>
);

export default App;
