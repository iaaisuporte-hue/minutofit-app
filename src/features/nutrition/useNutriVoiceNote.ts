import { useCallback, useEffect, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';

export interface NutriVoiceNote {
  id: string;
  nutriId: number;
  patientId: number;
  body: string;
  /** SPEC 035: id de nutrition_plan_meals (integer) — era uuid. */
  anchorMealId: number | null;
  publishedAt: string;
  readAt: string | null;
  nutriName?: string;
  nutriPhoto?: string | null;
}

/**
 * SPEC 036 / NUTRI-23: o GET marca TODAS as notas pendentes como lidas em
 * bloco (correto — é o servidor decidindo o que "pendente" significa), mas
 * este hook só guardava `payload.data[0]` — a segunda nota publicada antes
 * de o aluno abrir o app de novo era descartada sem nunca ter sido vista.
 * Agora expõe a fila inteira; quem renderiza decide como mostrar.
 */
export function useNutriVoiceNote() {
  const [notes, setNotes] = useState<NutriVoiceNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/student/voice-notes/pending`, { signal });
      if (signal?.aborted) return;
      const payload = await parseJson(res);
      if (!res.ok || !payload?.data?.length) {
        setNotes([]);
        return;
      }
      setNotes(payload.data as NutriVoiceNote[]);
    } catch {
      setNotes([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetch(ctrl.signal);
    return () => ctrl.abort();
  }, [fetch]);

  return { notes, loading };
}
