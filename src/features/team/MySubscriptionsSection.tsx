import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { OfferingPeriod, StudentSubscription, SubscriptionStatus } from './types';
import { cancelMySubscription, listMySubscriptions } from './api';
import { ConfirmModal } from './ConfirmModal';
import { Toast } from './Toast';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  active: 'Ativo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

const STATUS_COLOR: Record<SubscriptionStatus, string> = {
  pending_payment: 'var(--color-warn,#f59e0b)',
  active: 'var(--color-success,#22C55E)',
  paused: 'var(--color-warn,#f59e0b)',
  cancelled: 'var(--color-text-muted)',
  expired: 'var(--color-text-muted)',
};

const PERIOD_LABEL: Record<OfferingPeriod, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export function MySubscriptionsSection() {
  const [subs, setSubs] = useState<StudentSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState<StudentSubscription | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMySubscriptions();
      setSubs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const visible = subs.filter((s) => s.status !== 'cancelled' && s.status !== 'expired');

  const handleCancelConfirmed = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      await cancelMySubscription(confirmCancel.id);
      setConfirmCancel(null);
      setToast({ message: 'Assinatura cancelada.', kind: 'success' });
      await reload();
    } catch {
      setToast({ message: 'Não foi possível cancelar. Tente novamente.', kind: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return null;
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px 8px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
          Minhas assinaturas
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted }}>Planos pagos contratados pela rede</div>
      </div>

      <div>
        {visible.map((s) => {
          const role = s.professionalRole === 'personal' ? 'Personal' : 'Nutricionista';
          return (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '12px 16px',
                borderBottom: `1px solid ${COLORS.border}`,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{role}</span>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: STATUS_COLOR[s.status],
                      padding: '1px 6px',
                      border: `1px solid ${STATUS_COLOR[s.status]}`,
                      borderRadius: 4,
                    }}
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {formatPrice(s.priceCentsSnapshot)} · {PERIOD_LABEL[s.periodSnapshot]}
                  {s.nextChargeAt && s.status === 'active' && (
                    <> · próxima cobrança {formatDate(s.nextChargeAt)}</>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmCancel(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: 'transparent',
                  color: COLORS.muted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Cancelar
              </button>
            </div>
          );
        })}
      </div>

      {confirmCancel && (
        <ConfirmModal
          title="Cancelar assinatura?"
          description="Você perde acesso ao acompanhamento imediatamente e a cobrança futura é suspensa. Sem reembolso do ciclo atual."
          confirmLabel="Cancelar assinatura"
          destructive
          loading={cancelling}
          onConfirm={() => void handleCancelConfirmed()}
          onCancel={() => setConfirmCancel(null)}
        />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />}
    </div>
  );
}
