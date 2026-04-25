import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  ReferenceLine
} from 'recharts';
import { UserTemplate, KeystrokeFeatures } from '../types';

interface Props {
  template: UserTemplate;
  currentAttempt?: KeystrokeFeatures;
}

export const BiometricVisualizer: React.FC<Props> = ({ template, currentAttempt }) => {
  const [flightViewMode, setFlightViewMode] = useState<'top' | 'phrase'>('top');
  const getStatusByZ = (z: number | null) => {
    if (z === null) return 'no-data';
    if (Math.abs(z) <= 1.5) return 'normal';
    if (Math.abs(z) <= 2.5) return 'borderline';
    return 'risk';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return '#22c55e';
      case 'borderline':
        return '#f59e0b';
      case 'risk':
        return '#ef4444';
      default:
        return '#a78bfa';
    }
  };

  const normalizeDigraphKey = (key: string) =>
    key.replace(/Key/g, '').replace('->', '→');

  // Подробные данные по dwell со статусом и диапазоном нормы
  const dwellData = Object.keys(template.means.dwell).map(key => {
    const mean = template.means.dwell[key];
    const dev = template.deviations.dwell[key] || 0;
    const hasCurrent = !!currentAttempt;
    const current = hasCurrent ? (currentAttempt?.dwellTimes[key] ?? null) : null;
    const z = current !== null && dev > 0 ? (current - mean) / dev : null;
    const status = getStatusByZ(z);

    return {
      key,
      mean: Math.round(mean),
      dev: Math.round(dev),
      lower: Math.max(0, Math.round(mean - dev)),
      upper: Math.round(mean + dev),
      current: current !== null ? Math.round(current) : null,
      delta: current !== null ? Math.round(current - mean) : null,
      z,
      status,
      statusColor: getStatusColor(status)
    };
  });

  // Подробные данные по flight: сортируем по наибольшему отклонению
  const flightRaw = Object.keys(template.means.flight).map(key => {
    const mean = template.means.flight[key];
    const dev = template.deviations.flight[key] || 0;
    const current = currentAttempt ? (currentAttempt.flightTimes[key] ?? null) : null;
    const z = current !== null && dev > 0 ? (current - mean) / dev : null;
    const status = getStatusByZ(z);

    return {
      rawKey: key,
      key: normalizeDigraphKey(key),
      mean: Math.round(mean),
      dev: Math.round(dev),
      lower: Math.max(0, Math.round(mean - dev)),
      upper: Math.round(mean + dev),
      current: current !== null ? Math.round(current) : null,
      delta: current !== null ? Math.round(current - mean) : null,
      z,
      absZ: z !== null ? Math.abs(z) : -1,
      status,
      statusColor: getStatusColor(status)
    };
  });

  const flightData = useMemo(() => {
    if (flightViewMode === 'phrase') {
      return flightRaw.slice(0, 12);
    }
    return [...flightRaw]
      .sort((a, b) => b.absZ - a.absZ)
      .slice(0, 12);
  }, [flightRaw, flightViewMode]);

  const combinedZ = [...dwellData, ...flightRaw]
    .map(item => item.z)
    .filter((value): value is number => value !== null);

  const inNormCount = combinedZ.filter(z => Math.abs(z) <= 2).length;
  const inNormPercent = combinedZ.length ? Math.round((inNormCount / combinedZ.length) * 100) : 0;
  const avgAbsZ = combinedZ.length
    ? (combinedZ.reduce((sum, z) => sum + Math.abs(z), 0) / combinedZ.length).toFixed(2)
    : '0.00';
  const maxAbsZ = combinedZ.length
    ? Math.max(...combinedZ.map(z => Math.abs(z))).toFixed(2)
    : '0.00';
  const riskCount = combinedZ.filter(z => Math.abs(z) > 2.5).length;

  return (
    <div className="space-y-8">
      {currentAttempt && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
            Сводка текущей попытки
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Признаки в норме (|z| ≤ 2)</div>
              <div className="text-xl font-semibold text-gray-800">{inNormPercent}%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Среднее |z|-отклонение</div>
              <div className="text-xl font-semibold text-gray-800">{avgAbsZ}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Максимальное |z|-отклонение</div>
              <div className="text-xl font-semibold text-gray-800">{maxAbsZ}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Рисковые признаки (|z| {'>'} 2.5)</div>
              <div className="text-xl font-semibold text-gray-800">{riskCount}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
          Динамика удержания клавиш (Dwell Time)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Эталон (синий), текущая попытка (цвет по статусу), диапазон нормы mean ± std.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dwellData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{fontSize: 12}} />
              <YAxis unit="ms" tick={{fontSize: 12}} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number | string, name: string, props) => {
                  const payload = props?.payload;
                  if (!payload) return [value, name];
                  if (name === 'Текущий ввод (мс)') {
                    const z = payload.z !== null ? payload.z.toFixed(2) : 'n/a';
                    const delta = payload.delta !== null ? `${payload.delta > 0 ? '+' : ''}${payload.delta} ms` : 'n/a';
                    return [`${value} (Δ ${delta}, z=${z})`, name];
                  }
                  if (name === 'Нижняя граница') return [payload.lower, 'Нижняя граница'];
                  if (name === 'Верхняя граница') return [payload.upper, 'Верхняя граница'];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar name="Эталон (мс)" dataKey="mean" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar name="Нижняя граница" dataKey="lower" fill="#dbeafe" stackId="range" />
              <Bar name="Верхняя граница" dataKey="dev" fill="#bfdbfe" stackId="range" />
              {currentAttempt && (
                <Bar name="Текущий ввод (мс)" dataKey="current" radius={[4, 4, 0, 0]}>
                  {dwellData.map(item => (
                    <Cell key={`dwell-cell-${item.key}`} fill={item.statusColor} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500"></span>в норме</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500"></span>погранично</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500"></span>риск</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
           <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
           Ритм набора (Flight Time / Digraphs)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Режим визуализации переключается: самые отклоняющиеся диграфы или исходный порядок.
        </p>
        <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setFlightViewMode('top')}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              flightViewMode === 'top'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Топ по отклонению
          </button>
          <button
            type="button"
            onClick={() => setFlightViewMode('phrase')}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              flightViewMode === 'phrase'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Исходный порядок
          </button>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={flightData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" height={56} />
              <YAxis unit="ms" tick={{fontSize: 12}} />
              <Tooltip
                 contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                 formatter={(value: number | string, name: string, props) => {
                   const payload = props?.payload;
                   if (!payload) return [value, name];
                   if (name === 'Текущий ритм') {
                     const z = payload.z !== null ? payload.z.toFixed(2) : 'n/a';
                     const delta = payload.delta !== null ? `${payload.delta > 0 ? '+' : ''}${payload.delta} ms` : 'n/a';
                     return [`${value} (Δ ${delta}, z=${z})`, name];
                   }
                   return [value, name];
                 }}
              />
              <Legend />
              <Line type="monotone" name="Эталонный ритм" dataKey="mean" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
              {currentAttempt && (
                <Line type="monotone" name="Текущий ритм" dataKey="current" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {currentAttempt && (
          <div className="h-56 w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flightData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="key" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number | string) => [`${Number(value).toFixed(2)}`, '|z|-отклонение']}
                />
                <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="4 4" />
                <ReferenceLine y={3} stroke="#ef4444" strokeDasharray="4 4" />
                <Bar dataKey="absZ" name="|z|-отклонение">
                  {flightData.map(item => (
                    <Cell key={`flight-z-cell-${item.rawKey}`} fill={item.statusColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
