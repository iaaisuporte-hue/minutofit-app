/**
 * MinutoFit shared color palette.
 * Every value is a CSS custom-property reference so it automatically
 * picks up the daltonic-mode override without any JavaScript.
 *
 * Replace every local `const COLORS = { ... }` block with:
 *   import { COLORS } from "../../styles/colors";
 * (adjust the relative path to match the file's depth)
 */
export const COLORS = {
  /* ── Borders ──────────────────────────────── */
  border:           "var(--color-border)",
  borderStrong:     "var(--color-border-strong)",

  /* ── Text ─────────────────────────────────── */
  text:             "var(--color-text)",
  muted:            "var(--color-text-muted)",
  mutedSoft:        "var(--color-text-subtle)",
  muted2:           "var(--color-text-subtle)",

  /* ── Surfaces ─────────────────────────────── */
  panel:            "var(--color-surface)",
  card:             "var(--color-surface)",
  cardHover:        "var(--color-surface-raised)",
  panelDeep:        "var(--color-surface-raised)",
  panelSoft:        "var(--color-primary-soft)",
  freeSoft:         "var(--color-surface-raised)",
  freeBorder:       "var(--color-border)",

  /* ── Brand ────────────────────────────────── */
  primary:          "var(--color-primary)",
  primarySoft:      "var(--color-primary-soft)",
  primaryBorder:    "var(--color-border-primary)",
  highlight:        "var(--color-primary-hover)",
  highlightSoft:    "var(--color-primary-soft)",
  lime:             "var(--color-primary)",
  green:            "var(--color-primary)",
  deep:             "var(--color-primary-deep)",

  /* ── Danger / Red ─────────────────────────── */
  danger:           "var(--color-danger)",
  dangerSoft:       "var(--color-danger-soft)",
  dangerBg:         "var(--color-danger-soft)",
  dangerBorder:     "var(--color-danger-border)",
  redSoft:          "var(--color-danger-soft)",
  redBorder:        "var(--color-danger-border)",

  /* ── Warning / Yellow / Orange ────────────── */
  warnSoft:         "var(--color-warn-soft)",
  warnBg:           "var(--color-warn-soft)",
  warnBorder:       "var(--color-warn-border)",
  yellowSoft:       "var(--color-warn-soft)",
  yellowBorder:     "var(--color-warn-border)",
  orangeSoft:       "var(--color-warn-soft)",
  orangeBorder:     "var(--color-warn-border)",

  /* ── Success / Green tones ────────────────── */
  successBg:        "var(--color-success-soft)",
  successBorder:    "var(--color-success-border)",
  greenSoft:        "var(--color-success-soft)",
  greenBorder:      "var(--color-success-border)",
  greenSoftStrong:  "var(--color-primary-soft-strong)",

  /* ── Info / Blue ──────────────────────────── */
  blueBg:           "var(--color-info-soft)",
  blueBorder:       "var(--color-info-border)",
} as const;

export type ColorKey = keyof typeof COLORS;
