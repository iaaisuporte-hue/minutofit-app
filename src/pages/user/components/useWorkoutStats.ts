import { useEffect, useState } from 'react';
import { getWorkoutStats, type WorkoutStats } from '../../../services/workoutSessionApi';

// Fetch único de /training/stats compartilhado pelo hero (resumo) e pela seção
// de evolução de carga na página de Estado Metabólico — evita chamada dupla.
export function useWorkoutStats() {
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getWorkoutStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}
