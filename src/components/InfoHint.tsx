import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  termo: string;
  resumo: string;
  impacto: string;
  saibaMaisHref?: string;
}

export function InfoHint({ termo, resumo, impacto, saibaMaisHref }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; placement: "top" | "bottom" } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      if (e instanceof MouseEvent && tooltipRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const width = 280;
      const margin = 12;
      const left = Math.min(
        window.innerWidth - width - margin,
        Math.max(margin, rect.left + rect.width / 2 - width / 2)
      );
      const placement = rect.top > 190 ? "top" : "bottom";
      const top = placement === "top" ? rect.top - 8 : rect.bottom + 8;

      setPosition({ left, top, placement });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`O que é ${termo}?`}
        // A bolinha continua com 16px: ela é inline, no meio de um rótulo, e
        // crescer empurraria o texto. O que muda é a ÁREA DE TOQUE — a classe
        // projeta um alvo invisível de 44px em volta (SPEC §8). Sem isso o alvo
        // real era 16×16, o menor do app inteiro.
        className="hit-target-44"
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

      {open && position && createPortal(
        <div
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          aria-label={`Explicação: ${termo}`}
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            transform: position.placement === "top" ? "translateY(-100%)" : undefined,
            zIndex: 9999,
            width: 280,
            maxWidth: "calc(100% - 24px)",
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
        </div>,
        document.body
      )}
    </span>
  );
}
