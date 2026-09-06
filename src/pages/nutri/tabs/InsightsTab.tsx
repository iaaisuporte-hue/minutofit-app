import { useEffect, useState } from "react";
import { TrendingDown, Clock, Utensils, BellOff } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import { EmptyState } from "../../../components/EmptyState";
import { fetchPatientInsights, type NutriInsight, NutriApiError } from "../../../services/nutriApi";
import { ConsentRevokedNotice } from "./shared";

// SPEC 036 / mapa de ícones: glifo tipográfico → ícone lucide monocromático.
const INSIGHT_ICON: Record<NutriInsight["type"], typeof TrendingDown> = {
  adherence_drop: TrendingDown,
  late_hunger: Clock,
  ghost_meal: Utensils,
  silent_absence: BellOff,
};

const INSIGHT_COLOR: Record<NutriInsight["type"], string> = {
  adherence_drop: COLORS.dangerText,
  late_hunger: COLORS.warnText,
  ghost_meal: COLORS.warnText,
  silent_absence: COLORS.dangerText,
};

export function InsightsTab({ patientId }: { patientId: number }) {
  const [insights, setInsights] = useState<NutriInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"consent" | "error" | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetchPatientInsights(patientId)
      .then(setInsights)
      .catch((err) => {
        // SPEC 035 / NUTRI-03: o BUG central da P0 nasceu exatamente aqui —
        // um erro (coluna inexistente, hoje corrigida; ou qualquer falha
        // futura) virava lista vazia, e a lista vazia é o estado de
        // sucesso desta aba. "Paciente em rota estável" NUNCA pode ser o
        // resultado de uma falha — só de uma checagem que rodou e não achou
        // sinal.
        setLoadError(err instanceof NutriApiError && err.consentRevoked ? "consent" : "error");
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <SkeletonPanelCard />;
  if (loadError === "consent") return <ConsentRevokedNotice />;
  if (loadError === "error") {
    return (
      <div className="card cardPad alert-danger">
        Não foi possível calcular os insights agora. Tente novamente em instantes.
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <EmptyState
        title="Nenhum sinal de alerta"
        description="Nenhum sinal de alerta detectado nos últimos 7 dias. Paciente em rota estável."
      />
    );
  }

  return (
    <div className="stack">
      {insights.map((ins, i) => {
        const Icon = INSIGHT_ICON[ins.type];
        return (
          <div
            key={i}
            className="card cardPad"
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "flex-start",
              borderLeft: `3px solid ${INSIGHT_COLOR[ins.type]}`,
            }}
          >
            <Icon size={18} aria-hidden="true" color={INSIGHT_COLOR[ins.type]} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-1)" }}>
                {ins.label}
              </div>
              <div className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
                {ins.detail}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
