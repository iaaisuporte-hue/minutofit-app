import { COLORS } from '../../styles/colors';
import type { AcademyForUser, AcademyBranding } from '../../services/authApi';

interface Props {
  academies: AcademyForUser[] | undefined;
  activeAcademyId: number | null | undefined;
  branding: AcademyBranding | null | undefined;
}

const AcademyIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 21h18M5 21V10l7-6 7 6v11M9 21V12h6v9" />
  </svg>
);

export function AcademyCard({ academies, activeAcademyId, branding }: Props) {
  const active = activeAcademyId
    ? academies?.find((a) => a.id === activeAcademyId) ?? academies?.[0] ?? null
    : null;

  const displayName = active?.displayName ?? branding?.displayName ?? null;
  const logoUrl = active?.logoUrl ?? branding?.logoUrl ?? null;
  const roleLabel = active?.roleLabel ?? 'Aluno';

  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
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
          Academia
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.4 }}>
          {active ? 'Onde você treina' : 'Espaço presencial de treino'}
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {active ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: COLORS.panelDeep,
                border: `1px solid ${COLORS.borderStrong}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: COLORS.muted,
                overflow: 'hidden',
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={displayName ?? 'Logo'}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <AcademyIcon />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: COLORS.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName ?? 'Academia'}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                {roleLabel} · Acompanhamento institucional
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
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
              <AcademyIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                Você não está vinculado a uma academia.
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
                Academias parceiras MetaCore chegam em breve à sua cidade. Enquanto isso, seu acompanhamento metabólico continua direto no app.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
