import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { MetabolicData, MetabolicFactor, MetabolicTrend } from './metabolism.types';
import type { DerivedEnergyStatus, MetabolicForecast } from './metabolismDerivations';

interface Props {
  data: MetabolicData | null;
  loading: boolean;
  error: string | null;
  derivedStatus: DerivedEnergyStatus | null;
  forecast: MetabolicForecast | null;
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

function IndicatorBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: 'rgba(148,163,184,0.14)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #22C55E, #06B6D4)', transition: 'width 0.55s ease' }} />
      </div>
    </div>
  );
}

export function MetabolicScoreCard({ data, loading, error, derivedStatus, forecast }: Props) {
  const isMobile = useIsMobile(720);
  const [animatedScore, setAnimatedScore] = useState(0);
  const animatedScoreRef = useRef(0);

  useEffect(() => {
    const target = data?.score ?? 0;
    let frame = 0;
    const startValue = animatedScoreRef.current;
    const totalFrames = 18;

    if (startValue === target) return;

    const timer = window.setInterval(() => {
      frame += 1;
      const progress = frame / totalFrames;
      const eased = 1 - (1 - progress) * (1 - progress);
      const nextValue = Math.round(startValue + (target - startValue) * eased);
      animatedScoreRef.current = nextValue;
      setAnimatedScore(nextValue);

      if (frame >= totalFrames) {
        window.clearInterval(timer);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [data?.score]);

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 'var(--radius-card)',
    border: '1px solid var(--color-accent-border)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  };

  const topBar: React.CSSProperties = { height: 4, background: 'var(--gradient-primary)' };
  const clampFallback = (value: number) => Math.max(0, Math.min(100, value));

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
  const energyStatus = derivedStatus ?? {
    energyLabel: STATUS_LABEL[data.status] ?? data.status,
    metabolicState: 'Active',
    focus: clampFallback(data.score),
    energy: clampFallback(data.score),
    fatBurn: clampFallback(data.score),
  };

  return (
    <div style={cardStyle}>
      <div style={topBar} />
      <div style={{ padding: isMobile ? 18 : 22, display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 220px) 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="metaScoreLabel">Daily Energy Status</div>
            <div style={{ fontSize: isMobile ? 28 : 34, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {energyStatus.energyLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <span className="badge badge-accent" style={{ fontSize: 11, padding: '3px 8px' }}>
                {energyStatus.metabolicState}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: trend.color }}>
                {trend.icon} {trend.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <div className="metaScoreValue" style={{ fontSize: isMobile ? 42 : 52 }}>{animatedScore}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                score
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', fontWeight: 500 }}>Energy readiness</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>{data.score} / 100</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--color-surface-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: progressPct, borderRadius: 999, background: 'var(--gradient-primary)', transition: 'width 0.6s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <IndicatorBar label="Focus" value={energyStatus.focus} />
              <IndicatorBar label="Energy" value={energyStatus.energy} />
              <IndicatorBar label="Fat burn" value={energyStatus.fatBurn} />
            </div>
          </div>
        </div>

        {forecast ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.05)', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tomorrow with activity</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{forecast.tomorrowWithActivity}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                  {forecast.withActivityDelta >= 0 ? '+' : ''}{forecast.withActivityDelta}
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(148,163,184,0.2)', background: '#F8FAFC', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tomorrow without activity</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{forecast.tomorrowWithoutActivity}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: forecast.withoutActivityDelta >= 0 ? '#0891b2' : '#f97316' }}>
                  {forecast.withoutActivityDelta >= 0 ? '+' : ''}{forecast.withoutActivityDelta}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {topFactors.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              O que está mexendo com seu dia
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topFactors.map((f) => <FactorChip key={f.id} factor={f} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
