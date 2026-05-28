import { useCallback, useEffect, useState } from 'react';
import type { SportDashboard } from '../engine/sportConfig.types';
import { fetchSportDashboard } from '../services/sportApi';

interface UseSportDashboardReturn {
  dashboard: SportDashboard | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useSportDashboard(): UseSportDashboardReturn {
  const [dashboard, setDashboard] = useState<SportDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSportDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar dashboard esportivo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { dashboard, isLoading, error, reload: load };
}
