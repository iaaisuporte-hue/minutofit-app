import { useEffect, useState } from "react";
import { MetabolicEvolutionView, type MetabolicEvolutionPayload } from "../../../features/metabolicCheckin";
import { fetchPatientEvolution } from "../../../services/nutriApi";

export function EvolucaoTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<MetabolicEvolutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPatientEvolution(patientId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message === "consent_required"
          ? "O paciente ainda não compartilhou os dados de evolução com você."
          : (e?.message || "Não foi possível carregar a evolução."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) return <p className="metabolic-section-copy" style={{ padding: "var(--space-2) 0" }}>Carregando evolução...</p>;
  if (error) return <p className="metabolic-section-copy" style={{ padding: "var(--space-2) 0" }}>{error}</p>;
  if (!data) return <p className="metabolic-section-copy" style={{ padding: "var(--space-2) 0" }}>Sem dados de evolução.</p>;

  return (
    <div style={{ paddingTop: "var(--space-2)" }}>
      <MetabolicEvolutionView records={data.checkins} stats={data.workoutStats} workoutsShared={data.scopes.workouts} />
    </div>
  );
}
