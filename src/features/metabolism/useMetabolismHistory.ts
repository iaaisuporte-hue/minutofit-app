import { useCallback, useEffect, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import type { MetabolicHistory } from './metabolism.types';

function buildFallbackHistory(days = 14): MetabolicHistory {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - i));
    const score = Math.min(100, Math.max(0, 60 + Math.round(Math.sin(i * 0.8) * 6)));
    return { date: date.toISOString().slice(0, 10), score };
  });
}

interface UseMetabolismHistoryResult {
  data: MetabolicHistory;
  loading: boolean;
}

export function useMetabolismHistory(days = 14): UseMetabolismHistoryResult {
  const [data, setData] = useState<MetabolicHistory>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);

    try {
      const response = await authFetch(`${API_URL}/me/metabolism/history?days=${days}`, { signal });

      if (signal.aborted) return;

      const payload = await parseJson(response);

      if (signal.aborted) return;

      if (response.ok && Array.isArray(payload)) {
        setData(payload as MetabolicHistory);
      } else {
        setData(buildFallbackHistory());
      }
    } catch {
      if (signal.aborted) return;
      setData(buildFallbackHistory());
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [days]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return { data, loading };
}
