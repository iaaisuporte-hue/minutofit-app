import { useCallback, useEffect, useState } from "react";
import {
  fetchPersonalStudentSnapshot,
  type PersonalStudentSnapshot,
} from "../../../services/personalDashboardApi";

function snapshotErrorMessage(message: string) {
  if (/route not found/i.test(message)) {
    return "A visão detalhada deste aluno ainda não está disponível nesta versão da API.";
  }
  return message;
}

export function usePersonalStudentSnapshot(studentId: string | null) {
  const [data, setData] = useState<PersonalStudentSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!studentId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const snapshot = await fetchPersonalStudentSnapshot(studentId);
      setData(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar o perfil do aluno.";
      setError(snapshotErrorMessage(message));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
