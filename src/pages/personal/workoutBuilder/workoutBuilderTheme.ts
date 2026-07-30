/** Workout builder tokens aligned with `src/styles/theme.css` (S2Core shell). */
export const WB = {
  text: "var(--color-text-primary)",
  muted: "var(--color-text-secondary)",
  muted2: "var(--color-text-subtle)",
  border: "var(--color-border)",
  borderStrong: "var(--color-border-strong)",
  card: "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-raised) 100%)",
  panel: "var(--color-surface)",
  primary: "var(--color-primary)",
  primarySoft: "var(--color-primary-soft)",
  primaryBorder: "var(--color-border-primary)",
  /* Fundo de CTA com texto branco: oliva DEEP (WCAG AA 4.84:1). Nunca usar
     --color-primary (oliva vibrante, 3.0:1 com branco) como fundo de CTA. */
  ctaBg: "var(--action-primary)",
  ctaText: "var(--color-white)",
  shadow: "var(--shadow-sm)",
  danger: "var(--color-danger)",
  success: "var(--color-success)",
  bgDeep: "var(--color-surface-raised)",
} as const;
