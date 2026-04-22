import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import type { MetabolicData } from './metabolism.types';

interface UseMetabolismResult {
  data: MetabolicData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMetabolism(): UseMetabolismResult {
  const [data, setData] = useState<MetabolicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`${API_URL}/me/metabolism`, { signal });

      if (signal.aborted) return;

      const payload = await parseJson(response);

      if (signal.aborted) return;

      if (!response.ok) {
        setError('Unable to load metabolic data');
        setData(null);
      } else {
        setData(payload as MetabolicData);
      }
    } catch (err) {
      if (signal.aborted) return;
      setError('Unable to load metabolic data');
      setData(null);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchCountRef.current += 1;
    const controller = new AbortController();
    void fetchData(controller.signal);
  }, [fetchData]);

  return { data, loading, error, refetch };
}
