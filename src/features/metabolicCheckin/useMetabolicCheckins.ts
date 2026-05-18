import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import type { MetabolicCheckinInput, MetabolicCheckinRecord } from './types';

interface UseMetabolicCheckinsResult {
  records: MetabolicCheckinRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveCheckin: (input: MetabolicCheckinInput) => Promise<MetabolicCheckinRecord>;
}

export function useMetabolicCheckins(limit = 50): UseMetabolicCheckinsResult {
  const [records, setRecords] = useState<MetabolicCheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()),
    [records]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/metabolic-checkins?limit=${limit}`);
      const payload = await parseJson(response);
      if (!response.ok) throw new Error(payload?.error || 'Não conseguimos carregar suas atualizações.');
      setRecords(Array.isArray(payload?.data?.records) ? payload.data.records : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não conseguimos carregar suas atualizações.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const saveCheckin = useCallback(async (input: MetabolicCheckinInput) => {
    const response = await authFetch(`${API_URL}/metabolic-checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await parseJson(response);
    if (!response.ok) throw new Error(payload?.error || 'Não conseguimos salvar sua atualização.');
    const record = payload?.data?.record as MetabolicCheckinRecord;
    setRecords((current) => [record, ...current]);
    return record;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { records: sortedRecords, loading, error, refresh, saveCheckin };
}
