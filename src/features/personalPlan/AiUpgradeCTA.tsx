import { Sparkles } from "lucide-react";
import { usePlan } from "./usePlan";

export function AiUpgradeCTA() {
  const plan = usePlan();

  if (plan.aiEnabled) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: "20px 16px",
        border: "1px dashed rgba(99,102,241,0.35)",
        borderRadius: 10,
        background: "rgba(99,102,241,0.04)",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(99,102,241,0.1)",
            color: "rgb(99,102,241)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <Sparkles size={11} />
          Plano Pro
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
        Resumo IA disponível no plano Pro
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        Síntese contextual da evolução do aluno — gerada sob demanda com base em aderência,
        metabolismo e histórico de treinos.
      </div>
      <a
        href="mailto:suporte@minutofit.com.br?subject=Upgrade%20para%20Pro"
        style={{
          display: "inline-block",
          alignSelf: "center",
          padding: "8px 18px",
          borderRadius: 8,
          background: "rgb(99,102,241)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Ver planos
      </a>
    </div>
  );
}
