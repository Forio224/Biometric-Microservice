import {
  KeystrokeFeatures,
  RegistrationResponse,
  UserSummary,
  UserTemplate,
  VerificationResponse,
} from '../types';

/**
 * baseURL приоритетно из VITE_API_URL.
 * Если фронт открыт с того же origin, что и backend (single-container deploy),
 * используем относительные пути.
 */
const resolveBaseUrl = (): string => {
  const envUrl =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_URL
      : undefined;

  if (envUrl && envUrl.trim().length > 0) return envUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    return isLocal ? 'http://localhost:8000' : '';
  }
  return '';
};

const BASE_URL = resolveBaseUrl();

const DEFAULT_TIMEOUT_MS = 8000;

const request = async <T>(
  path: string,
  init: RequestInit & { timeout?: number } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeout = init.timeout ?? DEFAULT_TIMEOUT_MS;
  const id = window.setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body && typeof body === 'object') {
          if (typeof body.detail === 'string') message = body.detail;
          else if (Array.isArray(body.detail)) {
            message = body.detail
              .map((d: unknown) => {
                if (!d) return null;
                if (typeof d === 'string') return d;
                const obj = d as { msg?: string; loc?: unknown[] };
                const path = Array.isArray(obj.loc) ? obj.loc.join('.') : '';
                return path ? `${path}: ${obj.msg ?? ''}` : obj.msg ?? '';
              })
              .filter(Boolean)
              .join('; ') || message;
          } else if (typeof body.message === 'string') message = body.message;
        }
      } catch {
        /* keep default */
      }
      throw new ApiError(message, res.status);
    }

    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError('Время ожидания истекло', 0);
    if (e instanceof ApiError) throw e;
    throw new ApiError((e as Error).message || 'Ошибка сети', 0);
  } finally {
    window.clearTimeout(id);
  }
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const ApiService = {
  baseUrl: BASE_URL,

  async health(): Promise<boolean> {
    try {
      await request<{ status: string }>('/health', { timeout: 2500 });
      return true;
    } catch {
      return false;
    }
  },

  getUsers(): Promise<UserSummary[]> {
    return request<UserSummary[]>('/users');
  },

  registerUser(username: string, samples: KeystrokeFeatures[]): Promise<RegistrationResponse> {
    return request<RegistrationResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ username, samples }),
    });
  },

  verifyUser(username: string, sample: KeystrokeFeatures): Promise<VerificationResponse> {
    return request<VerificationResponse>('/verify', {
      method: 'POST',
      body: JSON.stringify({ username, sample }),
    });
  },

  async getTemplate(username: string): Promise<UserTemplate | null> {
    try {
      return await request<UserTemplate>(`/users/${encodeURIComponent(username)}/template`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
};
