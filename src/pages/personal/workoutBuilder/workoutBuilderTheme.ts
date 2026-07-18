/** Workout builder tokens aligned with `src/styles/theme.css` (CoreFit shell). */
export const WB = {
  text: "var(--color-text-primary)",
  muted: "var(--color-text-secondary)",
  muted2: "var(--color-text-subtle)",
  border: "rgba(71, 85, 105, 0.22)",
  borderStrong: "rgba(51, 65, 85, 0.32)",
  card: "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-raised) 100%)",
  panel: "var(--color-surface)",
  primary: "var(--color-primary)",
  primarySoft: "var(--color-primary-soft)",
  primaryBorder: "var(--color-border-primary)",
  /* Fundo de CTA com texto branco: oliva DEEP (WCAG AA 4.84:1). Nunca usar
     --color-primary (oliva vibrante, 3.0:1 com branco) como fundo de CTA. */
  ctaBg: "var(--action-primary)",
  ctaText: "var(--color-white)",
  shadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
  danger: "var(--color-danger)",
  success: "var(--color-success)",
  bgDeep: "var(--color-surface-raised)",
} as const;
