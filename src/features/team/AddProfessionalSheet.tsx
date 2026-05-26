import { useEffect, useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { ConsentScope, NetworkProfessional, ProfessionalRole } from './types';
import { DEFAULT_SCOPES_NUTRI, DEFAULT_SCOPES_PERSONAL, SCOPE_LABELS } from './types';
import { createConnectionRequest, listProfessionalNetwork, resolveProfessional } from './api';
import type { ResolvedProfessional } from './types';
import { Toast } from './Toast';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
  initialRole?: ProfessionalRole;
}

type Step = 'browse' | 'manual' | 'confirm';

const ALL_SCOPES_PERSONAL: ConsentScope[] = [
  'profile', 'workouts', 'daily_checkins', 'metabolic', 'sleep',
  'body_metrics', 'body_photos', 'parq_anamnese', 'activity_logs',
];
const ALL_SCOPES_NUTRI: ConsentScope[] = [
  'profile', 'daily_checkins', 'nutrition', 'metabolic', 'sleep',
  'body_metrics', 'body_photos', 'parq_anamnese',
];

const roleLabel = (role: ProfessionalRole) => role === 'personal' ? 'Personal' : 'Nutricionista';
const modalityLabel = (value: NetworkProfessional['modality']) => {
  if (value === 'online') return 'Online';
  if (value === 'hybrid') return 'Híbrido';
  if (value === 'in_person') return 'Presencial';
  return 'A combinar';
};

export function AddProfessionalSheet({ onSuccess, onClose, initialRole = 'personal' }: Props) {
  const [role, setRole] = useState<ProfessionalRole>(initialRole);
  const [step, setStep] = useState<Step>('browse');
  const [identifier, setIdentifier] = useState('');
  const [professionals, setProfessionals] = useState<NetworkProfessional[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedProfessional | null>(null);
  const [selectedVia, setSelectedVia] = useState<'discovery' | 'email'>('discovery');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Set<ConsentScope>>(
    new Set(initialRole === 'nutri' ? DEFAULT_SCOPES_NUTRI : DEFAULT_SCOPES_PERSONAL)
  );
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingNetwork(true);
    setNetworkError(null);
    void listProfessionalNetwork({ role, limit: 12 })
      .then((payload) => {
        if (!active) return;
        setProfessionals(payload.professionals);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const code = (err as { message?: string }).message;
        setProfessionals([]);
        setNetworkError(code === 'academy_blocks_professional_network'
          ? 'Sua academia revisa vínculos externos antes de liberar a rede.'
          : 'Não foi possível carregar a rede agora.');
      })
      .finally(() => active && setLoadingNetwork(false));
    return () => { active = false; };
  }, [role]);

  const resetForRole = (nextRole: ProfessionalRole) => {
    setRole(nextRole);
    setScopes(new Set(nextRole === 'personal' ? DEFAULT_SCOPES_PERSONAL : DEFAULT_SCOPES_NUTRI));
    setResolved(null);
    setResolveError(null);
    setIdentifier('');
    setStep('browse');
  };

  const chooseNetworkProfessional = (pro: NetworkProfessional) => {
    setRole(pro.professionalRole);
    setScopes(new Set(pro.professionalRole === 'personal' ? DEFAULT_SCOPES_PERSONAL : DEFAULT_SCOPES_NUTRI));
    setSelectedVia('discovery');
    setResolved({ id: pro.professionalId, name: pro.displayName });
    setStep('confirm');
  };

  const handleResolve = async () => {
    if (!identifier.trim()) return;
    setResolveError(null);
    try {
      const pro = await resolveProfessional(identifier.trim(), role);
      setSelectedVia('email');
      setResolved(pro);
      setStep('confirm');
    } catch {
      setResolveError('Profissional não encontrado. Verifique o e-mail ou código.');
    }
  };

  const toggleScope = (scope: ConsentScope) => {
    if (scope === 'profile') return;
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const handleSend = async () => {
    if (!resolved) return;
    setSending(true);
    try {
      await createConnectionRequest({
        professionalId: resolved.id,
        professionalRole: role,
        requestedVia: selectedVia,
        message: message.trim() || undefined,
        scopes: Array.from(scopes),
      });
      setSent(true);
      setTimeout(onSuccess, 1000);
    } catch (err: unknown) {
      const code = (err as { message?: string }).message;
      const messages: Record<string, string> = {
        too_many_pending: 'Você já tem muitas solicitações pendentes. Cancele uma antes de enviar outra.',
        daily_limit_exceeded: 'Você atingiu o limite de solicitações por hoje. Tente novamente amanhã.',
        academy_blocks_professional_network: 'Sua academia precisa liberar vínculos externos antes dessa solicitação.',
        conflict_active_link: `Você já tem ${roleLabel(role).toLowerCase()} ativo nesse acompanhamento.`,
        professional_not_available: 'Este profissional ainda não está disponível na Rede de Profissionais.',
      };
      setErrorMsg(messages[code ?? ''] ?? 'Não foi possível enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const allScopes = role === 'personal' ? ALL_SCOPES_PERSONAL : ALL_SCOPES_NUTRI;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: COLORS.panel,
          borderRadius: 12,
          width: 'min(100%, 520px)',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'auto',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rede de Profissionais</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginTop: 2 }}>
              {step === 'confirm' ? `Solicitar acompanhamento — ${resolved?.name}` : 'Profissionais de Acompanhamento'}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: COLORS.muted, cursor: 'pointer', padding: '4px 8px' }} aria-label="Fechar">×</button>
        </div>

        <div style={{ padding: 16 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: COLORS.text }}>
              <div style={{ fontSize: 30, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Solicitação enviada</div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6 }}>{resolved?.name} receberá seu pedido e os escopos autorizados.</div>
            </div>
          ) : step !== 'confirm' ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['personal', 'nutri'] as ProfessionalRole[]).map((r) => (
                  <button key={r} type="button" onClick={() => resetForRole(r)} style={{ flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${role === r ? COLORS.primary : COLORS.border}`, background: role === r ? COLORS.primarySoft : 'transparent', color: role === r ? COLORS.primary : COLORS.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {roleLabel(r)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {loadingNetwork && <div style={{ padding: 14, color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>Carregando curadoria…</div>}
                {!loadingNetwork && networkError && <div style={{ padding: 14, borderRadius: 8, border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{networkError}</div>}
                {!loadingNetwork && !networkError && professionals.length === 0 && <div style={{ padding: 14, borderRadius: 8, border: `1px dashed ${COLORS.border}`, color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>Ainda não há profissionais validados para este acompanhamento.</div>}
                {!loadingNetwork && professionals.map((pro) => (
                  <button key={pro.professionalId} type="button" onClick={() => chooseNetworkProfessional(pro)} style={{ textAlign: 'left', padding: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panelDeep, color: COLORS.text, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ fontSize: 14 }}>{pro.displayName}</strong>
                      <span style={{ fontSize: 11, color: COLORS.primary, fontWeight: 700 }}>Credencial validada</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{roleLabel(pro.professionalRole)} · {modalityLabel(pro.modality)}{pro.city ? ` · ${pro.city}${pro.stateUf ? `/${pro.stateUf}` : ''}` : ''}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6, lineHeight: 1.45 }}>{pro.metabolicFocus || pro.specialties.slice(0, 3).join(' · ') || 'Acompanhamento metabólico contínuo.'}</div>
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => setStep(step === 'manual' ? 'browse' : 'manual')} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.muted, padding: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {step === 'manual' ? 'Voltar para rede curada' : 'Tenho código ou e-mail de um profissional'}
              </button>

              {step === 'manual' && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setResolveError(null); }} onKeyDown={(e) => e.key === 'Enter' && void handleResolve()} placeholder="ex: joao@coach.com ou JOAO8X" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${resolveError ? COLORS.dangerBorder : COLORS.border}`, background: COLORS.panelDeep, color: COLORS.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  {resolveError && <div style={{ fontSize: 12, color: COLORS.danger }}>{resolveError}</div>}
                  <button type="button" disabled={!identifier.trim()} onClick={() => void handleResolve()} style={{ padding: 10, borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: identifier.trim() ? 'pointer' : 'not-allowed', opacity: identifier.trim() ? 1 : 0.6 }}>Buscar profissional</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${COLORS.primaryBorder}`, background: COLORS.primarySoft, fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                Ao enviar, você autoriza este profissional a acessar somente os dados marcados abaixo após o vínculo ser aprovado. Você pode revogar depois.
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Dados compartilhados</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {allScopes.map((s) => {
                    const checked = scopes.has(s);
                    const mandatory = s === 'profile';
                    return (
                      <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, border: `1px solid ${checked ? COLORS.primaryBorder : COLORS.border}`, background: checked ? COLORS.primarySoft : 'transparent', cursor: mandatory ? 'default' : 'pointer', opacity: mandatory ? 0.75 : 1 }}>
                        <input type="checkbox" checked={checked} disabled={mandatory} onChange={() => toggleScope(s)} style={{ accentColor: COLORS.primary }} />
                        <span style={{ fontSize: 13, color: COLORS.text }}>{SCOPE_LABELS[s]}{mandatory && <span style={{ color: COLORS.muted, marginLeft: 4 }}>(obrigatório)</span>}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 300))} placeholder="Mensagem para o profissional (opcional)" rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panelDeep, color: COLORS.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setStep('browse')} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Voltar</button>
                <button type="button" disabled={sending} onClick={() => void handleSend()} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1 }}>{sending ? 'Enviando…' : 'Enviar solicitação'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {errorMsg && <Toast message={errorMsg} kind="error" onDismiss={() => setErrorMsg(null)} />}
    </div>
  );
}
