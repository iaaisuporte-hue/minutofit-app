import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../../styles/colors";
import { fetchPatients, type PatientSummary } from "../../services/nutriApi";

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function AdherenceLabel({ checkins7d }: { checkins7d: number }) {
  const pct = Math.round((checkins7d / 7) * 100);
  const color = pct >= 70 ? COLORS.primary : pct >= 40 ? "var(--color-warn)" : COLORS.danger;
  return <span style={{ color, fontWeight: 600, fontSize: 13 }}>{pct}% adesão (7d)</span>;
}

function LastCheckinLabel({ date }: { date: string | null }) {
  const days = daysSince(date);
  if (days === null) return <span style={{ color: COLORS.muted, fontSize: 12 }}>Nenhum check-in</span>;
  if (days === 0) return <span style={{ color: COLORS.primary, fontSize: 12 }}>Último check-in: hoje</span>;
  if (days === 1) return <span style={{ color: COLORS.muted, fontSize: 12 }}>Último check-in: ontem</span>;
  return (
    <span style={{ color: days > 3 ? COLORS.danger : COLORS.muted, fontSize: 12 }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando pacientes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px 0" }}>
        <div className="card cardPad" style={{ color: COLORS.danger }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "-0.02em" }}
        >
          Pacientes
          <span style={{ fontWeight: 400, fontSize: 15, color: COLORS.muted, marginLeft: 8 }}>
            ({patients.length} ativo{patients.length !== 1 ? "s" : ""})
          </span>
        </h1>
      </div>

      {patients.length === 0 ? (
        <div className="card cardPad" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
            Nenhum paciente vinculado
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Convide seu primeiro paciente em{" "}
            <button
              type="button"
              onClick={() => navigate("../convites", { relative: "path" })}
              style={{
                background: "none",
                border: "none",
                color: COLORS.primary,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                padding: 0,
              }}
            >
              Convites
            </button>.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {patients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`${p.id}`)}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: COLORS.card,
                borderRadius: 12,
                padding: "14px 16px",
                border: p.riskFlag
                  ? "1.5px solid var(--color-warn)"
                  : "1px solid var(--color-border)",
                cursor: "pointer",
                transition: "box-shadow 0.15s",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--color-surface-raised)",
                  flexShrink: 0,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: COLORS.primary,
                }}
              >
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  p.name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{p.name}</span>
                  {p.adherenceDropFlag && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-danger,#EF4444)",
                        background: "rgba(239,68,68,.10)",
                        borderRadius: 4,
                        padding: "1px 6px",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                        border: "1px solid rgba(239,68,68,.25)",
                      }}
                    >
                      Em queda
                    </span>
                  )}
                  {p.riskFlag && !p.adherenceDropFlag && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--color-warn)",
                        background: "rgba(251,191,36,.12)",
                        borderRadius: 4,
                        padding: "1px 6px",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      Atenção
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 3,
                    flexWrap: "wrap",
                  }}
                >
                  {p.activePlan ? (
                    <AdherenceLabel checkins7d={p.adherence7d} />
                  ) : (
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Sem plano ativo</span>
                  )}
                  <LastCheckinLabel date={p.lastCheckinDate} />
                </div>
              </div>

              {/* Arrow */}
              <div style={{ color: COLORS.muted, fontSize: 18, flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
