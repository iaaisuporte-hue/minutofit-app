import { useCallback, useEffect, useState } from "react";
import { fetchProtocolUsages, removeProtocolUsage, type ProtocolUsage } from "../../../services/workoutProtocolsApi";

export function useProtocolUsages(protocolId: number | null, open: boolean) {
  const [students, setStudents] = useState<ProtocolUsage[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!protocolId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProtocolUsages(protocolId);
      setStudents(data.students || []);
      setCount(data.count || 0);
    } catch (e) {
      setStudents([]);
      setCount(0);
      setError(e instanceof Error ? e.message : "Nao foi possivel carregar os usos.");
    } finally {
      setLoading(false);
    }
  }, [protocolId, open]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(async (planId: number) => {
    if (!protocolId) return;
    await removeProtocolUsage(protocolId, planId);
    await load();
  }, [protocolId, load]);

  return { students, count, loading, error, reload: load, remove };
}
