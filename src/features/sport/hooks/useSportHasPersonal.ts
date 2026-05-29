import { useCallback, useEffect, useState } from 'react';
import { fetchSportHasPersonal } from '../services/sportApi';

interface UseSportHasPersonalReturn {
  hasPersonal: boolean;
  personalId: number | null;
  loading: boolean;
}

export function useSportHasPersonal(): UseSportHasPersonalReturn {
  const [hasPersonal, setHasPersonal] = useState(false);
  const [personalId, setPersonalId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSportHasPersonal();
      setHasPersonal(data.has_personal);
      setPersonalId(data.personal_id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { hasPersonal, personalId, loading };
}
