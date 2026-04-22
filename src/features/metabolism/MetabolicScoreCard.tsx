import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { MetabolicData, MetabolicTrend } from './metabolism.types';

interface Props {
  data: MetabolicData | null;
  loading: boolean;
  error: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  low: 'Baixo',
  moderate: 'Moderado',
  high: 'Alto',
};

const TREND_META: Record<MetabolicTrend, { icon: string; label: string; color: string }> = {
  up:     { icon: '↑', label: 'Subindo',  color: 'var(--color-primary)' },
  down:   { icon: '↓', label: 'Atenção',  color: 'var(--color-warn)'    },
  stable: { icon: '→', label: 'Estável',  color: 'var(--color-accent)'  },
};

function Skeleton({ width, height, radius = 8 }: { width: string | number; height: number; radius?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--color-surface-subtle)',
        animation: 'pulse 1.6s ease-in-out infinite',
      }}
    />
  );
}

export function MetabolicScoreCard({ data, loading, error }: Props) {
  const isMobile = useIsMobile(720);

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 'var(--radius-card)',
    border: '1px solid var(--color-accent-border)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  };

  const topBarStyle: React.CSSProperties = {
    height: 4,
    background: 'var(--gradient-primary)',
  };

  const innerStyle: React.CSSProperties = {
    padding: 24,
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
    gap: 24,
    alignItems: 'center',
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={topBarStyle} />
        <div style={innerStyle}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={72} height={52} radius={12} />
            <Skeleton width={80} height={14} />
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={14} />
            <Skeleton width="100%" height={8} radius={4} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={cardStyle}>
        <div style={{ ...topBarStyle, background: 'var(--color-surface-subtle)' }} />
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Unable to load metabolic data
          </div>
        </div>
      </div>
    );
  }

  const trend = TREND_META[data.trend];
  const progressPct = `${Math.max(0, Math.min(100, data.score))}%`;

  return (
    <div style={cardStyle}>
      <div style={topBarStyle} />
      <div style={innerStyle}>
        {/* Left col — score */}
        <div style={{ display: 'grid', gap: 6, minWidth: 120 }}>
          <div className="metaScoreLabel">MetaCore Score</div>
          <div className="metaScoreValue">{data.score}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <span
              className="badge badge-accent"
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: trend.color }}>
              {trend.icon} {trend.label}
            </span>
          </div>
        </div>

        {/* Right col — progress + context */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', fontWeight: 500 }}>
                Score metabólico
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {data.score} / 100
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: progressPct,
                  borderRadius: 999,
                  background: 'var(--gradient-primary)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>

          <div className="metaScoreInsight">
            Seu metabolismo está em nível{' '}
            <strong style={{ color: data.status === 'high' ? 'var(--color-primary)' : data.status === 'moderate' ? 'var(--color-accent)' : 'var(--color-warn)' }}>
              {STATUS_LABEL[data.status]?.toLowerCase()}
            </strong>
            . Veja as recomendações abaixo para evoluir.
          </div>
        </div>
      </div>
    </div>
  );
}
