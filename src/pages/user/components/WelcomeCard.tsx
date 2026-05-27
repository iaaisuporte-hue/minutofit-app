import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import type { FirstRunState } from "./firstRunStorage";

interface Props {
  firstName: string;
  state: FirstRunState;
  onGoToCheckin: () => void;
}

type Marco = {
  label: string;
  descricao: string;
  done: boolean;
  cta: string;
  onClick: () => void;
};

export function WelcomeCard({ firstName, state, onGoToCheckin }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile(720);
  const concluidos = [state.checkinDone, state.profileDone].filter(Boolean).length;

  // Todos concluídos → card desaparece (chamador controla isso)
  if (concluidos === 2) return null;

  const marcos: Marco[] = [
    {
      label: "Conte como você está hoje",
      descricao: "O check-in diário é o primeiro sinal que o MetaCore usa para adaptar tudo.",
      done: state.checkinDone,
      cta: "Fazer check-in",
      onClick: onGoToCheckin,
    },
    {
      label: "Configure seu perfil de treino",
      descricao: "Leva 2 minutos e ajusta as sugestões para a sua rotina real.",
      done: state.profileDone,
      cta: "Configurar agora",
      onClick: () => navigate("/app/user/onboarding"),
    },
  ];

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 3, background: "var(--gradient-primary)" }} />
      <div style={{ padding: isMobile ? 16 : 20, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Primeiros passos
          </div>
          <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: "var(--color-text)" }}>
            Bem-vindo, {firstName}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            O MetaCore aprende com você. A cada check-in, ele entende melhor seu
            corpo e ajusta o que vem pela frente.
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {marcos.map((marco, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: marco.done
                  ? "var(--color-success-soft)"
                  : "var(--color-bg-main)",
                border: `1px solid ${marco.done ? "var(--color-success-border)" : "var(--color-border)"}`,
                opacity: marco.done ? 0.7 : 1,
              }}
            >
              {/* Indicador de passo */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: marco.done
                    ? "var(--color-success-text)"
                    : "var(--color-border-strong)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {marco.done ? "✓" : idx + 1}
              </div>

              <div style={{ flex: 1, display: "grid", gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                  {marco.label}
                </div>
                {!marco.done && (
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                    {marco.descricao}
                  </div>
                )}
              </div>

              {!marco.done && (
                <button
                  type="button"
                  onClick={marco.onClick}
                  style={{
                    flexShrink: 0,
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--color-border-strong)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {marco.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "var(--color-text-subtle)", textAlign: "center" }}>
          {concluidos}/2 concluídos — esse card desaparece quando você terminar.
        </div>
      </div>
    </div>
  );
}
