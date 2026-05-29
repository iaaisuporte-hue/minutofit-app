import { useCallback, useEffect, useState } from 'react';
import type { Fatigue7dResult } from '../engine/sportConfig.types';
import { fetchSportFatigue } from '../services/sportApi';

interface UseSportFatigueReturn {
  fatigue: Fatigue7dResult | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useSportFatigue(): UseSportFatigueReturn {
  const [fatigue, setFatigue] = useState<Fatigue7dResult | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSportFatigue();
      setFatigue(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { fatigue, loading, reload };
}
