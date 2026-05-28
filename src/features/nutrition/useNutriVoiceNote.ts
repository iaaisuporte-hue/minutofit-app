import { useCallback, useEffect, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';

export interface NutriVoiceNote {
  id: string;
  nutriId: number;
  patientId: number;
  body: string;
  anchorMealId: string | null;
  publishedAt: string;
  readAt: string | null;
  nutriName?: string;
  nutriPhoto?: string | null;
}

export function useNutriVoiceNote() {
  const [note, setNote] = useState<NutriVoiceNote | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/student/voice-notes/pending`, { signal });
      if (signal?.aborted) return;
      const payload = await parseJson(res);
      if (!res.ok || !payload?.data?.length) {
        setNote(null);
        return;
      }
      setNote(payload.data[0] as NutriVoiceNote);
    } catch {
      setNote(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetch(ctrl.signal);
    return () => ctrl.abort();
  }, [fetch]);

  return { note, loading };
}
