import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  ShieldCheck, ShieldAlert, Users, ServerCog, Cpu, Gauge, Activity,
  TimerReset, ArrowUpRight, ArrowDownRight, Lock, RefreshCcw, Trash2,
} from 'lucide-react';

import { GlassCard } from '../ui/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../ui/StatusPill';
import { ProgressBar } from '../ui/ProgressBar';
import {
  MOCK_USERS, MOCK_METRICS, ACCURACY_TIMELINE, SCORE_DISTRIBUTION,
} from '../mock/data';
import { useAppState } from '../AppContext';

// Recharts tooltips use a light surface in both themes, so force dark, high-contrast text
// (otherwise the inherited dark-theme text colour is near-invisible on the white tooltip).
const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(31,74,224,0.18)',
  borderRadius: 12,
  fontSize: 12,
  color: '#0f1628',
  boxShadow: '0 10px 30px -10px rgba(15,22,40,0.45)',
} as const;
const TOOLTIP_LABEL = { color: '#0f1628', fontWeight: 600 } as const;
const TOOLTIP_ITEM = { color: '#1d2540' } as const;

export const DashboardPage: React.FC = () => {
  const { online, ready, baseUrl, refresh, users, history, lastSession, clearHistory } = useAppState();

  // Реальная история, если есть; иначе — fallback на демо-данные
  const useRealHistory = history.length > 0;
  const attempts = useMemo(
    () => useRealHistory
      ? history.slice(0, 12).map((h) => ({
          id: h.id,
          username: h.username,
          timestamp: h.timestamp,
          status: h.status === 'denied' ? 'denied' as const : h.status === 'success' ? 'success' as const : 'denied' as const,
          score: clampUnit(scoreToUnit(h.score, h.threshold)),
          device: h.method ?? '—',
          ip: h.source === 'api' ? 'api' : 'mock',
          reason: h.details,
        }))
      : MOCK_USERS && [
          { id: 'a-2041', username: 'a.ivanov',  timestamp: '2026-04-25T19:22:14Z', status: 'success' as const, score: 0.93, device: 'Lenovo T14', ip: '10.0.4.11', reason: 'demo' },
          { id: 'a-2040', username: 'a.ivanov',  timestamp: '2026-04-25T19:08:02Z', status: 'success' as const, score: 0.88, device: 'Lenovo T14', ip: '10.0.4.11' },
          { id: 'a-2039', username: 'm.petrova', timestamp: '2026-04-25T18:05:51Z', status: 'success' as const, score: 0.81, device: 'MacBook Air', ip: '10.0.4.34' },
          { id: 'a-2038', username: 'unknown',   timestamp: '2026-04-25T17:41:09Z', status: 'denied'  as const, score: 0.42, device: 'Tor browser', ip: '185.220.x.x', reason: 'demo' },
          { id: 'a-2037', username: 'k.smirnov', timestamp: '2026-04-25T16:33:27Z', status: 'success' as const, score: 0.79, device: 'Dell Latitude', ip: '10.0.4.7' },
        ],
    [useRealHistory, history]
  );

  const successCount = attempts.filter((a) => a.status === 'success').length;
  const successRate = attempts.length > 0 ? Math.round((successCount / attempts.length) * 100) : 0;

  // Уровень доверия рассчитывается по реальной истории верификаций пользователя:
  // среднее нормализованного score (насколько ритм совпадал с эталоном) и доля успешных
  // попыток. Если верификаций ещё не было — данных нет (null), показываем «—».
  const trustFor = (username: string): number | null => {
    const items = history.filter((h) => h.username === username);
    if (items.length === 0) return null;
    const avgScore = items.reduce((s, h) => s + clampUnit(scoreToUnit(h.score, h.threshold)), 0) / items.length;
    const successRate = items.filter((h) => h.status === 'success').length / items.length;
    return clampUnit(0.6 * avgScore + 0.4 * successRate);
  };

  const showMockUsers = users.length === 0;
  const userList = showMockUsers
    ? MOCK_USERS
    : users.map((u, i) => ({
        id: u.id,
        username: u.username,
        fullName: u.username.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        role: i === 0 ? 'Администратор' : 'Пользователь',
        trust: trustFor(u.username),
        registeredAt: u.created_at,
        lastLogin: u.created_at,
        samples: 5,
      }));

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="03 · панель системы"
        title="Метрики и аналитика биометрической аутентификации"
        description="Состояние системы в реальном времени, ключевые метрики качества (FAR / FRR / Accuracy) и журнал последних попыток входа."
        right={
          <div className="flex items-center gap-2 flex-wrap">
            {ready && (online
              ? <StatusPill tone="success" pulse>API · онлайн</StatusPill>
              : <StatusPill tone="warning" pulse>API · оффлайн</StatusPill>
            )}
            <button
              onClick={refresh}
              className="num text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/70 bg-white/70 hover:bg-white transition-colors"
            >
              <RefreshCcw size={11} /> health-check
            </button>
            <StatusPill tone="info" icon={<TimerReset size={12} />}>обновлено · только что</StatusPill>
          </div>
        }
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          icon={<Gauge size={16} className="text-brand-600" />}
          label="Accuracy"
          value={`${MOCK_METRICS.accuracy}%`}
          tone="info"
          delta={+0.2}
          spark={ACCURACY_TIMELINE.map((p) => p.accuracy)}
          hint="reference dataset"
        />
        <KpiTile
          icon={<ShieldAlert size={16} className="text-rose-600" />}
          label="FAR"
          value={`${MOCK_METRICS.far}%`}
          tone="danger"
          delta={-0.2}
          hint="False Acceptance Rate"
          spark={ACCURACY_TIMELINE.map((p) => p.far)}
        />
        <KpiTile
          icon={<ShieldCheck size={16} className="text-emerald-600" />}
          label="FRR"
          value={`${MOCK_METRICS.frr}%`}
          tone="success"
          delta={-0.1}
          hint="False Rejection Rate"
          spark={ACCURACY_TIMELINE.map((p) => p.frr)}
        />
        <KpiTile
          icon={<Activity size={16} className="text-accent-600" />}
          label="EER"
          value={`${MOCK_METRICS.eer}%`}
          tone="info"
          delta={-0.3}
          hint="Equal Error Rate"
          spark={[5.4, 4.6, 3.8, 3.1, 2.8, 2.5]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System status */}
        <GlassCard ring className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
                <ServerCog size={16} className="text-brand-600" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 text-[15px]">Состояние системы</div>
                <div className="text-xs text-ink-500">микросервис BioAuth · v1.0</div>
              </div>
            </div>
            <StatusPill tone={online ? 'success' : 'danger'} pulse>
              {online ? 'online' : 'offline'}
            </StatusPill>
          </div>

          <div className="space-y-3.5">
            <Meter label="Уровень доверия" value={online ? 92 : 0} tone="brand" />
            <Meter label="Загрузка ML-инференса" value={online ? 37 : 0} tone="warning" />
            <Meter label="Свободная память" value={online ? 68 : 0} tone="success" />
            <Meter label="Доступность API" value={online ? 100 : 0} tone={online ? 'brand' : 'danger'} hint={online ? `endpoint ${baseUrl || '(same-origin)'}/health` : 'health-check провалился'} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5 text-[11px]">
            <Box icon={<Cpu size={12} />} label="Модель" value="GMM · 4 mix" />
            <Box icon={<Lock size={12} />} label="Endpoint" value={baseUrl || 'same-origin'} />
            <Box icon={<Users size={12} />} label="Пользователей" value={`${users.length || MOCK_USERS.length}`} />
            <Box icon={<ShieldCheck size={12} />} label="Источник" value={online ? 'FastAPI' : 'локально'} />
          </div>
        </GlassCard>

        {/* Accuracy timeline */}
        <GlassCard ring className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
                <Activity size={16} className="text-brand-600" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 text-[15px]">Динамика качества</div>
                <div className="text-xs text-ink-500">Accuracy / FAR / FRR за 6 недель · reference dataset</div>
              </div>
            </div>
            <StatusPill tone="info">recharts</StatusPill>
          </div>

          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ACCURACY_TIMELINE} margin={{ top: 4, right: 14, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgba(31,74,224,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#6b7a99', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7a99', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL}
                  itemStyle={TOOLTIP_ITEM}
                  formatter={(v: number, n: string) => [`${v}%`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="plainline" />
                <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#3266ff" strokeWidth={2.4} dot={{ r: 3 }} animationDuration={900} />
                <Line type="monotone" dataKey="far" name="FAR" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="3 3" animationDuration={1100} />
                <Line type="monotone" dataKey="frr" name="FRR" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="3 3" animationDuration={1100} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard ring className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
                <Gauge size={16} className="text-accent-600" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 text-[15px]">Распределение score</div>
                <div className="text-xs text-ink-500">всего {MOCK_METRICS.totalAttempts} попыток · порог {MOCK_METRICS.threshold}</div>
              </div>
            </div>
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SCORE_DISTRIBUTION} margin={{ top: 4, right: 14, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgba(31,74,224,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bin" tick={{ fill: '#6b7a99', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7a99', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL}
                  itemStyle={TOOLTIP_ITEM}
                  formatter={(v: number) => [`${v} попыток`, '']}
                />
                <defs>
                  <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3266ff" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <Bar dataKey="count" fill="url(#bar-grad)" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard ring className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
                <Users size={16} className="text-brand-600" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 text-[15px]">Активные пользователи</div>
                <div className="text-xs text-ink-500">
                  {showMockUsers ? `${MOCK_USERS.length} пользователей (локальный режим)` : `${users.length} зарегистрировано в БД`}
                </div>
              </div>
            </div>
            <StatusPill tone={showMockUsers ? 'warning' : 'success'}>
              {showMockUsers ? 'локально' : 'API'}
            </StatusPill>
          </div>
          <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {userList.map((u, i) => (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                className="rounded-xl border border-white/70 bg-white/60 px-3 py-2.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500/10 to-accent-500/10 border border-white/70 grid place-items-center text-[13px] font-semibold text-brand-700">
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{('fullName' in u ? u.fullName : u.username) as string}</div>
                  <div className="text-[11px] text-ink-500 num truncate">@{u.username} · {('role' in u ? u.role : '—') as string}</div>
                </div>
                {(() => {
                  const trustVal = ('trust' in u ? u.trust : null) as number | null;
                  return (
                    <div className="text-right shrink-0" title={trustVal === null ? 'Недостаточно данных: пользователь ещё не проходил верификацию' : 'Средняя стабильность совпадения ритма по истории верификаций'}>
                      <div className="num text-[13px] font-semibold text-ink-900">
                        {trustVal === null ? '—' : `${Math.round(trustVal * 100)}%`}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-500">trust</div>
                    </div>
                  );
                })()}
              </motion.li>
            ))}
          </ul>
          {lastSession && (
            <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[11px]">
              <div className="text-ink-500 uppercase tracking-[0.18em] mb-0.5">Последняя сессия</div>
              <div className="num text-ink-800 font-semibold">
                @{lastSession.username} · score {lastSession.score.toFixed(2)} · {lastSession.success ? 'success' : 'denied'}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Attempts history */}
      <GlassCard ring className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
              <Activity size={16} className="text-brand-600" />
            </div>
            <div>
              <div className="font-display font-semibold text-ink-900 text-[15px]">История попыток</div>
              <div className="text-xs text-ink-500">
                {useRealHistory
                  ? `${attempts.length} событий · ${successRate}% успешных · localStorage`
                  : `${attempts.length} событий · ${successRate}% успешных`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone="success">{successCount} успех</StatusPill>
            <StatusPill tone="danger">{attempts.length - successCount} отказ</StatusPill>
            {useRealHistory && (
              <button
                onClick={clearHistory}
                className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <Trash2 size={11} /> очистить
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto -mx-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.18em] text-ink-500">
                <th scope="col" className="text-left font-semibold py-2 px-3">id</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Пользователь</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Время</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">{useRealHistory ? 'Метод' : 'Устройство'}</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">{useRealHistory ? 'Источник' : 'IP'}</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Score</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a, i) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.3 }}
                  className="border-t border-white/60 hover:bg-white/40 transition-colors"
                >
                  <td className="py-2.5 px-3 num text-ink-500">{a.id}</td>
                  <td className="py-2.5 px-3 font-medium text-ink-800">{a.username}</td>
                  <td className="py-2.5 px-3 num text-ink-600 whitespace-nowrap">
                    {new Date(a.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2.5 px-3 text-ink-700">{a.device}</td>
                  <td className="py-2.5 px-3 num text-ink-600">{a.ip}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <ProgressBar value={Math.round(a.score * 100)} hideLabel tone={a.status === 'success' ? 'success' : 'danger'} className="flex-1" />
                      <span className="num text-[12px] text-ink-700 w-9 text-right">{(a.score).toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusPill tone={a.status === 'success' ? 'success' : 'danger'}>
                      {a.status === 'success' ? 'allowed' : 'denied'}
                    </StatusPill>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

const Meter: React.FC<{ label: string; value: number; tone: 'brand' | 'success' | 'danger' | 'warning'; hint?: string }> = ({ label, value, tone, hint }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-ink-700">{label}</span>
      <span className="num text-[12px] font-semibold text-ink-800">{value}%</span>
    </div>
    <ProgressBar value={value} tone={tone} hideLabel />
    {hint && <div className="text-[11px] text-ink-500 mt-1">{hint}</div>}
  </div>
);

const Box: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-lg border border-white/70 bg-white/60 px-2.5 py-2 flex items-center gap-2 min-w-0">
    <span className="text-ink-500 shrink-0">{icon}</span>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 truncate">{label}</div>
      <div className="num text-[13px] text-ink-800 font-semibold truncate">{value}</div>
    </div>
  </div>
);

interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number;
  tone: 'info' | 'success' | 'danger';
  hint?: string;
  spark?: number[];
}

const kpiBg: Record<KpiProps['tone'], string> = {
  info: 'from-brand-500/10 to-accent-500/10',
  success: 'from-emerald-400/10 to-teal-400/10',
  danger: 'from-rose-500/10 to-orange-500/10',
};

const KpiTile: React.FC<KpiProps> = ({ icon, label, value, delta, tone, hint, spark }) => {
  const positive = delta >= 0;
  const goodDirection = (label === 'Accuracy') ? positive : !positive;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative glass gradient-ring p-4 overflow-hidden bg-gradient-to-br ${kpiBg[tone]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
            {icon}
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-500 font-semibold">{label}</span>
        </div>
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold num
                          ${goodDirection ? 'text-emerald-700' : 'text-rose-600'}`}>
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div className="num text-[28px] font-semibold text-ink-900 leading-tight mt-2">{value}</div>
      {hint && <div className="text-[11px] text-ink-500 mt-0.5">{hint}</div>}
      {spark && spark.length > 0 && (
        <div className="mt-3 -mx-1 h-9">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 0, right: 4, bottom: 0, left: 4 }}>
              <Line type="monotone" dataKey="v" stroke="#3266ff" strokeWidth={1.6} dot={false} isAnimationActive animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
};

const clampUnit = (v: number) => Math.max(0, Math.min(1, v));

const scoreToUnit = (score: number, threshold: number): number => {
  if (score >= 0 && score <= 1 && threshold >= 0 && threshold <= 1) return score;
  // log-likelihood случай: нормализуем относительно порога
  const span = Math.max(1, Math.abs(threshold) * 1.5);
  return 0.72 + (score - threshold) / span * 0.4;
};
