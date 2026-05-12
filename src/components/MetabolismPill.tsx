import { Link } from "react-router-dom";
import { useMetabolism } from "../features/metabolism/useMetabolism";
import type { MetabolicTrend } from "../features/metabolism/metabolism.types";

const TREND_ICON: Record<MetabolicTrend, string> = {
  up: "↑",
  down: "↓",
  stable: "→",
};

const TREND_COLOR: Record<MetabolicTrend, string> = {
  up: "var(--color-success)",
  down: "var(--color-danger)",
  stable: "var(--color-text-muted)",
};

/**
 * Chip pequeno que mostra score metabólico + tendência no sidebar do aluno.
 * Clique navega para /app/user/today.
 * Silencioso quando dados não estão disponíveis.
 */
export function MetabolismPill() {
  const { data, loading } = useMetabolism();

  if (loading || !data) return null;

  const trendIcon = TREND_ICON[data.trend];
  const trendColor = TREND_COLOR[data.trend];

  return (
    <Link
      to="/app/user/today"
      title="Ver resumo metabólico"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-raised)",
        textDecoration: "none",
        color: "var(--color-text)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-semibold)",
        lineHeight: 1,
        transition: "border-color var(--transition-fast)",
      }}
    >
      <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>Metabolismo</span>
      <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{data.score}</span>
      <span style={{ color: trendColor, fontWeight: 700 }}>{trendIcon}</span>
    </Link>
  );
}
