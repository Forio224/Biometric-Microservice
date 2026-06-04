import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, ShieldCheck, ShieldAlert, ArrowRight, UserPlus, KeyRound,
  CheckCircle2, Plus, RefreshCcw,
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
import { useToast } from '../ui/Toast';
import { useAppState } from '../AppContext';
import { validateFeatures } from '../utils/biometrics';
import type { KeystrokeFeatures, VerificationResponse } from '../types';

const PHRASE = 'Съешь же ещё этих мягких французских булок, да выпей чаю.';
const REQUIRED_SAMPLES = 10;
const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

type Mode = 'verify' | 'register';

interface AnalysisStateBase {
  stage: 'idle' | 'collecting' | 'extracting' | 'matching' | 'verifying' | 'done';
  progress: number;
}

const PIPELINE: { key: AnalysisStateBase['stage']; label: string }[] = [
  { key: 'collecting', label: 'Сбор клавиатурных событий' },
  { key: 'extracting', label: 'Извлечение признаков (dwell / flight)' },
  { key: 'matching',   label: 'Запрос к серверу · GMM сопоставление' },
  { key: 'verifying',  label: 'Принятие решения по порогу' },
];

export const AuthPage: React.FC = () => {
  const { online, registerUser, verifyUser, refreshTemplate } = useAppState();
  const { push } = useToast();

  const [mode, setMode] = useState<Mode>('verify');
  const [username, setUsername] = useState('');
  const [phrase, setPhrase] = useState('');
  const [pulseKey, setPulseKey] = useState(0);
  const { events, reset, onKeyDown, onKeyUp, computeFeatures, liveStats } = useKeystrokeCapture();

  const [busy, setBusy] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<AnalysisStateBase['stage']>('idle');
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [verifyResult, setVerifyResult] = useState<(VerificationResponse & { source: 'api' | 'mock' }) | null>(null);

  // Registration: накопление samples
  const [collectedSamples, setCollectedSamples] = useState<KeystrokeFeatures[]>([]);
  const [registerDone, setRegisterDone] = useState<{ user_id: string; source: 'api' | 'mock' } | null>(null);

  const stats = liveStats();
  const charsTyped = stats.charsTyped;

  useEffect(() => {
    if (verifyResult) {
      push({
        tone: verifyResult.success ? 'success' : 'error',
        title: verifyResult.success ? 'Доступ разрешён' : 'Доступ отклонён',
        description: `score ${verifyResult.score.toFixed(2)} · порог ${verifyResult.threshold.toFixed(2)} · ${verifyResult.method ?? '—'}`,
      });
    }
  }, [verifyResult, push]);

  const usernameError = useMemo(() => {
    if (!username) return null;
    if (username.length < 3) return 'Минимум 3 символа';
    if (username.length > 64) return 'Максимум 64 символа';
    if (!USERNAME_RE.test(username)) return 'Допустимы только латиница, цифры, _ . -';
    return null;
  }, [username]);

  const resetAll = () => {
    reset();
    setPhrase('');
    setVerifyResult(null);
    setRegisterDone(null);
    setCollectedSamples([]);
    setPipelineStage('idle');
    setPipelineProgress(0);
  };

  const startPipelineAnimation = async () => {
    const total = PIPELINE.length;
    for (let i = 0; i < total; i++) {
      setPipelineStage(PIPELINE[i].key);
      setPipelineProgress(Math.round(((i + 0.4) / total) * 100));
      await sleep(300 + Math.random() * 250);
    }
  };

  const submitVerify = async () => {
    if (busy) return;
    if (usernameError || !username) {
      push({ tone: 'warning', title: 'Проверьте логин', description: usernameError ?? 'Введите логин' });
      return;
    }
    if (!phrase.trim()) {
      push({ tone: 'warning', title: 'Введите контрольную фразу', description: 'Поле фразы пустое' });
      return;
    }
    const minLen = Math.floor(PHRASE.length * 0.8);
    if (phrase.length < minLen) {
      push({ tone: 'warning', title: 'Фраза слишком короткая', description: `Минимум ${minLen} символов, введено ${phrase.length}` });
      return;
    }
    const features = computeFeatures();
    const validationError = validateFeatures(features, PHRASE.length, 'auth');
    if (validationError) {
      push({ tone: 'warning', title: 'Ввод не принят', description: validationError });
      return;
    }

    setBusy(true);
    setVerifyResult(null);
    try {
      const animPromise = startPipelineAnimation();
      const apiPromise = verifyUser(username, features);
      const [, result] = await Promise.all([animPromise, apiPromise]);
      setPipelineStage('done');
      setPipelineProgress(100);
      setVerifyResult(result);
    } catch (e) {
      const msg = (e as Error).message || 'Ошибка верификации';
      push({ tone: 'error', title: 'Ошибка', description: msg });
      setPipelineStage('idle');
      setPipelineProgress(0);
    } finally {
      setBusy(false);
    }
  };

  const captureCurrentSample = () => {
    if (busy) return;
    if (!phrase.trim()) {
      push({ tone: 'warning', title: 'Введите фразу', description: 'Поле пустое' });
      return;
    }
    const minLen = Math.floor(PHRASE.length * 0.8);
    if (phrase.length < minLen) {
      push({ tone: 'warning', title: 'Фраза слишком короткая', description: `Минимум ${minLen} символов, введено ${phrase.length}` });
      return;
    }
    const features = computeFeatures();
    const validationError = validateFeatures(features, PHRASE.length, 'registration');
    if (validationError) {
      push({ tone: 'warning', title: 'Образец не принят', description: validationError });
      return;
    }
    setCollectedSamples((prev) => [...prev, features]);
    setPhrase('');
    reset();
    push({ tone: 'success', title: `Образец #${collectedSamples.length + 1} принят`, description: `${features.typedChars ?? 0} символов · ${Math.round(features.totalDuration)} мс` });
  };

  const submitRegister = async () => {
    if (busy) return;
    if (usernameError || !username) {
      push({ tone: 'warning', title: 'Проверьте логин', description: usernameError ?? 'Введите логин' });
      return;
    }
    if (collectedSamples.length < REQUIRED_SAMPLES) {
      push({ tone: 'warning', title: 'Недостаточно образцов', description: `Нужно минимум ${REQUIRED_SAMPLES}, у вас ${collectedSamples.length}` });
      return;
    }
    setBusy(true);
    try {
      await startPipelineAnimation();
      const res = await registerUser(username, collectedSamples);
      setPipelineStage('done');
      setPipelineProgress(100);
      setRegisterDone({ user_id: res.user_id, source: res.source });
      push({
        tone: 'success',
        title: 'Пользователь зарегистрирован',
        description: `${res.message} · id: ${res.user_id.slice(0, 12)}…`,
      });
      // подгрузим шаблон, чтобы графики анализа использовали реальные данные
      refreshTemplate(username).catch(() => {});
    } catch (e) {
      const msg = (e as Error).message || 'Ошибка регистрации';
      push({ tone: 'error', title: 'Ошибка', description: msg });
      setPipelineStage('idle');
      setPipelineProgress(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={`01 · ${mode === 'verify' ? 'аутентификация' : 'регистрация'}`}
        title={mode === 'verify' ? 'Биометрический вход по клавиатурному почерку' : 'Регистрация эталонного шаблона'}
        description={
          mode === 'verify'
            ? 'Введите контрольную фразу естественным темпом. Система передаёт вектор признаков на FastAPI и сравнивает его с эталоном GMM.'
            : `Введите контрольную фразу естественным темпом ${REQUIRED_SAMPLES} раз. Каждый «чистый» образец будет добавлен к будущему эталону пользователя.`
        }
        right={
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill tone={online ? 'success' : 'warning'} pulse>
              {online ? 'API · online' : 'API · локальный режим'}
            </StatusPill>
            <div className="text-[11px] text-ink-500 num">порог принятия 72%</div>
          </div>
        }
      />

      {/* mode tabs */}
      <div className="inline-flex p-1 rounded-xl bg-white/60 border border-white/60 shadow-soft">
        {(['verify', 'register'] as const).map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              onClick={() => { if (!busy) { setMode(m); resetAll(); } }}
              aria-pressed={active}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 ${
                active ? 'text-white' : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="auth-mode-active"
                  className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {m === 'verify' ? <ShieldCheck size={14} /> : <UserPlus size={14} />}
                {m === 'verify' ? 'Верификация' : 'Регистрация'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <GlassCard ring strong className="lg:col-span-3 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 grid place-items-center">
              {mode === 'verify' ? <ShieldCheck size={18} className="text-brand-600" /> : <UserPlus size={18} className="text-brand-600" />}
            </div>
            <div>
              <div className="font-display font-semibold text-ink-900 text-[17px]">
                {mode === 'verify' ? 'Контрольный ввод' : 'Сбор эталонных образцов'}
              </div>
              <div className="text-xs text-ink-500">
                {mode === 'verify'
                  ? 'POST /verify · GMM сопоставление с эталоном'
                  : `POST /register · необходимо ${REQUIRED_SAMPLES} образцов`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Логин пользователя"
              placeholder="например, a.ivanov"
              icon={<User size={16} />}
              value={username}
              onChange={setUsername}
              disabled={busy || (mode === 'register' && collectedSamples.length > 0)}
              autoComplete="off"
              spellCheck={false}
              error={usernameError ?? undefined}
              hint={!usernameError ? 'Латиница, цифры, _ . — длина 3–64' : undefined}
            />
            <Input
              label="Алгоритм"
              icon={<KeyRound size={16} />}
              value={online ? 'GMM · сервер · 12 признаков' : 'Локальный режим'}
              readOnly
              hint={online ? `endpoint ${mode === 'verify' ? '/verify' : '/register'}` : 'Локальный режим — данные не сохраняются в БД'}
            />
          </div>

          <div className="mt-5">
            <label htmlFor="control-phrase" className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 mb-1.5">
              Контрольная фраза {mode === 'register' && (
                <span className="text-brand-600 normal-case tracking-normal font-medium">
                  · образец {Math.min(collectedSamples.length + 1, REQUIRED_SAMPLES)} из {REQUIRED_SAMPLES}
                </span>
              )}
            </label>
            <div className="relative">
              <textarea
                id="control-phrase"
                rows={3}
                value={phrase}
                disabled={busy || !!registerDone}
                onPaste={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (mode === 'verify') submitVerify();
                    else captureCurrentSample();
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
              {phrase.length > 0 && PHRASE.startsWith(phrase) && (
                <div className="pointer-events-none absolute inset-0 px-4 py-3 text-[15px] whitespace-pre-wrap leading-[1.5]">
                  <span className="text-transparent">{phrase}</span>
                  <span className="text-ink-300">{PHRASE.slice(phrase.length)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-ink-500 mt-2">
              {mode === 'verify'
                ? 'Печатайте в естественном темпе. Enter — отправить на сервер.'
                : 'Enter — принять текущий образец и подготовить поле к следующему вводу.'}
            </p>
          </div>

          {/* Live capture progress */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="События" value={events.length} suffix="" />
            <Stat label="Символов" value={charsTyped} suffix="" />
            <Stat label="Длительность" value={Math.round(stats.totalMs)} suffix="мс" />
          </div>

          <div className="mt-6">
            <ProgressBar
              value={Math.min(100, Math.round((charsTyped / Math.max(1, PHRASE.length)) * 100))}
              shimmer
              tone="brand"
            />
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 mt-1.5">
              заполнение шаблона
            </div>
          </div>

          {mode === 'register' && (
            <SamplesStrip count={collectedSamples.length} required={REQUIRED_SAMPLES} />
          )}

          <div className="mt-7 flex items-center justify-end gap-2 flex-wrap">
            <AnimatedButton variant="ghost" onClick={resetAll} disabled={busy}>
              <RefreshCcw size={14} /> Сбросить
            </AnimatedButton>
            {mode === 'verify' ? (
              <AnimatedButton onClick={submitVerify} loading={busy} icon={<ArrowRight size={16} />}>
                Войти
              </AnimatedButton>
            ) : (
              <>
                <AnimatedButton variant="secondary" onClick={captureCurrentSample} disabled={busy || !!registerDone} icon={<Plus size={16} />}>
                  Принять образец
                </AnimatedButton>
                <AnimatedButton
                  onClick={submitRegister}
                  loading={busy}
                  disabled={collectedSamples.length < REQUIRED_SAMPLES || !!registerDone}
                  icon={<UserPlus size={16} />}
                >
                  Зарегистрировать
                </AnimatedButton>
              </>
            )}
          </div>
        </GlassCard>

        {/* RIGHT: capture viz */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Захват биометрии</div>
              <StatusPill tone={busy ? 'info' : phrase.length > 0 ? 'success' : 'neutral'} pulse>
                {busy ? 'analyzing' : phrase.length > 0 ? 'live capture' : 'standby'}
              </StatusPill>
            </div>
            <BiometricCapture
              charsTyped={charsTyped}
              expected={PHRASE.length}
              active={phrase.length > 0 || busy}
              pulseKey={pulseKey}
            />
          </GlassCard>

          <GlassCard className="p-5">
            {mode === 'verify' ? (
              <VerifyResultBlock
                busy={busy}
                stage={pipelineStage}
                progress={pipelineProgress}
                result={verifyResult}
                onTryAgain={resetAll}
              />
            ) : (
              <RegisterResultBlock
                busy={busy}
                stage={pipelineStage}
                progress={pipelineProgress}
                done={registerDone}
                samplesCount={collectedSamples.length}
                onReset={resetAll}
              />
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

// ───────── helpers ─────────

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const Stat: React.FC<{ label: string; value: number; suffix: string }> = ({ label, value, suffix }) => (
  <div className="rounded-xl border border-white/70 bg-white/55 px-3 py-2">
    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
    <div className="num text-[18px] font-semibold text-ink-900 leading-tight">
      {value}
      <span className="text-[11px] text-ink-500 ml-0.5 font-normal">{suffix}</span>
    </div>
  </div>
);

const SamplesStrip: React.FC<{ count: number; required: number }> = ({ count, required }) => (
  <div className="mt-5 rounded-xl border border-white/70 bg-white/55 px-3 py-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 font-semibold">Принятые образцы</div>
      <div className="num text-xs text-ink-700">{count} / {required}</div>
    </div>
    <div className="flex items-center gap-1.5">
      {Array.from({ length: required }).map((_, i) => {
        const taken = i < count;
        return (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full transition-colors ${
              taken ? 'bg-gradient-to-r from-brand-500 to-accent-500' : 'bg-ink-200/60'
            }`}
          />
        );
      })}
    </div>
  </div>
);

interface PipelineProps {
  busy: boolean;
  stage: AnalysisStateBase['stage'];
  progress: number;
}

const PipelineList: React.FC<PipelineProps> = ({ stage, progress }) => {
  const order = PIPELINE.map((s) => s.key);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Loader label={PIPELINE.find((p) => p.key === stage)?.label ?? 'Анализ поведения…'} />
        <span className="num text-sm text-ink-700">{progress}%</span>
      </div>
      <ProgressBar value={progress} shimmer />
      <ul className="space-y-1.5 mt-3">
        {PIPELINE.map((p) => {
          const reached = order.indexOf(stage) >= order.indexOf(p.key);
          return (
            <li key={p.key} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${reached ? 'bg-brand-500' : 'bg-ink-200'}`} />
              <span className={reached ? 'text-ink-800 font-medium' : 'text-ink-500'}>{p.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const VerifyResultBlock: React.FC<{
  busy: boolean;
  stage: AnalysisStateBase['stage'];
  progress: number;
  result: (VerificationResponse & { source: 'api' | 'mock' }) | null;
  onTryAgain: () => void;
}> = ({ busy, stage, progress, result, onTryAgain }) => {
  if (busy) return <PipelineList busy={busy} stage={stage} progress={progress} />;

  if (result) {
    const matchPct = Math.round(Math.max(0, Math.min(1, normaliseScore(result.score, result.threshold))) * 100);
    const thresholdPct = Math.round(Math.max(0, Math.min(1, normaliseScore(result.threshold, result.threshold))) * 100);
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
              <div className="text-xs text-ink-600">{result.details}</div>
            </div>
            <StatusPill tone={result.source === 'api' ? 'info' : 'warning'}>
              {result.source === 'api' ? result.method ?? 'GMM' : 'локально'}
            </StatusPill>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-500 mb-1">
              <span>совпадение шаблона</span>
              <span className="num text-ink-800 normal-case tracking-normal">
                score {result.score.toFixed(2)} · порог {result.threshold.toFixed(2)}
              </span>
            </div>
            <ProgressBar value={matchPct} tone={result.success ? 'success' : 'danger'} hideLabel />
            <div className="relative mt-1 h-3">
              <span className="absolute -top-2 text-[10px] text-ink-500 num" style={{ left: `${thresholdPct}%`, transform: 'translateX(-50%)' }}>
                ▲ порог
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <AnimatedButton variant="secondary" onClick={onTryAgain}>
              Попробовать снова
            </AnimatedButton>
            <span className="text-[11px] text-ink-500">
              {result.source === 'api'
                ? 'Ответ получен от FastAPI · сохранён в локальной истории'
                : 'Локальный режим: данные не сохраняются в БД'}
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
        Кнопка <span className="font-semibold text-ink-800">«Войти»</span> отправит вектор признаков на <span className="num">/verify</span>.
      </p>
    </div>
  );
};

const RegisterResultBlock: React.FC<{
  busy: boolean;
  stage: AnalysisStateBase['stage'];
  progress: number;
  done: { user_id: string; source: 'api' | 'mock' } | null;
  samplesCount: number;
  onReset: () => void;
}> = ({ busy, stage, progress, done, samplesCount, onReset }) => {
  if (busy) return <PipelineList busy={busy} stage={stage} progress={progress} />;

  if (done) {
    return (
      <div>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl grid place-items-center bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 size={22} />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-ink-900 text-[17px]">Эталон создан</div>
            <div className="text-xs text-ink-600">
              user_id <span className="num">{done.user_id.slice(0, 16)}…</span>
            </div>
          </div>
          <StatusPill tone={done.source === 'api' ? 'success' : 'warning'}>
            {done.source === 'api' ? 'API' : 'локально'}
          </StatusPill>
        </div>
        <p className="text-xs text-ink-500 mt-3">
          Шаблон сохранён в PostgreSQL (через FastAPI). Теперь можно перейти к верификации этим логином.
        </p>
        <div className="mt-3">
          <AnimatedButton variant="secondary" onClick={onReset}>Зарегистрировать ещё</AnimatedButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-1">Сбор образцов</div>
      <div className="font-display text-ink-900 font-semibold">
        {samplesCount === 0
          ? 'Введите контрольную фразу первый раз'
          : samplesCount < REQUIRED_SAMPLES
            ? `Ещё ${REQUIRED_SAMPLES - samplesCount} образцов до регистрации`
            : `Готово к отправке: ${samplesCount} образцов`}
      </div>
      <p className="text-xs text-ink-500 mt-1">
        После сбора образцов нажмите <span className="font-semibold text-ink-800">«Зарегистрировать»</span>,
        чтобы отправить их на <span className="num">/register</span>.
      </p>
    </div>
  );
};

/** Превращаем score в [0..1] для прогресс-бара. На бэке log-likelihood может быть отрицательным. */
const normaliseScore = (score: number, threshold: number): number => {
  if (score >= 0 && score <= 1 && threshold >= 0 && threshold <= 1) return score;
  // log-likelihood: чем ближе к 0 / положительнее — тем лучше; нормализуем относительно порога
  const span = Math.max(1, Math.abs(threshold) * 1.5);
  const norm = 0.72 + (score - threshold) / span * 0.4;
  return Math.max(0, Math.min(1, norm));
};
