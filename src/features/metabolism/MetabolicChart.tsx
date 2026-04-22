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

interface Props {
  data: MetabolicHistory;
  loading: boolean;
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

export function MetabolicChart({ data, loading }: Props) {
  if (!loading && data.length === 0) return null;

  const chartData = data.map((p) => ({ ...p, date: formatDate(p.date) }));

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
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
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
              formatter={(value: number) => [value, 'Score']}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#06B6D4', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
