import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";

export function EmptyMetabolismHero() {
  const isMobile = useIsMobile(720);
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-accent-border)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 4, background: "var(--color-surface-subtle)" }} />
      <div
        style={{
          padding: isMobile ? 18 : 22,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Estado metabólico
          </div>
          <div
            style={{
              fontSize: isMobile ? 18 : 21,
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.2,
            }}
          >
            Seu metabolismo, em breve aqui
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Ainda não temos sinais suficientes para mostrar seu estado. Faça seu
          primeiro check-in para o app começar a aprender com você.
        </div>

        <div
          style={{
            background: "var(--color-bg-main)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
            O que é o estado metabólico?{" "}
          </span>
          Uma leitura de quão ativo seu corpo está — considera sono, treino
          recente, alimentação e estresse. Sobe quando você se movimenta e
          dorme bem.
        </div>

        <button
          type="button"
          onClick={() => navigate("/app/user/glossario#checkin-metabolico")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-accent-hover)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Entender melhor os termos →
        </button>
      </div>
    </div>
  );
}
