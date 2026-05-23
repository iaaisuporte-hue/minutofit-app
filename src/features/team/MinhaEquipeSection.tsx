import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { ProfessionalRole, ProfessionalRequest } from './types';
import { listOutgoingRequests, revokeConnection } from './api';
import { AddProfessionalSheet } from './AddProfessionalSheet';
import { ConsentScopeManager } from './ConsentScopeManager';
import { ConfirmModal } from './ConfirmModal';
import { Toast } from './Toast';
import type { ProfessionalContext } from '../professionalVoice/useProfessionalContext';

interface Props {
  professionalContext: ProfessionalContext | null;
  contextLoading: boolean;
  /** se o aluno tem academia ativa — oculta o CTA de adicionar */
  hasAcademy: boolean;
  /** nome da academia, para mensagem explicativa */
  academyName?: string;
  onConnectionChanged: () => void;
  /** Quando true, omite o header próprio (usado dentro de MinhaEquipePage) */
  embedded?: boolean;
}

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

type ActivePanel = { professionalId: number; role: ProfessionalRole; name: string } | null;

export function MinhaEquipeSection({
  professionalContext,
  contextLoading,
  hasAcademy,
  academyName,
  onConnectionChanged,
  embedded = false,
}: Props) {
  const [showAddSheet, setShowAddSheet] = useState<ProfessionalRole | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [outgoingRequests, setOutgoingRequests] = useState<ProfessionalRequest[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{ professionalId: number; role: ProfessionalRole; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const reqs = await listOutgoingRequests();
      setOutgoingRequests(reqs.filter((r) => r.status === 'pending'));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const requestRevoke = (professionalId: number, role: ProfessionalRole, name: string) => {
    setConfirmRevoke({ professionalId, role, name });
  };

  const handleRevokeConfirmed = async () => {
    if (!confirmRevoke) return;
    const { professionalId, role, name } = confirmRevoke;
    setRevoking(`${professionalId}-${role}`);
    try {
      await revokeConnection(professionalId, role);
      setConfirmRevoke(null);
      setActivePanel(null);
      onConnectionChanged();
      setToast({ message: `Acompanhamento com ${name} encerrado.`, kind: 'success' });
    } catch {
      setToast({ message: 'Não foi possível encerrar. Tente novamente.', kind: 'error' });
    } finally {
      setRevoking(null);
    }
  };

  const members = [
    professionalContext?.personal
      ? { ...professionalContext.personal, role: 'personal' as ProfessionalRole, label: 'Personal' }
      : null,
    professionalContext?.nutri
      ? { ...professionalContext.nutri, role: 'nutri' as ProfessionalRole, label: 'Nutricionista' }
      : null,
  ].filter(Boolean) as Array<{ id: number; name: string; role: ProfessionalRole; label: string }>;
  const pendingRoles = new Set(outgoingRequests.map((request) => request.professionalRole));

  // Em modo embedded sempre mostramos 2 slots fixos (Personal + Nutri),
  // mesmo vazios — cada empty state ganha CTA próprio para escolher acompanhamento.
  const emptySlots: Array<{ role: ProfessionalRole; label: string }> = embedded
    ? (['personal', 'nutri'] as ProfessionalRole[])
        .filter((r) => !members.some((m) => m.role === r) && !pendingRoles.has(r))
        .map((r) => ({ role: r, label: r === 'personal' ? 'Personal' : 'Nutricionista' }))
    : [];

  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header — omitido em modo embedded (page-level já tem header próprio) */}
      {!embedded && (
        <div
          style={{
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: COLORS.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              Profissionais
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.4 }}>
              Quem acompanha você
            </div>
          </div>
          {!hasAcademy && (
            <button
              type="button"
              onClick={() => setShowAddSheet('personal')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${COLORS.borderStrong}`,
                background: 'transparent',
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <PlusIcon />
              Adicionar
            </button>
          )}
        </div>
      )}

      {/* Members */}
      <div style={{ padding: '0 0 4px' }}>
        {contextLoading && (
          <div style={{ padding: '16px', color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>
            Sincronizando acompanhamento…
          </div>
        )}

        {!contextLoading && !embedded && members.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            {hasAcademy ? (
              <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
                <strong style={{ display: 'block', marginBottom: 4, color: COLORS.text }}>
                  {academyName ?? 'Sua academia'} cuida do acompanhamento.
                </strong>
                Para vincular profissional externo, fale com a equipe da academia.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
                <strong style={{ display: 'block', marginBottom: 4, color: COLORS.text }}>
                  Nenhum profissional vinculado ainda.
                </strong>
                Um personal ou nutricionista amplifica os sinais que você registra.{' '}
                <button
                  type="button"
                  onClick={() => setShowAddSheet('personal')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.primary,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Adicionar agora
                </button>
              </div>
            )}
          </div>
        )}

        {!contextLoading &&
          members.map((m) => (
            <div
              key={`${m.id}-${m.role}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderBottom: `1px solid ${COLORS.border}`,
                cursor: 'pointer',
              }}
              onClick={() => setActivePanel({ professionalId: m.id, role: m.role, name: m.name })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActivePanel({ professionalId: m.id, role: m.role, name: m.name })}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: COLORS.panelDeep,
                  border: `1px solid ${COLORS.borderStrong}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: COLORS.muted,
                }}
              >
                <PersonIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 1 }}>
                  {m.label} · Ativo
                </div>
              </div>
              <div style={{ color: COLORS.muted }}>
                <ChevronIcon />
              </div>
            </div>
          ))}

        {/* Slots vazios (apenas em modo embedded) — sempre exibe Personal + Nutri */}
        {!contextLoading && embedded &&
          emptySlots.map((slot) => (
            <div
              key={`empty-${slot.role}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: COLORS.panelDeep,
                  border: `1px dashed ${COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: COLORS.muted,
                  opacity: 0.6,
                }}
              >
                <PersonIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                  {slot.label}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 1 }}>
                  {hasAcademy
                    ? `Não incluído pela ${academyName ?? 'sua academia'} · escolha um profissional`
                    : slot.role === 'personal'
                      ? 'Um personal acompanha seus treinos no dia a dia.'
                      : 'Um nutri amplifica seu plano alimentar.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSheet(slot.role)}
                aria-label={`Escolher ${slot.label.toLowerCase()} para acompanhamento`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: 'transparent',
                  color: COLORS.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <PlusIcon />
                Escolher
              </button>
            </div>
          ))}

        {/* Solicitações pendentes */}
        {outgoingRequests.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: `1px solid ${COLORS.border}`,
              opacity: 0.75,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: COLORS.warnSoft,
                border: `1px solid ${COLORS.warnBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: COLORS.muted,
              }}
            >
              <PersonIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                {r.professionalName ?? 'Profissional'}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 1 }}>
                {r.professionalRole === 'personal' ? 'Personal' : 'Nutricionista'} · Aguardando aceite
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Painel de permissões */}
      {activePanel && (
        <ConsentScopeManager
          professionalId={activePanel.professionalId}
          professionalRole={activePanel.role}
          professionalName={activePanel.name}
          revoking={revoking === `${activePanel.professionalId}-${activePanel.role}`}
          onRevoke={() => requestRevoke(activePanel.professionalId, activePanel.role, activePanel.name)}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* Confirmação destrutiva */}
      {confirmRevoke && (
        <ConfirmModal
          title={`Encerrar acompanhamento com ${confirmRevoke.name}?`}
          description="O profissional perderá acesso a todos os seus dados imediatamente. Esta ação não pode ser desfeita."
          confirmLabel="Encerrar"
          destructive
          loading={revoking !== null}
          onConfirm={() => void handleRevokeConfirmed()}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}

      {/* Sheet de adicionar */}
      {showAddSheet && (
        <AddProfessionalSheet
          initialRole={showAddSheet}
          onSuccess={() => {
            setShowAddSheet(null);
            void loadRequests();
            setToast({ message: 'Solicitação enviada com sucesso.', kind: 'success' });
          }}
          onClose={() => setShowAddSheet(null)}
        />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />}
    </div>
  );
}
