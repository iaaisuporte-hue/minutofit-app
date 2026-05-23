import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { ProfessionalRequest, ProfessionalRole } from './types';
import { SCOPE_LABELS } from './types';
import { listIncomingRequests, acceptRequest, rejectRequest } from './api';
import { ConfirmModal } from './ConfirmModal';
import { Toast } from './Toast';

interface Props {
  role: ProfessionalRole;
  onCountChange?: (count: number) => void;
}

export function IncomingRequestsPanel({ role, onCountChange }: Props) {
  const [requests, setRequests] = useState<ProfessionalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ProfessionalRequest | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listIncomingRequests(role);
      setRequests(data);
      onCountChange?.(data.length);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [role, onCountChange]);

  useEffect(() => { void load(); }, [load]);

  const handleAccept = async (req: ProfessionalRequest) => {
    setProcessing(req.id);
    try {
      await acceptRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      onCountChange?.(requests.length - 1);
      setToast({ message: `${req.studentName ?? 'Aluno'} adicionado(a) à sua carteira.`, kind: 'success' });
    } catch {
      setToast({ message: 'Não foi possível aceitar a solicitação.', kind: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectConfirmed = async (reason?: string) => {
    if (!rejectTarget) return;
    const req = rejectTarget;
    setProcessing(req.id);
    try {
      await rejectRequest(req.id, reason);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      onCountChange?.(requests.length - 1);
      setRejectTarget(null);
      setToast({ message: 'Solicitação recusada.', kind: 'success' });
    } catch {
      setToast({ message: 'Não foi possível recusar a solicitação.', kind: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>
        Carregando solicitações…
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: COLORS.muted }}>Nenhuma solicitação pendente.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: '4px 0' }}>
      {requests.map((req) => (
        <div
          key={req.id}
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: '14px 16px',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                {req.studentName ?? `Aluno #${req.studentId}`}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                {req.studentEmail} · via {req.requestedVia}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: COLORS.muted,
                flexShrink: 0,
              }}
            >
              {new Date(req.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>

          {req.message && (
            <div
              style={{
                padding: '8px 10px',
                background: COLORS.panelDeep,
                borderRadius: 6,
                fontSize: 13,
                color: COLORS.muted,
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}
            >
              "{req.message}"
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Dados solicitados
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {req.requestedScopes.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 100,
                    background: COLORS.panelDeep,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 11,
                    color: COLORS.muted,
                  }}
                >
                  {SCOPE_LABELS[s] ?? s}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={processing === req.id}
              onClick={() => setRejectTarget(req)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 7,
                border: `1px solid ${COLORS.border}`,
                background: 'transparent',
                color: COLORS.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: processing === req.id ? 'not-allowed' : 'pointer',
                opacity: processing === req.id ? 0.6 : 1,
              }}
            >
              Recusar
            </button>
            <button
              type="button"
              disabled={processing === req.id}
              onClick={() => void handleAccept(req)}
              style={{
                flex: 2,
                padding: '8px',
                borderRadius: 7,
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: processing === req.id ? 'not-allowed' : 'pointer',
                opacity: processing === req.id ? 0.6 : 1,
              }}
            >
              {processing === req.id ? 'Processando…' : 'Aceitar aluno'}
            </button>
          </div>
        </div>
      ))}

      {rejectTarget && (
        <ConfirmModal
          title={`Recusar solicitação de ${rejectTarget.studentName ?? 'aluno'}?`}
          description="O aluno poderá tentar novamente em 7 dias."
          confirmLabel="Recusar"
          destructive
          loading={processing === rejectTarget.id}
          reasonPlaceholder="Motivo (opcional, visível ao aluno)"
          onConfirm={(reason) => void handleRejectConfirmed(reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />}
    </div>
  );
}
