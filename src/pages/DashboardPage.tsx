import React from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  ShieldCheck, ShieldAlert, Users, ServerCog, Cpu, Gauge, Activity,
  TimerReset, ArrowUpRight, ArrowDownRight, Lock,
} from 'lucide-react';

import { GlassCard } from '../ui/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../ui/StatusPill';
import { ProgressBar } from '../ui/ProgressBar';
import {
  MOCK_USERS, MOCK_ATTEMPTS, MOCK_METRICS, ACCURACY_TIMELINE, SCORE_DISTRIBUTION,
} from '../mock/data';

export const DashboardPage: React.FC = () => {
  const last24h = MOCK_ATTEMPTS;
  const successCount = last24h.filter((a) => a.status === 'success').length;
  const successRate = Math.round((successCount / last24h.length) * 100);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="03 · панель системы"
        title="Метрики и аналитика биометрической аутентификации"
        description="Состояние системы в реальном времени, ключевые метрики качества (FAR / FRR / Accuracy) и журнал последних попыток входа."
        right={
          <div className="flex items-center gap-2">
            <StatusPill tone="success" pulse>система · онлайн</StatusPill>
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
            <StatusPill tone="success" pulse>online</StatusPill>
          </div>

          <div className="space-y-3.5">
            <Meter label="Уровень доверия" value={92} tone="brand" />
            <Meter label="Загрузка ML-инференса" value={37} tone="warning" />
            <Meter label="Свободная память" value={68} tone="success" />
            <Meter label="Обработано запросов / сек" value={84} tone="brand" hint="нормировано к пиковой нагрузке" />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5 text-[11px]">
            <Box icon={<Cpu size={12} />} label="Модель" value="GMM · 4 mix" />
            <Box icon={<Lock size={12} />} label="Threshold" value={`${MOCK_METRICS.threshold.toFixed(2)}`} />
            <Box icon={<Users size={12} />} label="Пользователей" value={`${MOCK_USERS.length}`} />
            <Box icon={<ShieldCheck size={12} />} label="Заблокировано" value={`${MOCK_METRICS.blockedThreats}`} />
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
                <div className="text-xs text-ink-500">Accuracy / FAR / FRR за 6 недель</div>
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
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(31,74,224,0.15)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
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
        {/* Score distribution */}
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
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(31,74,224,0.15)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
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

        {/* Users */}
        <GlassCard ring className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/70 border border-white/70 grid place-items-center shadow-soft">
                <Users size={16} className="text-brand-600" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 text-[15px]">Активные пользователи</div>
                <div className="text-xs text-ink-500">{MOCK_USERS.length} зарегистрировано</div>
              </div>
            </div>
          </div>
          <ul className="space-y-2">
            {MOCK_USERS.map((u, i) => (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                className="rounded-xl border border-white/70 bg-white/60 px-3 py-2.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500/10 to-accent-500/10 border border-white/70 grid place-items-center text-[13px] font-semibold text-brand-700">
                  {u.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{u.fullName}</div>
                  <div className="text-[11px] text-ink-500 num truncate">@{u.username} · {u.role}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-[13px] font-semibold text-ink-900">{Math.round(u.trust * 100)}%</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-ink-500">trust</div>
                </div>
              </motion.li>
            ))}
          </ul>
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
              <div className="text-xs text-ink-500">{last24h.length} событий · {successRate}% успешных</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone="success">{successCount} успех</StatusPill>
            <StatusPill tone="danger">{last24h.length - successCount} отказ</StatusPill>
          </div>
        </div>
        <div className="overflow-x-auto -mx-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.18em] text-ink-500">
                <th className="text-left font-semibold py-2 px-3">id</th>
                <th className="text-left font-semibold py-2 px-3">Пользователь</th>
                <th className="text-left font-semibold py-2 px-3">Время</th>
                <th className="text-left font-semibold py-2 px-3">Устройство</th>
                <th className="text-left font-semibold py-2 px-3">IP</th>
                <th className="text-left font-semibold py-2 px-3">Score</th>
                <th className="text-left font-semibold py-2 px-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {last24h.map((a, i) => (
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
  <div className="rounded-lg border border-white/70 bg-white/60 px-2.5 py-2 flex items-center gap-2">
    <span className="text-ink-500">{icon}</span>
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
  // For metrics like FAR/FRR, lower is better — caller sends negative delta accordingly
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
