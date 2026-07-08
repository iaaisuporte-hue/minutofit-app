// Chip de estado do treino — vocabulário ÚNICO e consistente em todos os
// pontos onde um treino aparece (personal, sugerido, academia). Resolve a
// confusão entre ficha planejada × sugerida × adaptada: um rótulo claro,
// sempre no mesmo lugar. (Passo 3 do redesign da Today.)

export type WorkoutChipState = "personal_base" | "adapted" | "suggested" | "academy";

const CHIPS: Record<WorkoutChipState, { label: string; bg: string; border: string }> = {
  personal_base: {
    label: "Plano base",
    bg: "var(--color-primary-soft, rgba(123,153,25,.10))",
    border: "rgba(123,153,25,.22)",
  },
  adapted: {
    // Âmbar: comunica "mudou por causa do seu check-in", não erro.
    label: "Ajustado pelo seu check-in",
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.30)",
  },
  suggested: {
    label: "Sugerido para hoje",
    bg: "var(--color-primary-soft, rgba(123,153,25,.10))",
    border: "rgba(123,153,25,.22)",
  },
  academy: {
    label: "Na sua academia",
    bg: "var(--color-primary-soft, rgba(123,153,25,.10))",
    border: "rgba(123,153,25,.22)",
  },
};

export function WorkoutStateChip({ state }: { state: WorkoutChipState }) {
  const c = CHIPS[state];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: "var(--color-text, #0A130D)",
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}
