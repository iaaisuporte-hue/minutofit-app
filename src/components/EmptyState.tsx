import { type ReactNode } from "react";

type Variant = "empty" | "ok" | "info" | "warning";

interface Props {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: Variant;
}

const DOT_COLORS: Record<Variant, string> = {
  empty: "var(--color-border)",
  ok: "var(--color-success)",
  info: "var(--color-primary)",
  warning: "var(--color-warn)",
};

/**
 * Estado vazio reutilizável — wrap das classes `.empty-state*` de components.css.
 *
 * Princípio MaaS: explique (1) por que está vazio, (2) quando será preenchido,
 * (3) qual valor aquele bloco entregará.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  action,
  variant = "empty",
}: Props) {
  return (
    <div className="empty-state">
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: DOT_COLORS[variant],
          display: "block",
        }}
      />
      {eyebrow && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--font-semibold)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          {eyebrow}
        </span>
      )}
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__body">{description}</p>}
      {action && <div style={{ marginTop: "var(--space-4)" }}>{action}</div>}
    </div>
  );
}
