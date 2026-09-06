import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonStudentRow } from "../../components/feedback/Skeleton";
import { fetchPatients, type PatientSummary } from "../../services/nutriApi";

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Prefere a aderência REAL por refeição (SPEC 035); cai no proxy legado (dias
// com check-in ÷ 7) quando não há dado granular. O rótulo distingue os casos.
function AdherenceLabel({ mealPct, checkins7d }: { mealPct: number | null; checkins7d: number }) {
  const real = mealPct != null;
  const pct = real ? mealPct : Math.round((checkins7d / 7) * 100);
  const color = pct >= 70 ? COLORS.successText : pct >= 40 ? COLORS.warnText : COLORS.dangerText;
  return (
    <span style={{ color, fontWeight: 600, fontSize: "var(--text-sm)" }}>
      {pct}% {real ? "adesão às refeições" : "dias com check-in"} (7d)
    </span>
  );
}

function LastCheckinLabel({ date }: { date: string | null }) {
  const days = daysSince(date);
  if (days === null) return <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Nenhum check-in</span>;
  if (days === 0) return <span style={{ color: COLORS.successText, fontSize: "var(--text-xs)" }}>Último check-in: hoje</span>;
  if (days === 1) return <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Último check-in: ontem</span>;
  return (
    <span style={{ color: days > 3 ? COLORS.dangerText : COLORS.muted, fontSize: "var(--text-xs)" }}>
      Último check-in: {days}d atrás
    </span>
  );
}

export default function NutritionPatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients()
      .then(setPatients)
      .catch(() => setError("Não foi possível carregar os pacientes."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stack" style={{ padding: "var(--space-6) 0" }} aria-busy="true" aria-label="Carregando pacientes">
        <SkeletonStudentRow />
        <SkeletonStudentRow />
        <SkeletonStudentRow />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--space-6) 0" }}>
        <div className="card cardPad alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6) 0" }}>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Pacientes
          <span className="muted" style={{ fontWeight: 400, fontSize: "var(--text-lg)", marginLeft: "var(--space-2)" }}>
            ({patients.length} ativo{patients.length !== 1 ? "s" : ""})
          </span>
        </h1>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          title="Nenhum paciente vinculado"
          description="Convide seu primeiro paciente para começar o acompanhamento nutricional."
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("../convites", { relative: "path" })}>
              Ir para Convites
            </button>
          }
        />
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          {patients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`${p.id}`, { state: { patientName: p.name } })}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-3) var(--space-4)",
                border: p.riskFlag ? "1.5px solid var(--color-warn)" : "1px solid var(--color-border)",
                cursor: "pointer",
                width: "100%",
                boxSizing: "border-box",
                minHeight: 44,
              }}
            >
              <span className="avatar-initials avatar-initials--md" aria-hidden="true">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  (p.name?.charAt(0) ?? "?").toUpperCase()
                )}
              </span>

              {/* Info */}
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: p.consentRevoked ? COLORS.muted : COLORS.text }}>
                    {p.consentRevoked ? "Acesso revogado pelo paciente" : p.name}
                  </span>
                  {p.adherenceDropFlag && <span className="badge badge-danger">Em queda</span>}
                  {p.riskFlag && !p.adherenceDropFlag && <span className="badge badge-warn">Atenção</span>}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-1)", flexWrap: "wrap" }}>
                  {p.consentRevoked ? (
                    <span className="muted" style={{ fontSize: "var(--text-sm)", fontStyle: "italic" }}>
                      Paciente revogou o acesso aos dados nutricionais
                    </span>
                  ) : p.activePlan ? (
                    <AdherenceLabel mealPct={p.mealAdherence7dPct} checkins7d={p.adherence7d} />
                  ) : (
                    <span className="muted" style={{ fontSize: "var(--text-sm)" }}>Sem plano ativo</span>
                  )}
                  {!p.consentRevoked && <LastCheckinLabel date={p.lastCheckinDate} />}
                </span>
              </span>

              <ChevronRight size={18} color={COLORS.muted} aria-hidden="true" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
