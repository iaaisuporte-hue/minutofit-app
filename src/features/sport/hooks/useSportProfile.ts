import { useCallback, useEffect, useState } from 'react';
import type { SportProfile } from '../engine/sportConfig.types';
import { fetchSportProfile, saveSportProfile, deactivateSportProfile } from '../services/sportApi';

interface UseSportProfileReturn {
  profile: SportProfile | null;
  loading: boolean;
  error: string | null;
  isSportActive: boolean;
  save: (data: Partial<Omit<SportProfile, 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deactivate: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useSportProfile(): UseSportProfileReturn {
  const [profile, setProfile] = useState<SportProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchSportProfile();
      setProfile(p);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar perfil esportivo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (data: Partial<Omit<SportProfile, 'user_id' | 'created_at' | 'updated_at'>>) => {
    const updated = await saveSportProfile(data);
    setProfile(updated);
  }, []);

  const deactivate = useCallback(async () => {
    await deactivateSportProfile();
    setProfile((prev) => prev ? { ...prev, active: false } : null);
  }, []);

  return {
    profile,
    loading,
    error,
    isSportActive: profile?.active === true,
    save,
    deactivate,
    reload: load,
  };
}
