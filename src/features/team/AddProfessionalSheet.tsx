import { useState } from 'react';
import { COLORS } from '../../styles/colors';
import type { ConsentScope, ProfessionalRole } from './types';
import { DEFAULT_SCOPES_NUTRI, DEFAULT_SCOPES_PERSONAL, SCOPE_LABELS } from './types';
import { resolveProfessional, createConnectionRequest } from './api';
import type { ResolvedProfessional } from './types';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

type Step = 'identify' | 'confirm';

const ALL_SCOPES_PERSONAL: ConsentScope[] = [
  'profile', 'workouts', 'daily_checkins', 'metabolic', 'sleep',
  'body_metrics', 'body_photos', 'parq_anamnese', 'activity_logs',
];
const ALL_SCOPES_NUTRI: ConsentScope[] = [
  'profile', 'daily_checkins', 'nutrition', 'metabolic', 'sleep',
  'body_metrics', 'body_photos', 'parq_anamnese',
];

export function AddProfessionalSheet({ onSuccess, onClose }: Props) {
  const [role, setRole] = useState<ProfessionalRole>('personal');
  const [identifier, setIdentifier] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedProfessional | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('identify');
  const [scopes, setScopes] = useState<Set<ConsentScope>>(new Set(DEFAULT_SCOPES_PERSONAL));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRoleChange = (r: ProfessionalRole) => {
    setRole(r);
    setScopes(new Set(r === 'personal' ? DEFAULT_SCOPES_PERSONAL : DEFAULT_SCOPES_NUTRI));
    setResolved(null);
    setResolveError(null);
    setIdentifier('');
  };

  const handleResolve = async () => {
    if (!identifier.trim()) return;
    setResolving(true);
    setResolveError(null);
    setResolved(null);
    try {
      const pro = await resolveProfessional(identifier.trim(), role);
      setResolved(pro);
      setStep('confirm');
    } catch {
      setResolveError('Profissional não encontrado. Verifique o e-mail ou código.');
    } finally {
      setResolving(false);
    }
  };

  const toggleScope = (scope: ConsentScope) => {
    if (scope === 'profile') return; // profile é sempre obrigatório
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
        requestedVia: 'email',
        message: message.trim() || undefined,
        scopes: Array.from(scopes),
      });
      setSent(true);
      setTimeout(onSuccess, 1200);
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e.message === 'too_many_pending') {
        alert('Você já tem muitas solicitações pendentes. Cancele uma antes de enviar outra.');
      } else if (e.message === 'daily_limit_exceeded') {
        alert('Você atingiu o limite de solicitações por hoje. Tente novamente amanhã.');
      } else {
        alert('Não foi possível enviar. Tente novamente.');
      }
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
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: COLORS.panel,
          borderRadius: '12px 12px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
            {step === 'identify' ? 'Adicionar profissional' : `Solicitar vínculo — ${resolved?.name}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: COLORS.muted, cursor: 'pointer', padding: '4px 8px' }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: COLORS.text }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Solicitação enviada!</div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6 }}>
                {resolved?.name} receberá uma notificação para aceitar.
              </div>
            </div>
          ) : step === 'identify' ? (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Tipo */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['personal', 'nutri'] as ProfessionalRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleChange(r)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 8,
                      border: `1px solid ${role === r ? COLORS.primary : COLORS.border}`,
                      background: role === r ? COLORS.primarySoft : 'transparent',
                      color: role === r ? COLORS.primary : COLORS.muted,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {r === 'personal' ? 'Personal' : 'Nutricionista'}
                  </button>
                ))}
              </div>

              {/* Identificador */}
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: 'block', marginBottom: 6 }}>
                  E-mail ou código do profissional
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setResolveError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && void handleResolve()}
                  placeholder="ex: joao@coach.com ou JOAO8X"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${resolveError ? COLORS.dangerBorder : COLORS.border}`,
                    background: COLORS.panelDeep,
                    color: COLORS.text,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {resolveError && (
                  <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 5 }}>{resolveError}</div>
                )}
              </div>

              <button
                type="button"
                disabled={!identifier.trim() || resolving}
                onClick={() => void handleResolve()}
                style={{
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: COLORS.primary,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: identifier.trim() && !resolving ? 'pointer' : 'not-allowed',
                  opacity: !identifier.trim() || resolving ? 0.6 : 1,
                }}
              >
                {resolving ? 'Buscando…' : 'Buscar profissional'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Escopos */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
                  Dados que serão compartilhados
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
                  Você pode ajustar a qualquer momento nas permissões.
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {allScopes.map((s) => {
                    const checked = scopes.has(s);
                    const mandatory = s === 'profile';
                    return (
                      <label
                        key={s}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: `1px solid ${checked ? COLORS.primaryBorder : COLORS.border}`,
                          background: checked ? COLORS.primarySoft : 'transparent',
                          cursor: mandatory ? 'default' : 'pointer',
                          opacity: mandatory ? 0.7 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={mandatory}
                          onChange={() => toggleScope(s)}
                          style={{ accentColor: COLORS.primary }}
                        />
                        <span style={{ fontSize: 13, color: COLORS.text }}>
                          {SCOPE_LABELS[s]}
                          {mandatory && <span style={{ color: COLORS.muted, marginLeft: 4 }}>(obrigatório)</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: 'block', marginBottom: 6 }}>
                  Mensagem para o profissional (opcional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                  placeholder="ex: Olá, vi seu trabalho pelo Instagram e gostaria de…"
                  rows={3}
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
                  }}
                />
                <div style={{ fontSize: 11, color: COLORS.muted, textAlign: 'right' }}>{message.length}/300</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setStep('identify')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    background: 'transparent',
                    color: COLORS.muted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSend()}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: 8,
                    border: 'none',
                    background: COLORS.primary,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  {sending ? 'Enviando…' : 'Enviar solicitação'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
