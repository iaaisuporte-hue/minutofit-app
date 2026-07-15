import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetabolicCheckinRecord } from './types';
import type { WorkoutStats } from '../../services/workoutSessionApi';

// Gráfico de tendência peso × carga (Fase 2). Peso em kg (eixo esquerdo) e carga
// como índice base 100 (eixo direito) — base 100 = carga no início do período,
// para a leitura ser "subiu/desceu %" e não kg absoluto de exercícios distintos.
// Degrada graciosamente: some a linha sem dado suficiente; some a seção sem nenhuma.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface ChartRow {
  t: number;
  weight?: number;
  loadIndex?: number;
}

function buildSeries(records: MetabolicCheckinRecord[], stats: WorkoutStats | null, cutoff: number) {
  const rows = new Map<number, ChartRow>();

  for (const record of records) {
    if (record.weightKg == null) continue;
    const time = new Date(record.recordedAt).getTime();
    if (time < cutoff) continue;
    const day = Math.floor(time / DAY_MS) * DAY_MS;
    const row = rows.get(day) ?? { t: day };
    row.weight = Number(record.weightKg);
    rows.set(day, row);
  }

  // Carga: progressão relativa por exercício (maxLoad / baseline), agrupada por semana.
  const weekly = new Map<number, number[]>();
  if (stats) {
    for (const ex of stats.exerciseProgression) {
      if (!ex.firstLoadKg) continue;
      for (const point of ex.points) {
        const time = new Date(point.date).getTime();
        if (Number.isNaN(time) || time < cutoff) continue;
        const week = Math.floor(time / WEEK_MS) * WEEK_MS;
        const bucket = weekly.get(week) ?? [];
        bucket.push(point.maxLoadKg / ex.firstLoadKg);
        weekly.set(week, bucket);
      }
    }
  }
  for (const [week, values] of weekly) {
    const index = Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length);
    const row = rows.get(week) ?? { t: week };
    row.loadIndex = index;
    rows.set(week, row);
  }

  const ordered = [...rows.values()].sort((a, b) => a.t - b.t);
  const hasWeight = ordered.filter((row) => row.weight != null).length >= 2;
  const hasLoad = ordered.filter((row) => row.loadIndex != null).length >= 2;
  return { rows: ordered, hasWeight, hasLoad };
}

function fmtDay(t: number) {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function WeightLoadTrendChart({ records, stats, cutoff }: {
  records: MetabolicCheckinRecord[];
  stats: WorkoutStats | null;
  cutoff: number;
}) {
  const { rows, hasWeight, hasLoad } = buildSeries(records, stats, cutoff);
  if (!hasWeight && !hasLoad) return null;

  return (
    <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <div className="metabolic-eyebrow">Tendência</div>
        <h2 className="metabolic-section-title">Peso × carga no tempo</h2>
        <p className="metabolic-section-copy">
          Carga em índice base 100 (100 = sua carga no início do período). A leitura é a direção das linhas, não o número de um dia isolado.
        </p>
      </div>
      <div className="chart-slot" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtDay}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            {hasWeight && (
              <YAxis yAxisId="weight" width={40} unit="kg" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
            )}
            {hasLoad && (
              <YAxis yAxisId="load" orientation="right" width={40} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
            )}
            <Tooltip
              labelFormatter={(t) => fmtDay(Number(t))}
              formatter={(value, name) => (name === 'Peso' ? [`${value} kg`, 'Peso'] : [`${value} (base 100)`, 'Carga'])}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend />
            {hasWeight && (
              <Line yAxisId="weight" name="Peso" type="monotone" dataKey="weight" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            )}
            {hasLoad && (
              <Line yAxisId="load" name="Carga" type="monotone" dataKey="loadIndex" stroke="var(--color-info-text)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
