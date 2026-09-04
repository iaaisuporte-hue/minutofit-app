import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';

export interface GamificationSummary {
  xp: number;
  level: number;
  streak: number;
  todayCheckedIn: boolean;
  alreadyCheckedIn: boolean;
  /**
   * Condição de bem-estar já respondida HOJE (dia do aluno), ou `null`.
   * Diferente de `todayCheckedIn`, que é fonte-agnóstico e fica `true` só por
   * ter treinado. Cru de propósito: quem valida é `parseRemoteCondition`.
   */
  todayCondition: unknown;
  heatmap: string[];
  lastWorkout: {
    workoutId: string;
    title: string;
    muscleGroups: string[];
    completedAt: string;
  } | null;
}

interface UseGamificationSummaryResult {
  data: GamificationSummary | null;
  loading: boolean;
  refetch: () => void;
}

const FALLBACK: GamificationSummary = {
  xp: 0,
  level: 1,
  streak: 0,
  todayCheckedIn: false,
  alreadyCheckedIn: false,
  todayCondition: null,
  heatmap: [],
  lastWorkout: null,
};

export function useGamificationSummary(): UseGamificationSummaryResult {
  const [data, setData] = useState<GamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const refetchTrigger = useRef(0);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/gamification/summary`, { signal });
      if (signal.aborted) return;
      const payload = await parseJson(response);
      if (signal.aborted) return;
      // A API responde no envelope `{ success, data }` — `parseJson` não
      // desembrulha. Sem este `.data`, TODO o resumo chegava como `undefined`
      // e caía nos `?? 0` / `?? false` dos consumidores: streak sempre 0, XP
      // sempre 0, `todayCheckedIn` sempre falso. Silencioso porque o tipo
      // afirmava a forma certa e um cast escondia a diferença.
      const corpo = (payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data: unknown }).data
        : payload) as GamificationSummary | null;
      setData(response.ok && corpo ? corpo : FALLBACK);
    } catch {
      if (!signal.aborted) setData(FALLBACK);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, refetchTrigger.current]);

  const refetch = useCallback(() => {
    refetchTrigger.current += 1;
    const controller = new AbortController();
    void fetchData(controller.signal);
  }, [fetchData]);

  return { data, loading, refetch };
}
