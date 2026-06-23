// Card de engajamento semanal — celebra a consistência SEM manipular.
// Tom do produto (MaaS): cuidado, não pressão. Por isso o estado "forte"
// lembra a recuperação (anti-overtraining) em vez de empurrar mais treino,
// e o estado "zero" convida sem culpar. Emoji liberado (conteúdo reativo).

interface Props {
  workoutsThisWeek: number;
}

function resolveMessage(n: number): { emoji: string; title: string; sub: string; accent: string } {
  if (n <= 0) {
    return {
      emoji: "🌱",
      title: "Semana nova começando",
      sub: "Que tal o primeiro movimento? Seu corpo responde rápido.",
      accent: "rgba(8,145,178,.10)",
    };
  }
  if (n <= 2) {
    return {
      emoji: "🌿",
      title: `${n} treino${n > 1 ? "s" : ""} essa semana`,
      sub: "Bom começo — cada sessão constrói consistência.",
      accent: "rgba(8,145,178,.10)",
    };
  }
  if (n <= 4) {
    return {
      emoji: "🔥",
      title: `Parabéns! Você já treinou ${n} dias essa semana`,
      sub: "Mantenha o ritmo — sua evolução agradece.",
      accent: "rgba(34,197,94,.12)",
    };
  }
  return {
    emoji: "💪",
    title: `Semana forte: ${n} treinos`,
    sub: "Respeite a recuperação — descanso também é progresso.",
    accent: "rgba(245,158,11,.12)",
  };
}

export function WeeklyEngagementCard({ workoutsThisWeek }: Props) {
  const m = resolveMessage(workoutsThisWeek);
  return (
    <div
      className="today-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 16,
        background: m.accent,
        border: "1px solid var(--color-border, #E5E7EB)",
        borderRadius: 16,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: 26,
          lineHeight: 1,
          flexShrink: 0,
          width: 44,
          height: 44,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          background: "var(--color-surface, #FFFFFF)",
          border: "1px solid var(--color-border, #E5E7EB)",
        }}
      >
        {m.emoji}
      </div>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text, #0A130D)" }}>{m.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--color-text-muted, #6B7280)" }}>{m.sub}</div>
      </div>
    </div>
  );
}
