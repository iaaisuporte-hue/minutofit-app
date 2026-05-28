import { useNavigate } from 'react-router-dom';
import { useFeatureFlags } from '../../auth/FeatureFlagsContext';
import type { NutriVoiceNote } from './useNutriVoiceNote';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'agora';
  if (h === 1) return 'há 1h';
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

interface Props {
  note: NutriVoiceNote;
}

export function NutriVoiceCard({ note }: Props) {
  const navigate = useNavigate();
  const { hasFeature } = useFeatureFlags();
  const canChat = hasFeature('messages');

  const name = note.nutriName ?? 'Sua nutricionista';
  const firstName = name.split(' ')[0] ?? name;
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
        {note.nutriPhoto ? (
          <img
            src={note.nutriPhoto}
            alt={name}
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
            Sua nutricionista
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            {name}
          </span>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--color-text)',
          fontStyle: 'italic',
        }}
      >
        "{note.body}"
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
          — {formatRelative(note.publishedAt)}
        </span>
      </p>

      {canChat && (
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
          Responder →
        </button>
      )}
    </div>
  );
}
