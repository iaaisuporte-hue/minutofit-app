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
  low: 'Energia baixa',
  moderate: 'Moderado',
  high: 'Alto',
};

const TREND_DELTA_META: Record<'up' | 'down' | 'stable', { icon: string; label: string; color: string }> = {
  up:     { icon: '↑', label: '', color: 'var(--color-success-text)' },
  down:   { icon: '↓', label: '', color: 'var(--color-warn)' },
  stable: { icon: '→', label: 'estável', color: 'var(--color-accent-hover)' },
};

const TREND_META: Record<MetabolicTrend, { icon: string; label: string; color: string }> = {
  up:     { icon: '↑', label: 'Subindo',  color: 'var(--color-success-text)' },
  down:   { icon: '↓', label: 'Atenção',  color: 'var(--color-warn)' },
  stable: { icon: '→', label: 'Estável',  color: 'var(--color-accent-hover)' },
};

function getStateContext(state: string, trend: MetabolicTrend): string {
  if (state === 'Dormindo') {
    return trend === 'up'
      ? 'Você está saindo do estado mais baixo. Um treino leve hoje acelera essa recuperação.'
      : 'Seu metabolismo está em repouso. Mesmo 10 minutos de movimento mudam esse estado.';
  }
  if (state === 'Aquecendo') {
    return trend === 'up'
      ? 'Você está ganhando ritmo. Manter a atividade hoje pode fazer você entrar no estado Ativo ainda esta semana.'
      : 'Um treino moderado hoje tem alto retorno nesse estado — o score responde bem.';
  }
  if (state === 'Ativo') {
    return trend === 'down'
      ? 'Score caindo. Uma sessão de manutenção hoje evita uma queda maior amanhã.'
      : 'Bom estado. Sustentar a atividade hoje pode elevar você para o estado Pico.';
  }
  if (state === 'Pico') {
    return 'Você está no estado mais produtivo do ciclo metabólico. Aproveite para uma sessão de alta intensidade.';
  }
  return 'Veja os fatores abaixo para entender o que está influenciando seu score hoje.';
}

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
        gap: 5,
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'default',
        background: positive ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
        border: `1px solid ${positive ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
        color: positive ? 'var(--color-success-text)' : 'var(--color-danger)',
      }}
    >
      <span style={{ fontWeight: 700 }}>{positive ? '+' : ''}{factor.delta}</span>
      <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>{factor.label}</span>
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
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 24);

    return () => window.clearInterval(timer);
  }, [data?.score]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
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
        <div style={{ padding: 22, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={140} height={14} />
            <Skeleton width={60} height={42} radius={10} />
          </div>
          <Skeleton width="100%" height={8} radius={4} />
          <div style={{ display: 'flex', gap: 6 }}>
            <Skeleton width={90} height={28} radius={999} />
            <Skeleton width={90} height={28} radius={999} />
            <Skeleton width={90} height={28} radius={999} />
          </div>
          <Skeleton width="85%" height={13} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Skeleton width="100%" height={60} radius={12} />
            <Skeleton width="100%" height={60} radius={12} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={cardStyle}>
        <div style={{ ...topBar, background: 'var(--color-surface-subtle)' }} />
        <div style={{ padding: 22 }}>
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
    .slice(0, 5);
  const energyStatus = derivedStatus ?? {
    energyLabel: STATUS_LABEL[data.status] ?? data.status,
    metabolicState: 'Ativo',
  };

  const stateContext = getStateContext(energyStatus.metabolicState, data.trend);

  return (
    <div style={cardStyle}>
      <div style={topBar} />
      <div style={{ padding: isMobile ? 18 : 22, display: 'grid', gap: 20 }}>

        {/* Linha principal: label + score + trend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Status Metabólico
            </div>
            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {energyStatus.energyLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-accent" style={{ fontSize: 11, padding: '3px 9px' }}>
                {energyStatus.metabolicState}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: trend.color }}>
                {trend.icon} {trend.label}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 4, textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: 'flex-end' }}>
              <div className="metaScoreValue" style={{ fontSize: isMobile ? 40 : 50 }}>{animatedScore}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                score
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-subtle)', overflow: 'hidden', minWidth: 120 }}>
              <div style={{ height: '100%', width: progressPct, borderRadius: 999, background: 'var(--gradient-primary)', transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>

        {/* Fatores (por que está assim) */}
        {topFactors.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Por que está assim
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topFactors.map((f) => <FactorChip key={f.id} factor={f} />)}
            </div>
          </div>
        )}

        {/* Mensagem contextual */}
        <div style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'var(--color-accent-soft)',
          border: '1px solid var(--color-accent-border)',
          fontSize: 13,
          color: 'var(--color-text)',
          lineHeight: 1.6,
        }}>
          {stateContext}
        </div>

        {/* Forecast */}
        {forecast ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-success-border)', background: 'var(--color-success-soft)', display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Amanhã com atividade
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)' }}>{forecast.tomorrowWithActivity}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success-text)' }}>
                  {forecast.withActivityDelta >= 0 ? '+' : ''}{forecast.withActivityDelta}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Amanhã sem atividade
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)' }}>{forecast.tomorrowWithoutActivity}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: forecast.withoutActivityDelta >= 0 ? 'var(--color-accent-hover)' : 'var(--color-warn)' }}>
                  {forecast.withoutActivityDelta >= 0 ? '+' : ''}{forecast.withoutActivityDelta}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {(data.trend7d || data.trend30d) && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Evolução
            </div>
            {data.trend7d && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 118 }}>Últimos 7 dias</span>
                <span style={{ fontWeight: 700, color: TREND_DELTA_META[data.trend7d.direction].color }}>
                  {TREND_DELTA_META[data.trend7d.direction].icon}{' '}
                  {data.trend7d.direction === 'stable'
                    ? 'estável'
                    : `${data.trend7d.delta >= 0 ? '+' : ''}${data.trend7d.delta} pontos`}
                </span>
              </div>
            )}
            {data.trend30d && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 118 }}>Últimos 30 dias</span>
                <span style={{ fontWeight: 700, color: TREND_DELTA_META[data.trend30d.direction].color }}>
                  {TREND_DELTA_META[data.trend30d.direction].icon}{' '}
                  {data.trend30d.direction === 'stable'
                    ? 'estável'
                    : `${data.trend30d.delta >= 0 ? '+' : ''}${data.trend30d.delta} pontos`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
