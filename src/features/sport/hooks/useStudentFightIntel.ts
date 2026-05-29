import { useEffect, useState } from 'react';
import type { StudentFightIntelData } from '../services/sportApi';
import { fetchStudentFightIntel } from '../services/sportApi';

interface UseStudentFightIntelReturn {
  data: StudentFightIntelData | null;
  loading: boolean;
  error: string | null;
}

export function useStudentFightIntel(studentId: number): UseStudentFightIntelReturn {
  const [data, setData] = useState<StudentFightIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStudentFightIntel(studentId)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar dados esportivos');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  return { data, loading, error };
}
