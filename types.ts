// Базовое событие нажатия клавиши
export interface RawKeyEvent {
  code: string;
  key: string;
  type: 'keydown' | 'keyup';
  timestamp: number;
}

// Извлеченные признаки (Feature Vector), отправляемые на сервер
export interface KeystrokeFeatures {
  totalDuration: number;
  dwellTimes: Record<string, number>;
  flightTimes: Record<string, number>;
  globalDwells?: number[];
  globalFlights?: number[];
}

// Ответ от сервера при верификации
export interface VerificationResponse {
  success: boolean;
  score: number;
  threshold: number;
  details: string;
  username: string;
  method?: string; // Например "GMM" или "Manhattan"
}

// Ответ от сервера при регистрации
export interface RegistrationResponse {
  message: string;
  user_id: string;
}

// Пользователь (для списка)
export interface UserSummary {
  id: string;
  username: string;
  created_at: string;
}

// Шаблон пользователя (используется для визуализации и обучения)
export interface UserTemplate {
  phrase: string;
  sampleCount?: number;
  method?: string; // GMM или Stats
  // Для GMM здесь могут быть дополнительные поля, но для визуализации нам нужны простые статистики
  means: {
    dwell: Record<string, number>;
    flight: Record<string, number>;
  };
  variances: {
    dwell: Record<string, number>;
    flight: Record<string, number>;
  };
  deviations: {
    dwell: Record<string, number>;
    flight: Record<string, number>;
  };
  globalDwellMean?: number;
  globalDwellStd?: number;
  globalFlightMean?: number;
  globalFlightStd?: number;
  threshold: number;
}
