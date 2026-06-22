import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmação estilizado. Substitui window.confirm() nativo,
 * mantendo a mesma semântica (bloqueia ação até decisão) sem quebrar a
 * identidade visual premium do CoreFit.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--space-4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
          maxWidth: 440,
          width: "100%",
          boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))",
        }}
      >
        <p
          id="confirm-dialog-title"
          style={{
            margin: 0,
            fontWeight: "var(--font-semibold)",
            fontSize: "var(--text-base)",
            color: "var(--color-text)",
            lineHeight: 1.4,
          }}
        >
          {title}
        </p>
        {message && (
          <p
            style={{
              margin: "var(--space-2) 0 0",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
        <div
          style={{
            marginTop: "var(--space-5)",
            display: "flex",
            gap: "var(--space-2)",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
