import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { InfoHint } from '../../components/InfoHint';
import type { MetabolicData, MetabolicFactor, MetabolicTrend } from './metabolism.types';
import type { DerivedEnergyStatus, MetabolicForecast } from './metabolismDerivations';
import { computeMetabolicTrends } from '../metabolicCheckin/computeMetabolicTrends';
import type { MetabolicCheckinRecord, MetabolicNudgeState } from '../metabolicCheckin/types';
import '../metabolicCheckin/metabolicCheckin.css';

interface Props {
  data: MetabolicData | null;
  loading: boolean;
  error: string | null;
  derivedStatus: DerivedEnergyStatus | null;
  forecast: MetabolicForecast | null;
  conditionContext?: { signals: string[] } | null;
  trendStrip?: { records: MetabolicCheckinRecord[]; loading?: boolean };
  nudge?: { state: MetabolicNudgeState; onOpen: () => void };
}

const STATUS_LABEL: Record<string, string> = {
  low: 'Pedindo recuperação',
  moderate: 'Equilibrado',
  high: 'Em alta',
};

const TREND_META: Record<MetabolicTrend, { icon: string; label: string; color: string }> = {
  up:     { icon: '↑', label: 'melhorando',  color: 'var(--color-success-text)' },
  down:   { icon: '↓', label: 'em queda',    color: 'var(--color-warn)' },
  stable: { icon: '→', label: 'estável',     color: 'var(--color-accent-hover)' },
};

const TREND_DELTA_META: Record<'up' | 'down' | 'stable', { icon: string; color: string }> = {
  up:     { icon: '↑', color: 'var(--color-success-text)' },
  down:   { icon: '↓', color: 'var(--color-warn)' },
  stable: { icon: '→', color: 'var(--color-accent-hover)' },
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
      ? 'Seu estado está caindo. Uma sessão de manutenção hoje evita uma queda maior amanhã.'
      : 'Bom estado. Sustentar a atividade hoje pode elevar você para o estado Pico.';
  }
  if (state === 'Pico') {
    return 'Você está no estado mais produtivo do ciclo metabólico. Aproveite para uma sessão de alta intensidade.';
  }
  return 'Veja os detalhes para entender o que está influenciando seu estado hoje.';
}

function humanizeForecast(forecast: MetabolicForecast): string {
  if (forecast.withActivityDelta > 0) {
    return `Um treino hoje pode elevar seu estado amanhã (+${forecast.withActivityDelta}). Seu metabolismo está responsivo.`;
  }
  if (forecast.withoutActivityDelta < -2) {
    return 'Manter alguma atividade hoje ajuda a sustentar seu estado. Sem treino, tende a cair.';
  }
  return 'Seu estado está estável. Qualquer atividade hoje contribui para manter o ritmo.';
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
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'default',
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

export function MetabolicScoreCard({ data, loading, error, derivedStatus, forecast, conditionContext, trendStrip, nudge }: Props) {
  const isMobile = useIsMobile(720);
  const [animatedScore, setAnimatedScore] = useState(0);
  const animatedScoreRef = useRef(0);
  const [detailOpen, setDetailOpen] = useState(false);

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

  // Fechar detail com Escape
  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailOpen]);

  // Scroll lock quando modal aberto
  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailOpen]);

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
          </div>
          <Skeleton width="85%" height={13} />
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
  const topFactors = [...data.factors].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
  const energyStatus = derivedStatus ?? { energyLabel: STATUS_LABEL[data.status] ?? data.status, metabolicState: 'Ativo' };
  const stateContext = data.interpretation?.hint ?? getStateContext(energyStatus.metabolicState, data.trend);

  const bodyTrends = trendStrip && !trendStrip.loading ? computeMetabolicTrends(trendStrip.records) : [];

  return (
    <>
      {/* ── Card compacto (visão padrão) ─────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={topBar} />
        <div style={{ padding: isMobile ? 18 : 22, display: 'grid', gap: 16 }}>

          {/* Eyebrow */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            Estado metabólico hoje
            <InfoHint
              termo="Estado metabólico"
              resumo="Como seu corpo está respondendo agora — considera sono, treino recente, alimentação e estresse."
              impacto="Quando está baixo, o app sugere recuperação. Quando está alto, sugere mais intensidade."
              saibaMaisHref="/app/user/glossario#estado-metabolico"
            />
          </div>

          {/* Label qualitativo principal + trend */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {energyStatus.energyLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-accent" style={{ fontSize: 11, padding: '3px 9px' }}>
                {energyStatus.metabolicState}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: trend.color }}>
                {trend.icon} {trend.label}
              </span>
            </div>
          </div>

          {/* Mensagem contextual */}
          <div style={{
            padding: '11px 14px', borderRadius: 12,
            background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-border)',
            fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6,
          }}>
            {stateContext}
            {data.interpretation?.action && (
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                → {data.interpretation.action}
              </div>
            )}
          </div>

          {/* Forecast humanizado (1 linha) */}
          {forecast && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {humanizeForecast(forecast)}
            </div>
          )}

          {/* Sinais do check-in (compacto) */}
          {conditionContext && conditionContext.signals.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Ajustado pelo seu check-in · {conditionContext.signals.join(' · ')}
            </div>
          )}

          {/* Link de detalhes */}
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--color-accent-hover)',
              padding: 0, textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            Ver leitura completa →
          </button>
        </div>
      </div>

      {/* ── Modal de leitura completa ────────────────────────────────────── */}
      <AnimatePresence>
        {detailOpen && (
          <motion.div
            key="metabolic-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => { if (e.target === e.currentTarget) setDetailOpen(false); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as React.CSSProperties['zIndex'],
              background: 'rgba(15, 23, 42, 0.38)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              padding: '0 0 env(safe-area-inset-bottom)',
            }}
            role="presentation"
          >
            <motion.div
              key="metabolic-detail-panel"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label="Leitura metabólica completa"
              style={{
                width: 'min(640px, 100%)',
                maxHeight: '88vh',
                overflowY: 'auto',
                background: 'var(--color-surface)',
                borderRadius: '20px 20px 0 0',
                padding: isMobile ? '20px 18px 32px' : '24px 24px 36px',
                display: 'grid',
                gap: 20,
              }}
            >
              {/* Handle + título */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -8 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-strong)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 3 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Estado metabólico
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                    Leitura de hoje
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, borderRadius: 8 }}
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Score numérico */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    {energyStatus.energyLabel} · {trend.icon} {trend.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-accent" style={{ fontSize: 11, padding: '3px 9px' }}>{energyStatus.metabolicState}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
                    <div className="metaScoreValue" style={{ fontSize: isMobile ? 40 : 48 }}>{animatedScore}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}>
                      /100
                      <InfoHint
                        termo="Score (pontuação)"
                        resumo="Número de 0 a 100 que representa seu estado metabólico. Não é uma nota — é uma bússola."
                        impacto="Sobe quando você treina, dorme bem e mantém consistência. Cai com inatividade ou sono ruim."
                        saibaMaisHref="/app/user/glossario#score"
                      />
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-subtle)', overflow: 'hidden', minWidth: 120, marginTop: 4 }}>
                    <div style={{ height: '100%', width: progressPct, borderRadius: 999, background: 'var(--gradient-primary)', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              </div>

              {/* Fatores */}
              {topFactors.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    O que está pesando na sua leitura
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {topFactors.map((f) => <FactorChip key={f.id} factor={f} />)}
                  </div>
                </div>
              )}

              {/* Sinais do check-in */}
              {conditionContext && conditionContext.signals.length > 0 && (
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Ajustado pelo seu check-in
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {conditionContext.signals.join(' · ')}
                  </div>
                </div>
              )}

              {/* Previsão detalhada */}
              {forecast && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    O que esperar amanhã
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-success-border)', background: 'var(--color-success-soft)', display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Se treinar hoje
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{forecast.tomorrowWithActivity}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success-text)' }}>
                          {forecast.withActivityDelta >= 0 ? '+' : ''}{forecast.withActivityDelta}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Sem treino amanhã
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{forecast.tomorrowWithoutActivity}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: forecast.withoutActivityDelta >= 0 ? 'var(--color-accent-hover)' : 'var(--color-warn)' }}>
                          {forecast.withoutActivityDelta >= 0 ? '+' : ''}{forecast.withoutActivityDelta}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Evolução 7d/30d */}
              {(data.trend7d || data.trend30d) && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Evolução recente
                  </div>
                  {data.trend7d && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--color-text-muted)', minWidth: 118 }}>Últimos 7 dias</span>
                      <span style={{ fontWeight: 700, color: TREND_DELTA_META[data.trend7d.direction].color }}>
                        {TREND_DELTA_META[data.trend7d.direction].icon}{' '}
                        {data.trend7d.direction === 'stable' ? 'estável' : `${data.trend7d.delta >= 0 ? '+' : ''}${data.trend7d.delta} pontos`}
                      </span>
                    </div>
                  )}
                  {data.trend30d && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--color-text-muted)', minWidth: 118 }}>Últimos 30 dias</span>
                      <span style={{ fontWeight: 700, color: TREND_DELTA_META[data.trend30d.direction].color }}>
                        {TREND_DELTA_META[data.trend30d.direction].icon}{' '}
                        {data.trend30d.direction === 'stable' ? 'estável' : `${data.trend30d.delta >= 0 ? '+' : ''}${data.trend30d.delta} pontos`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Evolução corporal */}
              {bodyTrends.length > 0 && (
                <div style={{ display: 'grid', gap: 8, paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
                  <div className="metabolic-eyebrow">Evolução corporal</div>
                  <div className="metabolic-trend-grid">
                    {bodyTrends.map((t) => (
                      <div className="metabolic-trend-item" key={t.key}>
                        <div className="metabolic-eyebrow">{t.label}</div>
                        <div className={`metabolic-trend-value ${t.tone}`}>{t.value}</div>
                        <p className="metabolic-section-copy" style={{ fontSize: 'var(--text-sm)' }}>em {t.sinceLabel}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nudge */}
              {nudge?.state.shouldShow && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid var(--color-border)',
                }}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div className="metabolic-eyebrow">Há algo novo pra contar?</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{nudge.state.title}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={() => { setDetailOpen(false); nudge.onOpen(); }}
                    style={{ fontSize: 12, padding: '5px 14px', flexShrink: 0 }}
                  >
                    Registrar como estou
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
