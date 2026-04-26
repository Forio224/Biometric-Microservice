// Контракты, совместимые с FastAPI backend (app/schemas.py).

export interface RawKeyEvent {
  code: string;
  key: string;
  type: 'keydown' | 'keyup';
  timestamp: number;
}

export interface KeystrokeFeatures {
  totalDuration: number;
  dwellTimes: Record<string, number>;
  flightTimes: Record<string, number>;
  globalDwells?: number[];
  globalFlights?: number[];
  typedChars?: number;
  backspaceCount?: number;
  deleteCount?: number;
  correctionRate?: number;
}

export interface VerificationResponse {
  success: boolean;
  score: number;
  threshold: number;
  details: string;
  username: string;
  method?: string;
}

export interface RegistrationResponse {
  message: string;
  user_id: string;
}

export interface UserSummary {
  id: string;
  username: string;
  created_at: string;
}

export interface UserTemplate {
  phrase?: string;
  sampleCount?: number;
  method?: string;
  means?: {
    dwell?: Record<string, number>;
    flight?: Record<string, number>;
  };
  variances?: {
    dwell?: Record<string, number>;
    flight?: Record<string, number>;
  };
  deviations?: {
    dwell?: Record<string, number>;
    flight?: Record<string, number>;
  };
  globalDwellMean?: number;
  globalDwellStd?: number;
  globalFlightMean?: number;
  globalFlightStd?: number;
  correctionRateMean?: number;
  correctionRateStd?: number;
  threshold?: number;
  // Сервер может вернуть дополнительные поля; не ломаемся на них
  [key: string]: unknown;
}

// Локально сохраняемая запись об истории попыток
export interface AttemptHistoryItem {
  id: string;
  username: string;
  timestamp: string;
  status: 'success' | 'denied' | 'error';
  score: number;
  threshold: number;
  method?: string;
  details?: string;
  source: 'api' | 'mock';
}
