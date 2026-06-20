import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureFlags } from '../../auth/FeatureFlagsContext';
import { API_URL } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import type { ProfessionalSummary } from './useProfessionalContext';

interface Props {
  personal: ProfessionalSummary | null;
  nutri: ProfessionalSummary | null;
  criticalSignals?: string[];
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  return `há ${diffDays} dias`;
}

export function ProfessionalVoiceCard({ personal, nutri, criticalSignals = [] }: Props) {
  const navigate = useNavigate();
  const { hasFeature } = useFeatureFlags();
  // Aluno sem feature 'messages' não pode acessar /app/user/messages (rota redireciona
  // pra default). Esconde o CTA — o card segue informacional, mantendo a presença do
  // profissional visível (Skill aluno_signal_loop_review).
  const canOpenChat = hasFeature('messages');

  // "Tem sinal" = observação escrita OU sessão registrada (Veio/Parcial). Ambos provam
  // ao aluno que o profissional o notou. Prioriza quem tem sinal; senão, o personal.
  const hasSignal = (p: ProfessionalSummary | null) =>
    Boolean(p && (p.lastObservation || p.lastSession));
  const primary = hasSignal(personal)
    ? personal
    : hasSignal(nutri)
      ? nutri
      : (personal ?? nutri);

  // Instrumenta percepção real do aluno: dispara 1x por sessão distinta quando o card
  // mostra o toque de sessão (sem observação escrita). Mede se o loop é PERCEBIDO,
  // não só entregue — pré-requisito para validar a tese (item #1 do parecer).
  const showingSession = Boolean(primary && !primary.lastObservation && primary.lastSession);
  const reportKey = showingSession ? `${primary!.id}:${primary!.lastSession!.at}` : null;
  const reportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!reportKey || reportedRef.current === reportKey) return;
    reportedRef.current = reportKey;
    void authFetch(`${API_URL}/user/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'student.session_touchpoint.viewed',
        payload: {
          personalId: primary!.id,
          status: primary!.lastSession!.status,
          sessionAt: primary!.lastSession!.at,
        },
      }),
    }).catch(() => {});
  }, [reportKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!personal && !nutri) return null;
  if (!primary) return null;
  const role = primary === personal ? 'personal' : 'nutricionista';
  const firstName = primary.name.split(' ')[0] ?? primary.name;
  const initial = firstName[0]?.toUpperCase() ?? '?';

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 18,
        boxShadow: 'var(--shadow-lg)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {primary.photo ? (
          <img
            src={primary.photo}
            alt={primary.name}
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ display: 'grid', gap: 2 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--color-text-muted)',
            }}
          >
            Seu {role}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            {primary.name}
          </span>
        </div>
      </div>

      {primary.lastObservation ? (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--color-text)',
            fontStyle: 'italic',
          }}
        >
          “{primary.lastObservation.text}”
          <span
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 12,
              fontStyle: 'normal',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
            }}
          >
            — {formatRelativeDate(primary.lastObservation.createdAt)}
          </span>
        </p>
      ) : primary.lastSession ? (
        // Sem observação escrita, mas o profissional registrou uma sessão: fecha o loop
        // no lado do aluno — ele vê que foi notado. (item #1 do parecer de viabilidade)
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--color-text)' }}>
          {firstName}{' '}
          {primary.lastSession.status === 'partial'
            ? 'registrou uma sessão parcial sua'
            : 'registrou sua presença no treino'}{' '}
          <b>{formatRelativeDate(primary.lastSession.at)}</b>.
          <span
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            Seu acompanhamento está em dia.
          </span>
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)' }}>
          {firstName} está acompanhando sua evolução.
        </p>
      )}

      {canOpenChat && (
        <button
          type="button"
          onClick={() => navigate('/app/user/messages')}
          style={{
            alignSelf: 'flex-start',
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text)',
            background: 'rgba(255,255,255,0.62)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          Abrir conversa →
        </button>
      )}

      {criticalSignals.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {firstName} verá esses sinais no próximo acompanhamento: {criticalSignals.join(", ")}.
        </div>
      )}
    </div>
  );
}
