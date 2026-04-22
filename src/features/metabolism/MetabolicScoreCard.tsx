import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { MetabolicData, MetabolicFactor, MetabolicTrend } from './metabolism.types';

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
    <div style={{ width, height, borderRadius: radius, background: 'var(--color-surface-subtle)', animation: 'pulse 1.6s ease-in-out infinite' }} />
  );
}

function FactorChip({ factor }: { factor: MetabolicFactor }) {
  const positive = factor.delta >= 0;
  return (
    <div
      title={factor.hint}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'default',
        background: positive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        color: positive ? '#16a34a' : '#dc2626',
      }}
    >
      <span>{positive ? '+' : ''}{factor.delta}</span>
      <span style={{ fontWeight: 400, color: '#6B7280' }}>{factor.label}</span>
    </div>
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

  const topBar: React.CSSProperties = { height: 4, background: 'var(--gradient-primary)' };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={topBar} />
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: 24 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={72} height={52} radius={12} />
            <Skeleton width={80} height={14} />
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={14} />
            <Skeleton width="100%" height={8} radius={4} />
            <div style={{ display: 'flex', gap: 6 }}>
              <Skeleton width={80} height={26} radius={999} />
              <Skeleton width={80} height={26} radius={999} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={cardStyle}>
        <div style={{ ...topBar, background: 'var(--color-surface-subtle)' }} />
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Não foi possível carregar os dados metabólicos.
          </div>
        </div>
      </div>
    );
  }

  const trend = TREND_META[data.trend];
  const progressPct = `${Math.max(0, Math.min(100, data.score))}%`;
  const topFactors = [...data.factors]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  return (
    <div style={cardStyle}>
      <div style={topBar} />
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: 24, alignItems: 'start' }}>

        {/* Score */}
        <div style={{ display: 'grid', gap: 6, minWidth: 120 }}>
          <div className="metaScoreLabel">MetaCore Score</div>
          <div className="metaScoreValue">{data.score}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <span className="badge badge-accent" style={{ fontSize: 11, padding: '3px 8px' }}>
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: trend.color }}>
              {trend.icon} {trend.label}
            </span>
          </div>
        </div>

        {/* Barra + fatores */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', fontWeight: 500 }}>Score metabólico</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>{data.score} / 100</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-subtle)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: progressPct, borderRadius: 999, background: 'var(--gradient-primary)', transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {topFactors.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                O que está movendo seu score
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {topFactors.map((f) => <FactorChip key={f.id} factor={f} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
