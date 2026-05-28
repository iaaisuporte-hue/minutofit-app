import { useEffect, useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { ConsentScope, NetworkProfessional, OfferingPeriod, ProfessionalRole, PublicOffering } from './types';
import { DEFAULT_SCOPES_NUTRI, DEFAULT_SCOPES_PERSONAL, SCOPE_LABELS } from './types';
import {
  createConnectionRequest,
  listProfessionalNetwork,
  listProfessionalOfferings,
  resolveProfessional,
  startCheckout,
} from './api';
import type { ResolvedProfessional } from './types';
import { Toast } from './Toast';

const PERIOD_LABELS: Record<OfferingPeriod, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

function formatPriceBrl(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2).replace('.', ',');
  return `${currency === 'BRL' ? 'R$' : currency} ${value}`;
}

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
  const [offerings, setOfferings] = useState<PublicOffering[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'confirm' || !resolved) {
      setOfferings([]);
      return;
    }
    let active = true;
    setLoadingOfferings(true);
    void listProfessionalOfferings(resolved.id)
      .then((data) => { if (active) setOfferings(data); })
      .catch(() => { if (active) setOfferings([]); })
      .finally(() => { if (active) setLoadingOfferings(false); });
    return () => { active = false; };
  }, [step, resolved]);

  const handleContract = async (offeringId: string) => {
    if (checkingOut) return;
    setCheckingOut(offeringId);
    setErrorMsg(null);
    try {
      const result = await startCheckout(offeringId);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setErrorMsg('Checkout indisponível no momento. Tente novamente em instantes.');
    } catch (err: unknown) {
      const code = (err as { message?: string }).message;
      const messages: Record<string, string> = {
        conflict_active_link: 'Você já tem profissional ativo neste acompanhamento.',
        conflict_pending_checkout: 'Você já tem um checkout em andamento para este tipo de profissional.',
        offering_not_found_or_archived: 'Plano não disponível.',
        cannot_subscribe_to_self: 'Você não pode assinar seu próprio plano.',
        mp_preapproval_failed: 'Não foi possível iniciar o pagamento. Tente novamente.',
      };
      setErrorMsg(messages[code ?? ''] ?? 'Não foi possível iniciar o checkout.');
    } finally {
      setCheckingOut(null);
    }
  };

  useEffect(() => {
    let active = true;
    setLoadingNetwork(true);
    setNetworkError(null);
    void listProfessionalNetwork({ role, limit: 12 })
      .then((payload) => {
        if (!active) return;
        setProfessionals(payload.professionals);
      })
      .catch(() => {
        if (!active) return;
        setProfessionals([]);
        setNetworkError('Não foi possível carregar a rede agora. Tente novamente.');
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
              {/* Planos pagos (US4) — só aparece se o profissional tem ofertas ativas */}
              {(loadingOfferings || offerings.length > 0) && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                    Planos pagos disponíveis
                  </div>
                  {loadingOfferings ? (
                    <div style={{ fontSize: 12, color: COLORS.muted }}>Carregando planos…</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {offerings.map((o) => (
                        <div
                          key={o.id}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.panelDeep,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{o.title}</div>
                            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                              {formatPriceBrl(o.priceCents, o.currency)} · {PERIOD_LABELS[o.period]}
                            </div>
                            {o.description && (
                              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, lineHeight: 1.45 }}>
                                {o.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleContract(o.id)}
                            disabled={checkingOut !== null}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 8,
                              border: 'none',
                              background: COLORS.primary,
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: checkingOut ? 'not-allowed' : 'pointer',
                              opacity: checkingOut && checkingOut !== o.id ? 0.5 : 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {checkingOut === o.id ? 'Redirecionando…' : 'Contratar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 12, fontSize: 11, color: COLORS.muted, textAlign: 'center' }}>
                    Ou envie uma solicitação gratuita abaixo
                  </div>
                </div>
              )}

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
