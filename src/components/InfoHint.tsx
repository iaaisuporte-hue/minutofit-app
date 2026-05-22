import { useEffect, useRef, useState } from "react";

interface Props {
  termo: string;
  resumo: string;
  impacto: string;
  saibaMaisHref?: string;
}

export function InfoHint({ termo, resumo, impacto, saibaMaisHref }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`O que é ${termo}?`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1.5px solid var(--color-border-strong)",
          background: "var(--color-surface)",
          color: "var(--color-text-muted)",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
          flexShrink: 0,
          transition: "border-color 0.12s, color 0.12s",
        }}
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          aria-label={`Explicação: ${termo}`}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            width: 260,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            padding: "14px 16px",
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            {termo}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.5 }}>
            {resumo}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              lineHeight: 1.45,
              borderTop: "1px solid var(--color-border)",
              paddingTop: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>Para você: </span>
            {impacto}
          </div>
          {saibaMaisHref && (
            <a
              href={saibaMaisHref}
              style={{
                fontSize: 12,
                color: "var(--color-accent-hover)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Ver no glossário →
            </a>
          )}
        </div>
      )}
    </span>
  );
}
