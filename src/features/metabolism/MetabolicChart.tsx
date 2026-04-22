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

interface Props {
  data: MetabolicHistory;
  loading: boolean;
  forecast: MetabolicForecast | null;
  markers: HistoryMarker[];
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
  background: '#fff',
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
      <circle className="meta-dot-ring" cx={cx} cy={cy} r={4} fill="#06B6D4" />
      <circle cx={cx} cy={cy} r={4} fill="#06B6D4" stroke="#fff" strokeWidth={2} />
    </g>
  );
}

function MarkerDot(props: {
  cx?: number;
  cy?: number;
  payload?: { markerKind?: HistoryMarker['kind'] | null; isForecast?: boolean };
}) {
  const { cx, cy, payload } = props;
  if (!payload?.markerKind || payload.isForecast || cx == null || cy == null) return null;

  const fill = payload.markerKind === 'workout' ? '#22C55E' : '#F97316';
  const label = payload.markerKind === 'workout' ? 'W' : '!';

  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="#fff" stroke={fill} strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={fill}>
        {label}
      </text>
    </g>
  );
}

export function MetabolicChart({ data, loading, forecast, markers }: Props) {
  if (!loading && data.length === 0) return null;

  const markerMap = new Map(markers.map((marker) => [marker.date, marker]));
  const lastActualDate = data[data.length - 1]?.date;
  const chartData = buildForecastHistory(data, forecast).map((point) => ({
    ...point,
    dateLabel: formatDate(point.date),
    markerKind: markerMap.get(point.date)?.kind ?? null,
    markerLabel: markerMap.get(point.date)?.label ?? null,
    isLastActual: point.date === lastActualDate,
  }));

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 20px 12px',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 16,
        }}
      >
        Histórico (14 dias)
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
              cursor={{ stroke: '#06B6D4', strokeWidth: 1, strokeDasharray: '4 2' }}
              formatter={(value, name, item) => {
                const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                if (name === 'scoreWithActivity') return [numeric, 'Tomorrow with activity'];
                if (name === 'scoreWithoutActivity') return [numeric, 'Tomorrow without activity'];
                const payload = item?.payload as { score: number; markerLabel?: string } | undefined;
                const extras = payload?.markerLabel ? ` · ${payload.markerLabel}` : '';
                return [`${numeric}${extras}`, 'Score'];
              }}
              labelFormatter={(label, payload) => {
                const raw = payload?.[0]?.payload as { score: number; isForecast?: boolean } | undefined;
                if (!raw) return String(label);
                const state = getStateLabelForScore(raw.score, 'stable');
                return `${label} · ${state}${raw.isForecast ? ' · forecast' : ''}`;
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={(props) => (
                <>
                  <ActualLastDot {...props} />
                  <MarkerDot {...props} />
                </>
              )}
              activeDot={{ r: 6, fill: '#06B6D4', strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="scoreWithActivity"
              stroke="#22C55E"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 5, fill: '#22C55E', strokeWidth: 0 }}
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
          {markers.slice(-3).map((marker) => (
            <span
              key={`${marker.date}-${marker.kind}`}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${marker.kind === 'workout' ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)'}`,
                background: marker.kind === 'workout' ? 'rgba(34,197,94,0.07)' : 'rgba(249,115,22,0.08)',
                color: marker.kind === 'workout' ? '#15803d' : '#c2410c',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {marker.kind === 'workout' ? 'Workout marker' : 'Inactivity drop'} · {formatDate(marker.date)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
