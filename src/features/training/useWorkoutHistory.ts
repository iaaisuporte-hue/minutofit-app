import { useCallback, useEffect, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import { readWorkoutHistory, type WorkoutHistoryEntry } from '../../pages/user/workoutHistory';

interface UseWorkoutHistoryResult {
  data: WorkoutHistoryEntry[];
  loading: boolean;
}

export function useWorkoutHistory(days = 30): UseWorkoutHistoryResult {
  const [data, setData] = useState<WorkoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/user/workout-history?days=${days}`, { signal });
      if (signal.aborted) return;
      const payload = await parseJson(res);
      if (signal.aborted) return;
      if (res.ok && Array.isArray(payload)) {
        // Mescla API com localStorage: inclui entradas locais que não estão no banco
        // (ex: check-ins salvos quando a API estava falhando).
        const apiEntries = payload as WorkoutHistoryEntry[];
        const apiIds = new Set(apiEntries.map((e) => e.workoutId));
        const localOnly = readWorkoutHistory().filter((e) => !apiIds.has(e.workoutId));
        const merged = [...apiEntries, ...localOnly].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setData(merged);
      } else {
        setData(readWorkoutHistory());
      }
    } catch {
      if (!signal.aborted) setData(readWorkoutHistory());
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return { data, loading };
}
