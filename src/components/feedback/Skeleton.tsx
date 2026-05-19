import "../../pages/personal/personalPremium.css";

type SkeletonProps = {
  variant?: "text" | "text-sm" | "text-lg" | "chip" | "circle" | "block";
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

export function Skeleton({ variant = "text", width, height, className, style }: SkeletonProps) {
  const variantClass = variant === "block" ? "" : `pp-skeleton--${variant}`;
  const cls = ["pp-skeleton", variantClass, className].filter(Boolean).join(" ");
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cls}
      style={{
        ...(width !== undefined ? { width } : null),
        ...(height !== undefined ? { height } : null),
        ...style,
      }}
    />
  );
}

/** Linha de aluno (avatar + 2 linhas + chip à direita). Premium "row loading". */
export function SkeletonStudentRow() {
  return (
    <div className="pp-skeleton-row" aria-hidden="true">
      <Skeleton variant="circle" width={36} height={36} />
      <div className="pp-skeleton-row__content">
        <Skeleton variant="text-lg" width="60%" />
        <Skeleton variant="text-sm" width="35%" />
      </div>
      <Skeleton variant="chip" />
    </div>
  );
}

/** Card de painel com header + 3 linhas de texto. */
export function SkeletonPanelCard() {
  return (
    <div className="pp-skeleton-card" aria-hidden="true">
      <Skeleton variant="text-lg" width="45%" />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="75%" />
      <Skeleton variant="text-sm" width="50%" />
    </div>
  );
}

/**
 * Lista de N rows premium — uso típico em loading do dashboard / consulting.
 * Inclui `aria-busy` no wrapper para leitores de tela.
 */
export function SkeletonStudentList({ rows = 4, label = "Carregando alunos" }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonStudentRow key={i} />
      ))}
    </div>
  );
}
