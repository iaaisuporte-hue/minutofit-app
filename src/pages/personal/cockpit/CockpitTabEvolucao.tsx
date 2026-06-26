import { useEffect, useState } from "react";
import { fetchPersonalStudentEvolution } from "../../../services/personalDashboardApi";
import { MetabolicEvolutionView, type MetabolicEvolutionPayload } from "../../../features/metabolicCheckin";

// Aba Evolução do cockpit do personal (Spec 014) — read-only, consent-gated.
// Reusa a mesma visão de evolução do aluno; backend já filtra por consent.
export function CockpitTabEvolucao({ studentId }: { studentId: string }) {
  const [data, setData] = useState<MetabolicEvolutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPersonalStudentEvolution(studentId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message === "consent_required"
          ? "O aluno ainda não compartilhou os dados de evolução com você."
          : (e?.message || "Não foi possível carregar a evolução."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) return <p className="metabolic-section-copy" style={{ padding: "8px 0" }}>Carregando evolução...</p>;
  if (error) {
    return (
      <div className="pp-error-state">
        <div style={{ color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1.5 }}>{error}</div>
      </div>
    );
  }
  if (!data) return <p className="metabolic-section-copy" style={{ padding: "8px 0" }}>Sem dados de evolução.</p>;

  return (
    <div style={{ padding: "4px 0" }}>
      <MetabolicEvolutionView records={data.checkins} stats={data.workoutStats} workoutsShared={data.scopes.workouts} />
    </div>
  );
}
