import { useCallback, useEffect, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';

export interface ProfessionalSummary {
  id: number;
  name: string;
  photo: string | null;
  lastObservation: { text: string; createdAt: string } | null;
  /** Última sessão registrada pelo personal (Veio/Parcial) nos últimos 7 dias. */
  lastSession?: { status: 'present' | 'partial'; at: string } | null;
}

export interface ProfessionalContext {
  personal: ProfessionalSummary | null;
  nutri: ProfessionalSummary | null;
}

interface UseProfessionalContextResult {
  data: ProfessionalContext | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProfessionalContext(): UseProfessionalContextResult {
  const [data, setData] = useState<ProfessionalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/user/professional-context`, { signal });
      if (signal.aborted) return;
      const payload = await parseJson(res);
      if (signal.aborted) return;
      if (!res.ok) {
        setError('Unable to load professional context');
        setData(null);
      } else {
        setData(payload as ProfessionalContext);
      }
    } catch {
      if (signal.aborted) return;
      setError('Unable to load professional context');
      setData(null);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, tick]);

  return { data, loading, error, refetch };
}
