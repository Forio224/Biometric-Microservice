import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, KeyRound, ShieldCheck, ShieldAlert, ArrowRight, Activity,
} from 'lucide-react';

import { GlassCard } from '../ui/GlassCard';
import { Input } from '../ui/Input';
import { AnimatedButton } from '../ui/AnimatedButton';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusPill } from '../ui/StatusPill';
import { Loader } from '../ui/Loader';
import { BiometricCapture } from '../components/BiometricCapture';
import { SectionHeader } from '../components/SectionHeader';
import { useKeystrokeCapture } from '../hooks/useKeystrokeCapture';
import { useAnalysisSimulation } from '../hooks/useAnalysisSimulation';
import { useToast } from '../ui/Toast';

const PHRASE = 'Съешь же ещё этих мягких французских булок, да выпей чаю.';

export const AuthPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [phrase, setPhrase] = useState('');
  const [pulseKey, setPulseKey] = useState(0);
  const { events, reset, onKeyDown, onKeyUp, computeFeatures } = useKeystrokeCapture();
  const { stage, progress, result, start, reset: resetAnalysis } = useAnalysisSimulation();
  const { push } = useToast();

  const features = useMemo(() => computeFeatures(), [computeFeatures]);

  const isAnalyzing = stage !== 'idle' && stage !== 'done';

  useEffect(() => {
    if (result) {
      push({
        tone: result.success ? 'success' : 'error',
        title: result.success ? 'Доступ разрешён' : 'Доступ отклонён',
        description: `Совпадение: ${result.matchPercent}% · порог ${result.threshold}%`,
      });
    }
  }, [result, push]);

  const submit = () => {
    if (!username.trim() || !phrase.trim()) {
      push({ tone: 'warning', title: 'Заполните оба поля', description: 'Логин и контрольная фраза обязательны' });
      return;
    }
    start(username.trim(), phrase);
  };

  const tryAgain = () => {
    setPhrase('');
    reset();
    resetAnalysis();
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="01 · аутентификация"
        title="Биометрический вход по клавиатурному почерку"
        description="Введите контрольную фразу естественным темпом. Система анализирует время удержания клавиш и интервалы между нажатиями, сравнивая их с эталонным шаблоном."
        right={
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill tone="info" icon={<Activity size={12} />}>демо · mock-данные</StatusPill>
            <div className="text-[11px] text-ink-500 num">порог принятия 72%</div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: form */}
        <GlassCard ring strong className="lg:col-span-3 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 grid place-items-center">
              <ShieldCheck size={18} className="text-brand-600" />
            </div>
            <div>
              <div className="font-display font-semibold text-ink-900 text-[17px]">Контрольный ввод</div>
              <div className="text-xs text-ink-500">Анонимный режим — данные остаются на устройстве</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Логин пользователя"
              placeholder="a.ivanov"
              icon={<User size={16} />}
              value={username}
              onChange={setUsername}
              disabled={isAnalyzing}
              autoComplete="off"
              spellCheck={false}
            />
            <Input
              label="Эталонный профиль"
              placeholder="статистический · GMM"
              icon={<KeyRound size={16} />}
              value="GMM · ритм · 12 признаков"
              readOnly
              hint="Алгоритм сопоставления выбран автоматически"
            />
          </div>

          <div className="mt-5">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 mb-1.5">
              Контрольная фраза
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={phrase}
                disabled={isAnalyzing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                    return;
                  }
                  setPulseKey((p) => p + 1);
                  onKeyDown(e);
                }}
                onKeyUp={onKeyUp}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={PHRASE}
                className="w-full rounded-2xl bg-white/85 backdrop-blur border border-white/70 px-4 py-3 text-[15px]
                           focus:outline-none focus:border-brand-400 focus:shadow-glow transition-all resize-none"
              />
              {/* ghost text overlay */}
              {phrase.length > 0 && PHRASE.startsWith(phrase) && (
                <div className="pointer-events-none absolute inset-0 px-4 py-3 text-[15px] whitespace-pre-wrap leading-[1.5]">
                  <span className="text-transparent">{phrase}</span>
                  <span className="text-ink-300">{PHRASE.slice(phrase.length)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-ink-500 mt-2">
              Совет: печатайте в естественном темпе. Чем больше совпадает ритм, тем выше шанс верификации.
            </p>
          </div>

          {/* Live capture progress */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="События" value={events.length} suffix="" />
            <Stat label="Символов" value={features.charsTyped} suffix="" />
            <Stat label="Длительность" value={Math.round(features.totalMs)} suffix="мс" />
          </div>

          <div className="mt-7 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <ProgressBar
                value={Math.min(100, Math.round((features.charsTyped / Math.max(1, PHRASE.length)) * 100))}
                shimmer
                tone="brand"
              />
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 mt-1.5">
                заполнение шаблона
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AnimatedButton variant="ghost" onClick={tryAgain} disabled={isAnalyzing}>
                Сбросить
              </AnimatedButton>
              <AnimatedButton onClick={submit} loading={isAnalyzing} icon={<ArrowRight size={16} />}>
                Войти
              </AnimatedButton>
            </div>
          </div>
        </GlassCard>

        {/* RIGHT: capture viz */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Захват биометрии</div>
              <StatusPill tone={isAnalyzing ? 'info' : phrase.length > 0 ? 'success' : 'neutral'} pulse>
                {isAnalyzing ? 'analyzing' : phrase.length > 0 ? 'live capture' : 'standby'}
              </StatusPill>
            </div>
            <BiometricCapture
              charsTyped={features.charsTyped}
              expected={PHRASE.length}
              active={phrase.length > 0 || isAnalyzing}
              pulseKey={pulseKey}
            />
          </GlassCard>

          <GlassCard className="p-5">
            <AnalysisOrResult
              isAnalyzing={isAnalyzing}
              stage={stage}
              progress={progress}
              result={result}
              onTryAgain={tryAgain}
            />
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; suffix: string }> = ({ label, value, suffix }) => (
  <div className="rounded-xl border border-white/70 bg-white/55 px-3 py-2">
    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
    <div className="num text-[18px] font-semibold text-ink-900 leading-tight">
      {value}
      <span className="text-[11px] text-ink-500 ml-0.5 font-normal">{suffix}</span>
    </div>
  </div>
);

interface AnalysisOrResultProps {
  isAnalyzing: boolean;
  stage: string;
  progress: number;
  result: ReturnType<typeof useAnalysisSimulation>['result'];
  onTryAgain: () => void;
}

const AnalysisOrResult: React.FC<AnalysisOrResultProps> = ({
  isAnalyzing, stage, progress, result, onTryAgain,
}) => {
  if (isAnalyzing) {
    const labels: Record<string, string> = {
      collecting: 'Сбор клавиатурных событий…',
      extracting: 'Извлечение признаков (dwell / flight)…',
      matching:   'Сопоставление с эталоном GMM…',
      verifying:  'Принятие решения по порогу…',
    };
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Loader label={labels[stage] || 'Анализ поведения…'} />
          <span className="num text-sm text-ink-700">{progress}%</span>
        </div>
        <ProgressBar value={progress} shimmer />
        <ul className="space-y-1.5 mt-3">
          {Object.entries(labels).map(([k, v]) => {
            const order = ['collecting','extracting','matching','verifying'];
            const reached = order.indexOf(stage) >= order.indexOf(k);
            return (
              <li key={k} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${reached ? 'bg-brand-500' : 'bg-ink-200'}`} />
                <span className={reached ? 'text-ink-800 font-medium' : 'text-ink-400'}>{v}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (result) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={result.success ? 'ok' : 'fail'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-12 h-12 rounded-xl grid place-items-center ${
                result.success
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}
            >
              {result.success ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-ink-900 text-[17px]">
                {result.success ? 'Доступ разрешён' : 'Доступ отклонён'}
              </div>
              <div className="text-xs text-ink-600">{result.reason}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-500 mb-1">
              <span>совпадение шаблона</span>
              <span className="num text-ink-800 normal-case tracking-normal">
                {result.matchPercent}% / порог {result.threshold}%
              </span>
            </div>
            <ProgressBar value={result.matchPercent} tone={result.success ? 'success' : 'danger'} hideLabel />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniMetric label="FAR" value={`${result.far.toFixed(1)}%`} tone="info" />
            <MiniMetric label="FRR" value={`${result.frr.toFixed(1)}%`} tone="info" />
            <MiniMetric label="Score" value={`${(result.matchPercent / 100).toFixed(2)}`} tone={result.success ? 'success' : 'danger'} />
          </div>

          <div className="mt-5 flex items-center gap-2">
            <AnimatedButton variant="secondary" onClick={onTryAgain}>
              Попробовать снова
            </AnimatedButton>
            <span className="text-[11px] text-ink-500">
              Сценарий генерируется детерминированно от логина и фразы.
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="text-center py-6">
      <div className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-1">Готов к анализу</div>
      <div className="font-display text-ink-900 font-semibold">Введите логин и контрольную фразу</div>
      <p className="text-xs text-ink-500 mt-1">
        Кнопка <span className="font-semibold text-ink-800">«Войти»</span> запустит цепочку проверки.
      </p>
    </div>
  );
};

const miniTone: Record<'info' | 'success' | 'danger', string> = {
  info:    'border-brand-100 bg-brand-50 text-brand-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  danger:  'border-rose-100 bg-rose-50 text-rose-700',
};

const MiniMetric: React.FC<{ label: string; value: string; tone: 'info' | 'success' | 'danger' }> = ({ label, value, tone }) => (
  <div className={`rounded-xl border px-3 py-2 ${miniTone[tone]}`}>
    <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">{label}</div>
    <div className="num text-[16px] font-semibold leading-tight mt-0.5">{value}</div>
  </div>
);
