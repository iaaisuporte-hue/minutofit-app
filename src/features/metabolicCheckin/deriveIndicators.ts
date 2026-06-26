import type { MetabolicCheckinRecord } from './types';
import type { WorkoutStats } from '../../services/workoutSessionApi';
import { computeMetabolicTrends } from './computeMetabolicTrends';
import { loadDirection } from './metabolicSignals';

// Indicadores glanceáveis (Fase 1) — números atuais + delta curto. Absorve o
// papel do antigo MetabolicTrendStrip. NÃO fraseia interpretação (isso é do
// hero) nem registra log (isso é da timeline): aqui é só o valor de agora.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MetricCardData {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'positive' | 'attention';
  empty?: boolean;
}

function latest(records: MetabolicCheckinRecord[], key: 'weightKg' | 'waistCm' | 'bodyFatPct' | 'fastingGlucoseMgdl' | 'systolicMmhg' | 'diastolicMmhg') {
  const ordered = records.filter((r) => r[key] != null).sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  return ordered.length ? Number(ordered[0][key]) : null;
}

function daysSinceLastRecord(records: MetabolicCheckinRecord[]) {
  if (!records.length) return null;
  const newest = Math.max(...records.map((r) => new Date(r.recordedAt).getTime()));
  return Math.floor((Date.now() - newest) / DAY_MS);
}

const LOAD_LABEL: Record<'up' | 'stable' | 'down', string> = { up: 'subindo', stable: 'estável', down: 'recuou' };

export function deriveIndicators(input: { records: MetabolicCheckinRecord[]; stats: WorkoutStats | null }): MetricCardData[] {
  const { records, stats } = input;
  if (records.length === 0 && !stats) return [];

  const trends = Object.fromEntries(computeMetabolicTrends(records).map((t) => [t.key, t]));
  const cards: MetricCardData[] = [];

  // Peso — valor neutro (sem juízo de direção); delta vira hint.
  const weight = latest(records, 'weightKg');
  cards.push({ key: 'weight', label: 'Peso', value: weight != null ? `${weight.toFixed(1)}kg` : '—', hint: trends.weight?.value, empty: weight == null });

  // Treinos na semana
  cards.push({ key: 'workouts', label: 'Treinos/semana', value: stats ? `${stats.thisWeek}` : '—', hint: stats ? `${stats.totalSessions} no total` : undefined, empty: !stats });

  // Carga — único card com tom (subindo = bom, recuou = atenção)
  const load = loadDirection(stats);
  cards.push({
    key: 'load',
    label: 'Carga',
    value: load ? LOAD_LABEL[load] : '—',
    tone: load === 'up' ? 'positive' : load === 'down' ? 'attention' : undefined,
    empty: !load,
  });

  // Cintura (medidas) — nudge quando ausente
  const waist = latest(records, 'waistCm');
  cards.push({ key: 'waist', label: 'Cintura', value: waist != null ? `${waist.toFixed(1)}cm` : '—', hint: trends.waist?.value, empty: waist == null });

  // Último registro
  const days = daysSinceLastRecord(records);
  cards.push({ key: 'recency', label: 'Último registro', value: days == null ? '—' : days === 0 ? 'hoje' : `há ${days}d`, empty: days == null });

  // Condicionais — só aparecem se já houve registro (não poluem com "—")
  const bodyFat = latest(records, 'bodyFatPct');
  if (bodyFat != null) cards.push({ key: 'bodyFat', label: '% gordura', value: `${bodyFat.toFixed(1)}%`, hint: trends.bodyFat?.value });

  const glucose = latest(records, 'fastingGlucoseMgdl');
  if (glucose != null) cards.push({ key: 'glucose', label: 'Glicemia', value: `${glucose}mg/dL`, hint: trends.glucose?.value });

  const systolic = latest(records, 'systolicMmhg');
  const diastolic = latest(records, 'diastolicMmhg');
  if (systolic != null || diastolic != null) cards.push({ key: 'pressure', label: 'Pressão', value: `${systolic ?? '-'}/${diastolic ?? '-'}` });

  // Esconde se nada tem dado (evita parede de "—")
  if (cards.every((card) => card.empty)) return [];
  return cards;
}
