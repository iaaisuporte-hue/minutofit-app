import { useState } from 'react';
import { COLORS } from '../../styles/colors';

interface Props {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Se preenchido, exibe um campo de texto opcional (ex: motivo da recusa) */
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  reasonPlaceholder,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          maxWidth: 380,
          width: '100%',
          padding: 20,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          id="confirm-modal-title"
          style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: description || reasonPlaceholder ? 8 : 16 }}
        >
          {title}
        </div>
        {description && (
          <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5, marginBottom: 16 }}>
            {description}
          </div>
        )}
        {reasonPlaceholder && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder={reasonPlaceholder}
            rows={3}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelDeep,
              color: COLORS.text,
              fontSize: 13,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 6,
              fontFamily: 'inherit',
            }}
          />
        )}
        {reasonPlaceholder && (
          <div style={{ fontSize: 11, color: COLORS.muted, textAlign: 'right', marginBottom: 12 }}>
            {reason.length}/200
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: 'transparent',
              color: COLORS.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm(reasonPlaceholder ? reason.trim() || undefined : undefined)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: 'none',
              background: destructive ? COLORS.danger : COLORS.primary,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
