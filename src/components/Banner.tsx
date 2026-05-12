import { type ReactNode } from "react";

type Variant = "success" | "error" | "warn" | "info";

interface Props {
  variant: Variant;
  title?: string;
  description?: ReactNode;
  onClose?: () => void;
}

const CSS_CLASS: Record<Variant, string> = {
  success: "banner-success",
  error: "banner-error",
  warn: "",   // sem classe dedicada, usa tokens inline
  info: "",   // idem
};

const INLINE_STYLES: Record<Variant, React.CSSProperties> = {
  success: {},
  error: {},
  warn: {
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-warn-border)",
    background: "var(--color-warn-soft)",
    color: "var(--color-warn-text)",
    fontSize: "var(--text-sm)",
    lineHeight: "1.5",
  },
  info: {
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-info-border)",
    background: "var(--color-info-soft)",
    color: "var(--color-info-text)",
    fontSize: "var(--text-sm)",
    lineHeight: "1.5",
  },
};

/**
 * Banner de feedback — wrap de `.banner-success`/`.banner-error` de components.css;
 * variantes `warn` e `info` usam tokens diretamente (sem nova classe CSS).
 */
export function Banner({ variant, title, description, onClose }: Props) {
  const cssClass = CSS_CLASS[variant];
  const inlineStyle = INLINE_STYLES[variant];

  const content = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
      <div>
        {title && <strong style={{ display: "block" }}>{title}</strong>}
        {description && <span>{description}</span>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            opacity: 0.6,
            fontSize: "var(--text-lg)",
            lineHeight: 1,
            padding: 0,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );

  if (cssClass) {
    return <div className={cssClass}>{content}</div>;
  }
  return <div style={inlineStyle}>{content}</div>;
}
