import { useState } from "react";
import { COLORS } from "../../styles/colors";
import MyWorkoutPlansPage from "./MyWorkoutPlansPage";
import NutritionPlanViewPage from "./NutritionPlanViewPage";

type Tab = "treino" | "alimentacao";

export default function MeuPlanoPage() {
  const [tab, setTab] = useState<Tab>("treino");

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1.5px solid var(--color-border)",
          marginBottom: 24,
        }}
      >
        {(["treino", "alimentacao"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? COLORS.primary : COLORS.muted,
              cursor: "pointer",
              borderBottom: tab === t ? `2px solid ${COLORS.primary}` : "2px solid transparent",
              marginBottom: -1.5,
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {t === "treino" ? "Treino" : "Alimentação"}
          </button>
        ))}
      </div>

      {tab === "treino" ? <MyWorkoutPlansPage /> : <NutritionPlanViewPage />}
    </div>
  );
}
