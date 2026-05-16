import { useNavigate } from 'react-router-dom';
import type { ProfessionalSummary } from './useProfessionalContext';

interface Props {
  personal: ProfessionalSummary | null;
  nutri: ProfessionalSummary | null;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  return `há ${diffDays} dias`;
}

export function ProfessionalVoiceCard({ personal, nutri }: Props) {
  const navigate = useNavigate();
  if (!personal && !nutri) return null;

  // Prioriza o profissional com observação recente; senão mostra o personal primeiro
  const primary = personal?.lastObservation
    ? personal
    : nutri?.lastObservation
      ? nutri
      : (personal ?? nutri);

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
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)' }}>
          {firstName} está acompanhando sua evolução.
        </p>
      )}

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
    </div>
  );
}
