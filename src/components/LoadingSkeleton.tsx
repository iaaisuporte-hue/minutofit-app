type Variant = "list" | "card" | "metric";

interface Props {
  /** Número de barras de skeleton. Sobrescreve `variant`. */
  lines?: number;
  variant?: Variant;
}

const HEIGHTS: Record<string, number[]> = {
  list: [20, 20, 20, 20],
  card: [120, 16, 12],
  metric: [40, 14],
};

/**
 * Skeleton de carregamento — wrap das classes `.dash-skeleton*` de components.css.
 */
export function LoadingSkeleton({ lines, variant = "list" }: Props) {
  const heights = lines
    ? Array(lines).fill(16)
    : HEIGHTS[variant];

  return (
    <div className="dash-skeleton" role="status" aria-label="Carregando…">
      {heights.map((h, i) => (
        <div
          key={i}
          className="dash-skeleton-bar"
          style={{ height: h, width: i === 0 ? "100%" : `${85 - i * 8}%` }}
        />
      ))}
    </div>
  );
}
