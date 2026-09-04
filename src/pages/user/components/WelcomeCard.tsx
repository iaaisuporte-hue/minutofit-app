import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import type { FirstRunState } from "./firstRunStorage";

interface Props {
  firstName: string;
  state: FirstRunState;
  /** Treinos registrados nesta semana (Seg–Dom). Alimenta o reconhecimento. */
  workoutsThisWeek: number;
}

const GREETING = (h: number) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");

/**
 * Mensagem de engajamento CALIBRADA pelo dia da semana — o ponto-chave: não
 * cobrar cedo. Comparamos os treinos da semana com uma expectativa pró-rata
 * (alvo de 4/semana distribuído pelos dias já decorridos). Assim, 1 treino na
 * segunda é "no ritmo"; 1 treino no sábado é "dá pra retomar". Tom Wellness:
 * celebra, calibra, nunca pune; no excesso, lembra recuperação.
 */
function resolveEngagement(n: number, date: Date): { emoji: string; text: string } {
  const dow = date.getDay();               // 0=Dom .. 6=Sáb
  const daysElapsed = dow === 0 ? 7 : dow;  // semana Seg(1) .. Dom(7)
  const WEEKLY_GOAL = 4;
  const expectedByNow = Math.max(1, Math.round((WEEKLY_GOAL * daysElapsed) / 7));
  const treinos = (k: number) => (k === 1 ? "1 treino" : `${k} treinos`);

  // Excesso — independente do dia: cuidar > empurrar.
  if (n >= 7) {
    return { emoji: "💪", text: `Você está mandando muito bem — já são ${treinos(n)} essa semana. Respeite a recuperação: descanso também é progresso.` };
  }
  // Nenhum treino — calibrado por quão avançada está a semana.
  if (n <= 0) {
    return daysElapsed <= 2
      ? { emoji: "🌱", text: "A semana está começando — que tal abrir com um treino leve hoje?" }
      : { emoji: "🌙", text: "A semana rendeu menos até aqui, e tudo bem. Um movimento hoje já reativa o ritmo." };
  }
  // Acima do esperado pra esta altura da semana.
  if (n >= expectedByNow + 1) {
    return { emoji: "🔥", text: `Você está voando: ${treinos(n)} e a semana ainda nem acabou. Ritmo acima do esperado — continue na pegada!` };
  }
  // No ritmo (atende a expectativa pró-rata) — inclui "1 treino na segunda".
  if (n >= expectedByNow) {
    return { emoji: "🔥", text: `Você está indo muito bem — já ${n === 1 ? "foi 1 treino" : `foram ${n} treinos`} essa semana. Continue na pegada!` };
  }
  // Abaixo do esperado — sem cobrança no começo da semana.
  return daysElapsed <= 2
    ? { emoji: "🌿", text: `${n === 1 ? "Foi 1 treino" : `Foram ${n} treinos`} e a semana mal começou — você está no caminho.` }
    : { emoji: "🌿", text: `${n === 1 ? "Foi 1 treino" : `Foram ${n} treinos`} essa semana. Ainda dá tempo de retomar o ritmo — que tal hoje?` };
}

export function WelcomeCard({ firstName, state, workoutsThisWeek }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile(720);
  const now = new Date();
  const profilePending = !state.profileDone;
  const engagement = resolveEngagement(workoutsThisWeek, now);
  const title = profilePending ? `Bem-vindo, ${firstName}` : `${GREETING(now.getHours())}, ${firstName}`;

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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            aria-hidden="true"
            style={{
              fontSize: 24,
              lineHeight: 1,
              flexShrink: 0,
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              background: "var(--color-bg-main)",
              border: "1px solid var(--color-border)",
            }}
          >
            {engagement.emoji}
          </div>
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {profilePending ? "Primeiros passos" : "Sua semana"}
            </div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: "var(--color-text)" }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {engagement.text}
            </div>
          </div>
        </div>

        {/* Passo de perfil — único onboarding não-óbvio (o check-in tem card próprio). */}
        {profilePending && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--color-bg-main)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ flex: 1, display: "grid", gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                Configure seu perfil de treino
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                Leva 2 minutos e ajusta as sugestões para a sua rotina real.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/user/onboarding")}
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
              className="hit-target-44"
            >
              Configurar agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
