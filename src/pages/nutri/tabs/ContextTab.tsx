import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import { fetchPatientContext, type PatientMetabolism, type PatientDailyCheckin } from "../../../services/nutriApi";

const METABOLIC_STATUS_LABEL: Record<PatientMetabolism["status"], string> = {
  high: "Alto",
  moderate: "Moderado",
  low: "Baixo",
};

const METABOLIC_STATUS_COLOR: Record<PatientMetabolism["status"], string> = {
  high: COLORS.successText,
  moderate: COLORS.warnText,
  low: COLORS.dangerText,
};

const FEELING_LABEL: Record<NonNullable<PatientDailyCheckin["feeling"]>, string> = {
  energized: "Bem-disposto",
  neutral: "Neutro",
  tired: "Cansado",
};

const FEELING_COLOR: Record<NonNullable<PatientDailyCheckin["feeling"]>, string> = {
  energized: COLORS.successText,
  neutral: COLORS.muted,
  tired: COLORS.dangerText,
};

function TrendArrow({ direction, delta }: { direction: "up" | "down" | "stable"; delta: number }) {
  if (direction === "stable") return <span className="muted">Estável</span>;
  const up = direction === "up";
  return (
    <span style={{ color: up ? COLORS.successText : COLORS.dangerText, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {up ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />} {Math.abs(delta)} pts esta semana
    </span>
  );
}

export function ContextTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{
    hasMetabolicConsent: boolean;
    hasDailyConsent: boolean;
    metabolism?: PatientMetabolism | null;
    dailyCheckins?: PatientDailyCheckin[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientContext(patientId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <SkeletonPanelCard />;

  const m = data?.metabolism;
  const checkins = data?.dailyCheckins ?? [];

  return (
    <div className="stack">
      {/* ── Metabolismo ── */}
      <div className="card cardPad">
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-3)" }}>Metabolismo</div>

        {!data?.hasMetabolicConsent ? (
          <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Paciente ainda não concedeu acesso ao estado metabólico.</div>
        ) : !m ? (
          <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Snapshot metabólico ainda não disponível para este paciente.</div>
        ) : (
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            {/* Score + status */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: METABOLIC_STATUS_COLOR[m.status], lineHeight: 1 }}>
                {m.score}
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: METABOLIC_STATUS_COLOR[m.status], fontWeight: 600 }}>
                Metabólico: {METABOLIC_STATUS_LABEL[m.status]}
              </span>
            </div>

            {/* Tendência 7d */}
            {m.trend7d && (
              <div style={{ fontSize: "var(--text-sm)" }}>
                <TrendArrow direction={m.trend7d.direction} delta={m.trend7d.delta} />
              </div>
            )}

            {/* Fatores top 3 */}
            {m.factors && m.factors.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {m.factors.slice(0, 3).map((f, i) => (
                  <span
                    key={i}
                    className={f.impact >= 0 ? "badge badge-success" : "badge badge-danger"}
                  >
                    {f.impact >= 0 ? "+" : "−"} {f.name}
                  </span>
                ))}
              </div>
            )}

            {/* Interpretação IA */}
            {m.interpretation?.hint && (
              <div className="muted" style={{ fontSize: "var(--text-xs)", fontStyle: "italic", lineHeight: 1.5 }}>
                {m.interpretation.hint}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Check-ins de bem-estar ── */}
      <div className="card cardPad">
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-3)" }}>
          Check-ins de bem-estar
        </div>

        {!data?.hasDailyConsent ? (
          <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Paciente ainda não concedeu acesso aos check-ins diários.</div>
        ) : checkins.length === 0 ? (
          <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Nenhum check-in nos últimos 7 dias.</div>
        ) : (
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            {checkins.map((c) => {
              const dateLabel = new Date(c.check_date.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
              return (
                <div
                  key={c.check_date}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span className="muted" style={{ minWidth: 72, fontWeight: 600 }}>{dateLabel}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", flex: 1 }}>
                    {c.feeling && (
                      <span style={{ color: FEELING_COLOR[c.feeling], fontWeight: 600 }}>
                        {FEELING_LABEL[c.feeling]}
                      </span>
                    )}
                    {c.slept_well === true && <span style={{ color: COLORS.successText }}>· Dormiu bem</span>}
                    {c.slept_well === false && <span style={{ color: COLORS.warnText }}>· Sono ruim</span>}
                    {c.in_pain === true && <span style={{ color: COLORS.dangerText }}>· Com dor</span>}
                    {c.stressed === true && <span style={{ color: COLORS.warnText }}>· Estressado</span>}
                    {!c.feeling && c.slept_well == null && c.in_pain == null && c.stressed == null && (
                      <span className="muted">Sem detalhes</span>
                    )}
                    {c.notes && (
                      <span className="muted" style={{ display: "block", width: "100%", marginTop: 2 }}>
                        {c.notes.length > 60 ? c.notes.slice(0, 60) + "…" : c.notes}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
