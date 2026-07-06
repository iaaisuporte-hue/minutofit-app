import { useEffect, useState } from "react";
import { fetchStudentTrainingSummary, type StudentTrainingSummary } from "../../../services/personalWorkoutApi";

// Cockpit do personal (Spec 010 V1.1): aderência REAL (séries feitas ÷
// prescritas) + frequência + últimas sessões. Some se não há execução/acesso.

const STATUS_LABEL: Record<string, string> = {
  completed: "Completo",
  partial: "Parcial",
  abandoned: "Abandonado",
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso));
}

export function StudentExecutionCard({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<StudentTrainingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStudentTrainingSummary(studentId)
      .then((s) => { if (!cancelled) setSummary(s); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) return null;
  if (!summary || summary.total === 0) return null;

  const adh = summary.adherencePct;
  const adhColor = adh == null ? "var(--color-text-muted)" : adh >= 80 ? "var(--color-success-text, #16A34A)" : adh >= 50 ? "var(--color-warn, #D97706)" : "var(--color-danger, #DC2626)";

  // Desconforto relatado nas sessões recentes (P1-3) — movimentos distintos.
  const recentDiscomfort = Array.from(
    // `?? []` tolera um backend uma versão atrás (sem o campo) durante o skew de deploy.
    new Set(summary.sessions.slice(0, 6).flatMap((s) => s.discomfortExercises ?? [])),
  );

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        background: "var(--color-surface)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>Execução do treino</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {summary.last7d} nos últimos 7 dias · {summary.total} no total
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: adhColor, lineHeight: 1 }}>
            {adh == null ? "—" : `${adh}%`}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>aderência (séries feitas ÷ prescritas)</div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {summary.sessions.slice(0, 6).map((s) => {
            const dis = s.discomfortExercises ?? [];
            const hasDiscomfort = dis.length > 0;
            return (
              <span
                key={s.id}
                title={
                  `${STATUS_LABEL[s.status] ?? s.status} · ${s.setsDone}/${s.prescribedSets} séries` +
                  (hasDiscomfort ? ` · desconforto: ${dis.join(", ")}` : "")
                }
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 999,
                  border: `1px solid ${hasDiscomfort ? "var(--color-warn, #D97706)" : "var(--color-border)"}`,
                  color: hasDiscomfort
                    ? "var(--color-warn, #D97706)"
                    : s.status === "partial"
                      ? "var(--color-warn, #D97706)"
                      : "var(--color-text-muted)",
                  background: "var(--color-bg-main)",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtDate(s.date)} · {s.setsDone}/{s.prescribedSets || "?"}
                {hasDiscomfort ? " ⚠" : ""}
              </span>
            );
          })}
        </div>
      </div>

      {recentDiscomfort.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: "var(--color-warn, #D97706)",
            borderTop: "1px solid var(--color-border)",
            paddingTop: 10,
            lineHeight: 1.4,
          }}
        >
          ⚠ Desconforto relatado nas sessões recentes: <strong>{recentDiscomfort.join(", ")}</strong>. Vale um olhar na técnica/carga.
        </div>
      )}
    </div>
  );
}
