import { useCallback, useEffect, useState } from 'react';
import type { ReadinessSnapshot } from '../engine/sportConfig.types';
import { fetchReadinessToday } from '../services/sportApi';

interface UseSportReadinessReturn {
  readiness: ReadinessSnapshot | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useSportReadiness(): UseSportReadinessReturn {
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReadinessToday();
      setReadiness(r);
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.includes('No check-in')) {
        setReadiness(null);
      } else {
        setError(err.message ?? 'Erro ao carregar prontidão');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { readiness, loading, error, reload: load };
}
