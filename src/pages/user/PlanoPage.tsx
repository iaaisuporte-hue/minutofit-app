import { useState } from "react";
import { useTodayUserState } from "./hooks/useTodayUserState";
import MyWorkoutPlansPage from "./MyWorkoutPlansPage";
import SuggestedTrainingPage from "./SuggestedTrainingPage";
import TreinosPage from "./TreinosPage";

type Tab = "hoje" | "historico";

export default function PlanoPage() {
  const [tab, setTab] = useState<Tab>("hoje");
  const todayState = useTodayUserState();
  const hasPersonalPlan = todayState.hasActivePersonal && todayState.hasActiveWorkoutPlan;

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 20,
          gap: 0,
        }}
      >
        {(["hoje", "historico"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "var(--color-text)" : "var(--color-text-muted)",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "var(--color-accent-hover)" : "transparent"}`,
              cursor: "pointer",
              transition: "color 0.12s, border-color 0.12s",
              marginBottom: -1,
            }}
          >
            {t === "hoje" ? "De hoje" : "Histórico"}
          </button>
        ))}
      </div>

      {tab === "hoje" && (
        hasPersonalPlan ? <MyWorkoutPlansPage /> : <SuggestedTrainingPage />
      )}
      {tab === "historico" && <TreinosPage />}
    </div>
  );
}
