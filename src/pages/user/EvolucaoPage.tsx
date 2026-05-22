import { useState } from "react";
import MetabolicStatePage from "./MetabolicStatePage";
import ActivityTrackerPage from "./ActivityTrackerPage";

type Tab = "metabolismo" | "atividades";

const TAB_LABEL: Record<Tab, string> = {
  metabolismo: "Metabolismo",
  atividades: "Atividades",
};

export default function EvolucaoPage() {
  const [tab, setTab] = useState<Tab>("metabolismo");

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
        {(["metabolismo", "atividades"] as Tab[]).map((t) => (
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
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "metabolismo" && <MetabolicStatePage />}
      {tab === "atividades" && <ActivityTrackerPage />}
    </div>
  );
}
