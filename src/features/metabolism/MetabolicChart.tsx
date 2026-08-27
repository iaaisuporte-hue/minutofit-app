import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MetabolicHistory } from './metabolism.types';
import type { HistoryMarker, MetabolicForecast } from './metabolismDerivations';
import { buildForecastHistory, getStateLabelForScore } from './metabolismDerivations';
import { dayKey } from '../../lib/appDay';

const WINDOW_OPTIONS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

interface Props {
  data: MetabolicHistory;
  loading: boolean;
  forecast: MetabolicForecast | null;
  markers: HistoryMarker[];
  days?: number;
  onDaysChange?: (days: number) => void;
  /** Quando fornecido, mostra um botão "Ver evolução" no topo-direito do card
   *  (entrada para a página de evolução, já que ela saiu do bottom nav). */
  onSeeMore?: () => void;
  /**
   * Torna o marcador de treino DE HOJE acionável (abre o compartilhamento da
   * sessão). Só hoje: dia passado é leitura, e o gráfico não vira navegação.
   * Ausente (ex.: no cockpit do personal) mantém o gráfico só como leitura.
   */
  onTodayWorkoutClick?: () => void;
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function Skeleton() {
  return (
    <div
      style={{
        height: 180,
        borderRadius: 8,
        background: 'var(--color-surface-subtle)',
        animation: 'pulse 1.6s ease-in-out infinite',
      }}
    />
  );
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  padding: '6px 10px',
  boxShadow: 'var(--shadow-sm)',
};

function ActualLastDot(props: { cx?: number; cy?: number; payload?: { isForecast?: boolean; isLastActual?: boolean } }) {
  const { cx, cy, payload } = props;
  if (!payload?.isLastActual || payload?.isForecast || cx == null || cy == null) return null;
  return (
    <g>
      <style>{`
        @keyframes metaDotPulse {
          0%   { r: 4;  opacity: 0.6; }
          70%  { r: 11; opacity: 0;   }
          100% { r: 11; opacity: 0;   }
        }
        .meta-dot-ring { animation: metaDotPulse 1.8s ease-out infinite; }
      `}</style>
      <circle className="meta-dot-ring" cx={cx} cy={cy} r={4} fill="#8E8E8E" />
      <circle cx={cx} cy={cy} r={4} fill="#8E8E8E" stroke="#fff" strokeWidth={2} />
    </g>
  );
}

function MarkerDot(props: {
  cx?: number;
  cy?: number;
  payload?: { markerKind?: HistoryMarker['kind'] | null; isForecast?: boolean; isActionable?: boolean };
  onActivate?: () => void;
}) {
  const { cx, cy, payload, onActivate } = props;
  if (!payload?.markerKind || payload.isForecast || cx == null || cy == null) return null;

  const fill = payload.markerKind === 'workout' ? '#7B9919' : payload.markerKind === 'condition' ? '#8E8E8E' : '#F97316';
  const label = payload.markerKind === 'workout' ? 'W' : payload.markerKind === 'condition' ? 'C' : '!';
  const actionable = Boolean(payload.isActionable && onActivate);

  if (!actionable) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill="#fff" stroke={fill} strokeWidth={2} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={fill}>
          {label}
        </text>
      </g>
    );
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label="Compartilhar o treino de hoje"
      style={{ cursor: 'pointer' }}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate?.();
        }
      }}
    >
      <title>Compartilhar o treino de hoje</title>
      {/* Halo: o único sinal de que este ponto responde ao toque. */}
      <circle cx={cx} cy={cy} r={14} fill="rgba(123,153,25,0.14)" />
      <circle cx={cx} cy={cy} r={9} fill="#fff" stroke={fill} strokeWidth={2.5} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={fill}>
        {label}
      </text>
      {/* Alvo de toque de 44px — o marcador visível tem 18px de diâmetro. */}
      <circle cx={cx} cy={cy} r={22} fill="transparent" />
    </g>
  );
}

export function MetabolicChart({ data, loading, forecast, markers, days = 14, onDaysChange, onSeeMore, onTodayWorkoutClick }: Props) {
  if (!loading && data.length === 0) return null;

  const markerMap = new Map(markers.map((marker) => [marker.date, marker]));
  const lastActualDate = data[data.length - 1]?.date;
  // Hoje no fuso do aluno, não em UTC: às 21h de um UTC-3 o dia UTC já virou e
  // o marcador de hoje deixaria de ser clicável justamente à noite.
  const todayKey = dayKey();
  const chartData = buildForecastHistory(data, forecast).map((point) => {
    const markerKind = markerMap.get(point.date)?.kind ?? null;
    return {
      ...point,
      dateLabel: formatDate(point.date),
      markerKind,
      markerLabel: markerMap.get(point.date)?.label ?? null,
      isLastActual: point.date === lastActualDate,
      isActionable: Boolean(onTodayWorkoutClick) && markerKind === 'workout' && point.date === todayKey,
    };
  });

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 20px 12px',
      }}
    >
      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Histórico metabólico
          </div>
          {onSeeMore && (
            <button
              type="button"
              onClick={onSeeMore}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Ver evolução →
            </button>
          )}
        </div>
        {onDaysChange && (
          <div style={{ display: 'flex', background: 'var(--color-bg-main)', borderRadius: 8, padding: 2, gap: 1, border: '1px solid var(--color-border)' }}>
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => onDaysChange(opt.days)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: days === opt.days ? 'var(--color-surface)' : 'transparent',
                  color: days === opt.days ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: days === opt.days ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              width={28}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: '#8E8E8E', strokeWidth: 1, strokeDasharray: '4 2' }}
              formatter={(value, name, item) => {
                const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                if (name === 'scoreWithActivity') return [numeric, 'Amanhã com atividade'];
                if (name === 'scoreWithoutActivity') return [numeric, 'Amanhã sem atividade'];
                const payload = item?.payload as { score: number; markerLabel?: string } | undefined;
                const extras = payload?.markerLabel ? ` · ${payload.markerLabel}` : '';
                return [`${numeric}${extras}`, 'Score'];
              }}
              labelFormatter={(label, payload) => {
                const raw = payload?.[0]?.payload as { score: number; isForecast?: boolean } | undefined;
                if (!raw) return String(label);
                const state = getStateLabelForScore(raw.score, 'stable');
                return `${label} · ${state}${raw.isForecast ? ' · previsão' : ''}`;
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#8E8E8E"
              strokeWidth={2}
              dot={(props) => (
                <>
                  <ActualLastDot {...props} />
                  <MarkerDot {...props} onActivate={onTodayWorkoutClick} />
                </>
              )}
              activeDot={{ r: 6, fill: '#8E8E8E', strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="scoreWithActivity"
              stroke="#7B9919"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 5, fill: '#7B9919', strokeWidth: 0 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="scoreWithoutActivity"
              stroke="#94A3B8"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 5, fill: '#94A3B8', strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {!loading && markers.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {markers.slice(-3).map((marker) => {
            const isWorkout = marker.kind === 'workout';
            const isCondition = marker.kind === 'condition';
            const border = isWorkout ? 'rgba(123,153,25,0.25)' : isCondition ? 'rgba(142,142,142,0.25)' : 'rgba(249,115,22,0.25)';
            const bg = isWorkout ? 'rgba(123,153,25,0.07)' : isCondition ? 'rgba(142,142,142,0.07)' : 'rgba(249,115,22,0.08)';
            const color = isWorkout ? '#5E7412' : isCondition ? '#6B7280' : '#c2410c';
            const markerLabel = isWorkout ? 'Treino registrado' : isCondition ? 'Check-in registrado' : 'Queda por inatividade';
            const chipStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`, background: bg, color, fontSize: 11, fontWeight: 700 };

            // O chip de hoje repete a ação do marcador. Sem ele a única porta
            // seria um ponto de 18px no gráfico, que ninguém descobre — e no
            // celular o chip ainda dá um alvo de toque de verdade.
            if (isWorkout && onTodayWorkoutClick && marker.date === todayKey) {
              return (
                <button
                  key={`${marker.date}-${marker.kind}`}
                  type="button"
                  onClick={onTodayWorkoutClick}
                  style={{ ...chipStyle, minHeight: 32, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {markerLabel} · {formatDate(marker.date)}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Compartilhar o treino de hoje
                  </span>
                </button>
              );
            }

            return (
              <span key={`${marker.date}-${marker.kind}`} style={chipStyle}>
                {markerLabel} · {formatDate(marker.date)}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
