import { useEffect, useState } from "react";
import { COLORS } from "../../styles/colors";
import { fetchMyNutritionPlan, OBJECTIVE_LABELS, type NutritionPlan } from "../../services/nutriApi";

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function NutritionPlanViewPage() {
  const [plan, setPlan] = useState<NutritionPlan | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMyNutritionPlan()
      .then(setPlan)
      .catch(() => setError(true));
  }, []);

  if (plan === undefined && !error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando plano alimentar...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
          Nenhum plano alimentar ativo
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted }}>
          Quando sua nutricionista prescrever um plano, ele aparecerá aqui.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: "0 0 6px", letterSpacing: "-0.02em" }}
        >
          Meu plano alimentar
        </h1>
        <div style={{ fontSize: 13, color: COLORS.muted }}>
          Prescrito por {plan.nutri_name ?? "seu nutricionista"} · desde {formatDate(plan.started_at)}
        </div>
      </div>

      {/* Objective */}
      <div className="card cardPad" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
          Objetivo
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
          {OBJECTIVE_LABELS[plan.objective]}
        </div>
      </div>

      {/* General notes */}
      {plan.general_notes && (
        <div className="card cardPad" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Orientações gerais
          </div>
          <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {plan.general_notes}
          </div>
        </div>
      )}

      {/* Meals */}
      {plan.meals && plan.meals.length > 0 && (
        <div className="card cardPad">
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
            Refeições
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {plan.meals.map((m, i) => (
              <div
                key={m.id}
                style={{
                  paddingTop: i > 0 ? 14 : 0,
                  marginTop: i > 0 ? 14 : 0,
                  borderTop: i > 0 ? "1px solid var(--color-border)" : "none",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.orientation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
