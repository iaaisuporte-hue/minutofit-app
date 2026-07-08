import { useNavigate } from 'react-router-dom';
import type { MetabolicRecommendation } from './metabolism.types';

interface Props {
  recommendations: MetabolicRecommendation[];
  loading: boolean;
}

function SkeletonCard() {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--color-border)', display: 'grid', gap: 8 }}>
      <div style={{ width: '70%', height: 14, borderRadius: 6, background: 'var(--color-surface-subtle)', animation: 'pulse 1.6s ease-in-out infinite' }} />
      <div style={{ width: '50%', height: 12, borderRadius: 6, background: 'var(--color-surface-subtle)', animation: 'pulse 1.6s ease-in-out infinite' }} />
    </div>
  );
}

export function MetabolicInsights({ recommendations, loading }: Props) {
  const navigate = useNavigate();

  if (!loading && recommendations.length === 0) return null;

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        Como subir seu score hoje
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                background: '#FAFAFA',
                display: 'grid',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{rec.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{rec.reason}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>{rec.impact}</span>
                {rec.cta && (
                  <button
                    type="button"
                    onClick={() => navigate(rec.cta!.route)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--action-primary)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {rec.cta.label} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
