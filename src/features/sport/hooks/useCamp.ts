import { useCallback, useEffect, useState } from 'react';
import type { CampWithDerived } from '../engine/sportConfig.types';
import { fetchCamps, createCamp, updateCamp } from '../services/sportApi';

interface UseCampReturn {
  activeCamp: CampWithDerived | null;
  camps: CampWithDerived[];
  loading: boolean;
  error: string | null;
  create: (data: { event_name: string; event_date: string; category?: string; target_weight_kg?: number; weeks_planned?: number }) => Promise<void>;
  update: (id: number, data: Partial<CampWithDerived>) => Promise<void>;
  reload: () => Promise<void>;
}

export function useCamp(): UseCampReturn {
  const [camps, setCamps] = useState<CampWithDerived[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchCamps();
      setCamps(all);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar camps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = useCallback(async (data: Parameters<typeof createCamp>[0]) => {
    const camp = await createCamp(data);
    setCamps((prev) => [camp, ...prev]);
  }, []);

  const update = useCallback(async (id: number, data: Partial<CampWithDerived>) => {
    const updated = await updateCamp(id, data);
    setCamps((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const activeCamp = camps.find((c) => c.status === 'active') ?? null;

  return { activeCamp, camps, loading, error, create, update, reload: load };
}
