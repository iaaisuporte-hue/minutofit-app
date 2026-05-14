import React, { useMemo, useState } from "react";
import { WB } from "./workoutBuilderTheme";
import { WbButton } from "./WorkoutBuilderUi";
import type { ProtocolSuggestion } from "../../../services/workoutProtocolsApi";

type Props = {
  protocolSuggestions: ProtocolSuggestion[];
  suggestionsLoading: boolean;
  aiLoading: boolean;
  onGenerate: (prompt: string) => void;
  onLoadProtocol: (id: number) => void;
};

const AI_QUICK_PROMPTS = [
  "Treino ABC para iniciante focado em hipertrofia, 4 dias por semana",
  "Plano de perna intermediário com técnica de drop set",
  "Treino full body 3 dias para emagrecimento com pausas curtas",
];

export function QuickStartCard({
  protocolSuggestions,
  suggestionsLoading,
  aiLoading,
  onGenerate,
  onLoadProtocol,
}: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "protocols">("ai");
  const [aiPrompt, setAiPrompt] = useState("");

  const inputS: React.CSSProperties = {
    minHeight: 34,
    padding: "7px 10px",
    borderRadius: 8,
    border: `1px solid ${WB.border}`,
    background: "rgba(255,255,255,0.85)",
    color: WB.text,
    outline: "none",
    fontSize: 13,
    boxSizing: "border-box",
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "7px 12px",
    border: "none",
    borderBottom: `2px solid ${active ? WB.primary : "transparent"}`,
    background: "none",
    color: active ? WB.text : WB.muted,
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s",
  });

  const protocolCount = protocolSuggestions.length;
  const tabLabel = useMemo(
    () => (protocolCount > 0 ? `Carregar protocolo (${protocolCount})` : "Carregar protocolo"),
    [protocolCount]
  );

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${WB.border}`,
        background: "var(--color-surface, #F8FAFC)",
        overflow: "hidden",
        marginBottom: 4,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${WB.border}`,
          background: "rgba(248,250,252,0.8)",
        }}
      >
        <button type="button" style={tabBtn(activeTab === "ai")} onClick={() => setActiveTab("ai")}>
          Gerar com IA
        </button>
        <button type="button" style={tabBtn(activeTab === "protocols")} onClick={() => setActiveTab("protocols")}>
          {tabLabel}
        </button>
      </div>

      {/* Tab content */}
      <div style={{ padding: 14 }}>
        {activeTab === "ai" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: WB.muted, lineHeight: 1.4 }}>
              Descreva o treino — a IA monta a ficha semanal completa com base no catálogo de exercícios.
            </div>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Treino ABC para iniciante focado em hipertrofia, 4 dias por semana"
              rows={2}
              style={{
                ...inputS,
                width: "100%",
                minHeight: 60,
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: 13,
              }}
              maxLength={400}
              disabled={aiLoading}
            />

            {!aiPrompt.trim() ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {AI_QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => setAiPrompt(qp)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: `1px solid ${WB.border}`,
                      background: "rgba(255,255,255,0.7)",
                      color: WB.text,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 11,
                      lineHeight: 1.35,
                      textAlign: "left",
                      maxWidth: "100%",
                    }}
                    title="Usar este prompt"
                  >
                    {qp.length > 40 ? `${qp.slice(0, 38)}…` : qp}
                  </button>
                ))}
              </div>
            ) : null}

            <WbButton
              variant="primary"
              disabled={!aiPrompt.trim() || aiLoading}
              onClick={() => {
                onGenerate(aiPrompt);
                setAiPrompt("");
              }}
            >
              {aiLoading ? "Gerando ficha…" : "Gerar ficha com IA"}
            </WbButton>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {suggestionsLoading ? (
              <div style={{ color: WB.muted, fontSize: 13 }}>Carregando protocolos…</div>
            ) : protocolSuggestions.length === 0 ? (
              <div style={{ color: WB.muted, fontSize: 13 }}>
                Nenhuma sugestão automática para este perfil.
              </div>
            ) : (
              protocolSuggestions.map((s) => (
                <div
                  key={s.protocolId}
                  style={{
                    padding: "9px 11px",
                    borderRadius: 9,
                    border: `1px solid ${WB.border}`,
                    background: "#FFFFFF",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 13 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: WB.muted, marginTop: 1 }}>{s.reason}</div>
                  </div>
                  <WbButton
                    variant="ghost"
                    type="button"
                    onClick={() => onLoadProtocol(s.protocolId)}
                  >
                    Carregar
                  </WbButton>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
