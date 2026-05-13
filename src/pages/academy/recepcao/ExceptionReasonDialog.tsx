import { useState } from "react";

interface ExceptionReasonDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function ExceptionReasonDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: ExceptionReasonDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <div className="drawer-overlay" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="drawer-panel" style={{ maxWidth: 460 }}>
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <div>
            <div className="dash-eyebrow">Auditoria obrigatória</div>
            <h2 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>{title}</h2>
            <p className="small muted" style={{ marginTop: "var(--space-2)" }}>{description}</p>
          </div>
          <div className="field">
            <label className="label">Motivo</label>
            <textarea
              autoFocus
              className="input"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: autorizado pelo gestor, pagamento em negociação, visitante agendado..."
            />
            <span className="field-hint">Mínimo 10 caracteres · salvo na auditoria da academia.</span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              className="btn btn-primary"
              disabled={reason.trim().length < 10}
              onClick={() => onConfirm(reason.trim())}
            >
              {confirmLabel}
            </button>
            <button className="btn btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
