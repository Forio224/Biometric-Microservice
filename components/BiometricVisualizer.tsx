import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { UserTemplate, KeystrokeFeatures } from '../types';

interface Props {
  template: UserTemplate;
  currentAttempt?: KeystrokeFeatures;
}

export const BiometricVisualizer: React.FC<Props> = ({ template, currentAttempt }) => {
  // Подготовка данных для графика удержания (Dwell)
  const dwellData = Object.keys(template.means.dwell).map(key => ({
    key,
    mean: Math.round(template.means.dwell[key]),
    dev: Math.round(template.deviations.dwell[key]),
    current: currentAttempt ? Math.round(currentAttempt.dwellTimes[key] || 0) : null
  }));

  // Подготовка данных для графика полета (Flight)
  // Берем только первые 10 диграфов для чистоты графика
  const flightData = Object.keys(template.means.flight).slice(0, 10).map(key => ({
    key: key.replace('Key', '').replace('->Key', '→'),
    mean: Math.round(template.means.flight[key]),
    current: currentAttempt ? Math.round(currentAttempt.flightTimes[key] || 0) : null
  }));

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
          Динамика удержания клавиш (Dwell Time)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Сравнение эталонного времени удержания (синий) с текущей попыткой (фиолетовый). 
          Полосы погрешности отсутствуют для упрощения визуализации.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dwellData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{fontSize: 12}} />
              <YAxis unit="ms" tick={{fontSize: 12}} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Bar name="Эталон (мс)" dataKey="mean" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              {currentAttempt && (
                <Bar name="Текущий ввод (мс)" dataKey="current" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
           <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
           Ритм набора (Flight Time / Digraphs)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Временные интервалы между нажатиями клавиш. Характеризует "мелодию" набора пользователя.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={flightData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{fontSize: 10}} interval={0} />
              <YAxis unit="ms" tick={{fontSize: 12}} />
              <Tooltip 
                 contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Line type="monotone" name="Эталонный ритм" dataKey="mean" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
              {currentAttempt && (
                <Line type="monotone" name="Текущий ритм" dataKey="current" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
