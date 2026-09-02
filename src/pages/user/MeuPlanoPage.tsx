import { useState } from "react";
import { COLORS } from "../../styles/colors";
import MyWorkoutPlansPage from "./MyWorkoutPlansPage";
import NutritionPlanViewPage from "./NutritionPlanViewPage";
import { ResumeWorkoutCard } from "./components/ResumeWorkoutCard";

type Tab = "treino" | "alimentacao";

export default function MeuPlanoPage() {
  const [tab, setTab] = useState<Tab>("treino");

  return (
    <div>
      {/* Treino em andamento: a Ficha é o outro lugar por onde se volta ao
          treino, e "Iniciar treino" aqui apareceria como se nada estivesse
          aberto (SPEC mobile §22). */}
      <div className="resume-workout-slot">
        <ResumeWorkoutCard />
      </div>
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
              // 44px: são as abas que trocam Treino ↔ Alimentação, navegação
              // primária desta tela, e mediam 41px (SPEC §8).
              minHeight: 44,
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
