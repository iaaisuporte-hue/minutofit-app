import React from 'react';

interface Props {
  recommendations: string[];
  loading: boolean;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      style={{
        width,
        height: 14,
        borderRadius: 6,
        background: 'var(--color-surface-subtle)',
        animation: 'pulse 1.6s ease-in-out infinite',
      }}
    />
  );
}

export function MetabolicInsights({ recommendations, loading }: Props) {
  if (!loading && recommendations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 12,
        }}
      >
        Recomendações
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <SkeletonLine width="80%" />
          <SkeletonLine width="65%" />
          <SkeletonLine width="72%" />
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {recommendations.map((rec, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 14,
                color: 'var(--color-text)',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  marginTop: 1,
                }}
              >
                ✓
              </span>
              {capitalize(rec)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
