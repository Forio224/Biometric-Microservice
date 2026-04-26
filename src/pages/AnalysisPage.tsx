import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Area, AreaChart, BarChart, Bar, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { ScanLine, Activity, Layers, Sparkles } from 'lucide-react';

import { GlassCard } from '../ui/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../ui/StatusPill';
import { KeyHeatmap } from '../components/KeyHeatmap';
import {
  REFERENCE_DWELL, REFERENCE_FLIGHT, buildHeatmap, KEYBOARD_ROWS,
} from '../mock/data';

// Генерация «текущего» ввода — отклонения вокруг эталона
const noisySeries = <T extends { reference: number }>(
  arr: T[],
  amplitude = 18,
  seed = 17
): (T & { current: number })[] => {
  let s = seed;
  return arr.map((it) => {
    s = (s * 9301 + 49297) % 233280;
    const r = (s / 233280) * 2 - 1;
    return { ...it, current: Math.max(20, Math.round(it.reference + r * amplitude)) };
  });
};

export const AnalysisPage: React.FC = () => {
  const [seed, setSeed] = useState(17);

  const dwellData = useMemo(
    () => noisySeries(REFERENCE_DWELL.slice(0, 12), 18, seed).map((d, i) => ({
      idx: i + 1,
      key: d.key,
      reference: d.reference,
      current: d.current,
    })),
    [seed]
  );

  const flightData = useMemo(
    () => noisySeries(REFERENCE_FLIGHT.slice(0, 12), 24, seed + 5).map((d, i) => ({
      idx: i + 1,
      pair: d.pair,
      reference: d.reference,
      current: d.current,
    })),
    [seed]
  );

  const heat = useMemo(() => buildHeatmap(0.21 + (seed % 50) / 100), [seed]);

  // Топ-5 расхождений для блока «выводы»
  const topDeviations = useMemo(() => {
    return [...dwellData]
      .map((d) => ({ label: `dwell · ${d.key}`, delta: d.current - d.reference }))
      .concat(flightData.map((f) => ({ label: `flight · ${f.pair}`, delta: f.current - f.reference })))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  }, [dwellData, flightData]);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="02 · анализ почерка"
        title="Извлечение признаков клавиатурного почерка"
        description="Сравнение dwell- и flight-времён эталонного шаблона с текущим вводом. Цветовая карта показывает «характерность» клавиш для пользователя."
        right={
          <div className="flex items-center gap-2">
            <StatusPill tone="info" icon={<ScanLine size={12} />}>recharts</StatusPill>
            <button
              onClick={() => setSeed((s) => s + 7)}
              className="text-[11px] num bg-white/80 border border-white/70 hover:bg-white px-2.5 py-1 rounded-md transition-colors"
            >
              ⟲ перегенерировать
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard ring className="p-6">
          <ChartHeader
            icon={<Activity size={16} className="text-brand-600" />}
            title="График 1 — dwell time"
            subtitle="время удержания клавиш (мс)"
          />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dwellData} margin={{ top: 8, right: 14, bottom: 4, left: -14 }}>
                <CartesianGrid stroke="rgba(31,74,224,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="key"
                  tick={{ fill: '#6b7a99', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(31,74,224,0.12)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7a99', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(31,74,224,0.15)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${v} мс`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="plainline"
                />
                <Line
                  type="monotone"
                  dataKey="reference"
                  name="Эталон"
                  stroke="#3266ff"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3266ff' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  name="Текущий ввод"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: '#22d3ee' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={1100}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard ring className="p-6">
          <ChartHeader
            icon={<Layers size={16} className="text-accent-600" />}
            title="График 2 — flight time"
            subtitle="задержки между нажатиями клавиш (мс)"
          />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flightData} margin={{ top: 8, right: 14, bottom: 4, left: -14 }}>
                <defs>
                  <linearGradient id="ref-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3266ff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3266ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cur-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(31,74,224,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="pair"
                  tick={{ fill: '#6b7a99', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(31,74,224,0.12)' }}
                  tickLine={false}
                  interval={0}
                  angle={-12}
                  height={40}
                />
                <YAxis
                  tick={{ fill: '#6b7a99', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(31,74,224,0.15)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${v} мс`}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="plainline" />
                <Area
                  type="monotone"
                  dataKey="reference"
                  name="Эталон"
                  stroke="#3266ff"
                  strokeWidth={2}
                  fill="url(#ref-grad)"
                  isAnimationActive
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="Текущий ввод"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  fill="url(#cur-grad)"
                  isAnimationActive
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard ring className="p-6 xl:col-span-1">
          <ChartHeader
            icon={<Sparkles size={16} className="text-brand-600" />}
            title="Heatmap клавиатуры"
            subtitle="«характерность» клавиш для текущего пользователя"
          />
          <KeyHeatmap values={heat} />
        </GlassCard>

        <GlassCard ring className="p-6 xl:col-span-1">
          <ChartHeader
            icon={<Activity size={16} className="text-accent-600" />}
            title="Топ-5 расхождений"
            subtitle="клавиши и пары с наибольшим отклонением от эталона"
          />
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDeviations} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="rgba(31,74,224,0.08)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7a99', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fill: '#475370', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(31,74,224,0.15)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${v} мс`}
                />
                <Bar
                  dataKey="delta"
                  fill="#3266ff"
                  radius={[6, 6, 6, 6]}
                  isAnimationActive
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            Положительные значения — клавиша задерживается дольше эталона; отрицательные — быстрее.
          </p>
        </GlassCard>
      </div>

      <GlassCard ring className="p-6">
        <ChartHeader
          icon={<Layers size={16} className="text-brand-600" />}
          title="Раскладка и распределение событий"
          subtitle="последовательность нажатий по строкам клавиатуры"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {KEYBOARD_ROWS.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="rounded-xl border border-white/70 bg-white/60 p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 mb-1">Ряд {i + 1}</div>
              <div className="font-mono text-[14px] text-ink-800 leading-relaxed">{row.join(' · ')}</div>
              <div className="text-[11px] text-ink-500 mt-2 num">
                {row.length} клавиш · {Math.round((row.length / 32) * 100)}% от QWERTY
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

const ChartHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="w-8 h-8 rounded-lg bg-white/80 border border-white/70 grid place-items-center shadow-soft">{icon}</div>
    <div>
      <div className="font-display font-semibold text-ink-900 text-[15px]">{title}</div>
      {subtitle && <div className="text-xs text-ink-500">{subtitle}</div>}
    </div>
  </div>
);
