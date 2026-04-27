import { useEffect, useRef, useState } from 'react';
import { ApiService } from '../services/apiService';

export interface BackendStatus {
  online: boolean;
  /** true пока шёл хотя бы один запрос */
  ready: boolean;
  lastChecked: number | null;
  baseUrl: string;
}

const POLL_INTERVAL_MS = 30_000;

export function useBackendStatus(): BackendStatus & { refresh: () => Promise<boolean> } {
  const [state, setState] = useState<BackendStatus>({
    online: false,
    ready: false,
    lastChecked: null,
    baseUrl: ApiService.baseUrl,
  });
  const mounted = useRef(true);

  const refresh = async () => {
    const ok = await ApiService.health();
    if (!mounted.current) return ok;
    setState((s) => ({ ...s, online: ok, ready: true, lastChecked: Date.now() }));
    return ok;
  };

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, refresh };
}
