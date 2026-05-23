import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { ConsentEntry, ConsentScope, ProfessionalRole } from './types';
import { SCOPE_LABELS } from './types';
import { listConsents, revokeConsent } from './api';
import { Toast } from './Toast';

interface Props {
  professionalId: number;
  professionalRole: ProfessionalRole;
  professionalName: string;
  revoking: boolean;
  onRevoke: () => void;
  onClose: () => void;
}

export function ConsentScopeManager({
  professionalId,
  professionalRole,
  professionalName,
  revoking,
  onRevoke,
  onClose,
}: Props) {
  const [consents, setConsents] = useState<ConsentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingScope, setTogglingScope] = useState<ConsentScope | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConsents(professionalId, professionalRole);
      setConsents(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [professionalId, professionalRole]);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (scope: ConsentScope, currentStatus: string) => {
    if (currentStatus !== 'granted') return; // só pode revogar
    setTogglingScope(scope);
    try {
      await revokeConsent(professionalId, professionalRole, scope);
      setConsents((prev) =>
        prev.map((c) => (c.scope === scope ? { ...c, status: 'revoked', revokedAt: new Date().toISOString() } : c))
      );
    } catch {
      setErrorMsg('Não foi possível alterar a permissão.');
    } finally {
      setTogglingScope(null);
    }
  };

  const grantedCount = consents.filter((c) => c.status === 'granted').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 0,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: COLORS.panel,
          borderRadius: '12px 12px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{professionalName}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              {grantedCount} dado{grantedCount !== 1 ? 's' : ''} compartilhado{grantedCount !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              color: COLORS.muted,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '16px', color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>
              Carregando permissões…
            </div>
          )}
          {!loading &&
            consents.map((c) => (
              <div
                key={c.scope}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: `1px solid ${COLORS.border}`,
                  opacity: c.status === 'revoked' ? 0.5 : 1,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                    {SCOPE_LABELS[c.scope] ?? c.scope}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>
                    {c.status === 'granted' ? 'Compartilhado' : 'Bloqueado'}
                  </div>
                </div>
                {/* Toggle visual (sem library — só um checkbox estilizado) */}
                <button
                  type="button"
                  disabled={c.status !== 'granted' || togglingScope !== null}
                  onClick={() => void handleToggle(c.scope, c.status)}
                  aria-label={c.status === 'granted' ? `Revogar ${SCOPE_LABELS[c.scope]}` : `${SCOPE_LABELS[c.scope]} bloqueado`}
                  style={{
                    width: 38,
                    height: 22,
                    borderRadius: 11,
                    background: c.status === 'granted' ? COLORS.primary : COLORS.borderStrong,
                    border: 'none',
                    cursor: c.status === 'granted' ? 'pointer' : 'default',
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: c.status === 'granted' ? 18 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>
            ))}
        </div>

        <div style={{ padding: '12px 16px 20px' }}>
          <button
            type="button"
            disabled={revoking}
            onClick={onRevoke}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: `1px solid ${COLORS.dangerBorder}`,
              background: COLORS.dangerSoft,
              color: COLORS.danger,
              fontSize: 13,
              fontWeight: 600,
              cursor: revoking ? 'not-allowed' : 'pointer',
              opacity: revoking ? 0.6 : 1,
            }}
          >
            {revoking ? 'Encerrando…' : 'Encerrar acompanhamento'}
          </button>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, textAlign: 'center', lineHeight: 1.5 }}>
            O profissional perderá acesso a todos os dados imediatamente.
          </div>
        </div>
      </div>
      {errorMsg && <Toast message={errorMsg} kind="error" onDismiss={() => setErrorMsg(null)} />}
    </div>
  );
}
