import type { MetabolicCheckinRecord } from './types';
import type { WorkoutStats } from '../../services/workoutSessionApi';
import { windowSignal, loadDirection } from './metabolicSignals';

// Insights de tela (Fase 2) — leitura em bullets do que mudou. Heurística TS
// pura, complementa o hero. Linguagem educativa, nunca alarmista nem clínica.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScreenInsight {
  id: string;
  tone: 'positive' | 'neutral' | 'attention';
  text: string;
}

function daysSinceLatest(records: MetabolicCheckinRecord[], key: 'fastingGlucoseMgdl'): number | null {
  const times = records.filter((r) => r[key] != null).map((r) => new Date(r.recordedAt).getTime());
  if (!times.length) return null;
  return Math.floor((Date.now() - Math.max(...times)) / DAY_MS);
}

export function deriveScreenInsights(input: {
  records: MetabolicCheckinRecord[];
  stats: WorkoutStats | null;
}): ScreenInsight[] {
  const { records, stats } = input;
  const out: ScreenInsight[] = [];

  const weight = windowSignal(records, 'weightKg', 0.6, 5);
  if (weight) {
    if (weight.direction === 'stable') {
      out.push({ id: 'weight', tone: 'neutral', text: `Peso estável nos últimos ${weight.days} dias.` });
    } else if (weight.direction === 'down') {
      out.push({ id: 'weight', tone: 'positive', text: `Peso caiu ${Math.abs(weight.delta).toFixed(1)}kg em ${weight.days} dias.` });
    } else {
      out.push({ id: 'weight', tone: 'neutral', text: `Peso subiu ${weight.delta.toFixed(1)}kg em ${weight.days} dias.` });
    }
  }

  const load = loadDirection(stats);
  if (load === 'up') {
    out.push({ id: 'load', tone: 'positive', text: 'Sua carga de treino vem subindo.' });
  } else if (load === 'down') {
    out.push({ id: 'load', tone: 'attention', text: 'Sua carga de treino recuou no período.' });
  }

  if (stats && stats.thisWeek >= 3) {
    out.push({ id: 'consistency', tone: 'positive', text: `Boa consistência: ${stats.thisWeek} treinos esta semana.` });
  }

  if (records.length > 0 && !records.some((r) => r.waistCm != null)) {
    out.push({ id: 'measures', tone: 'neutral', text: 'Faltam medidas corporais para avaliar recomposição.' });
  }

  const glucoseDays = daysSinceLatest(records, 'fastingGlucoseMgdl');
  if (glucoseDays != null && glucoseDays > 15) {
    out.push({ id: 'glucose', tone: 'neutral', text: `Glicemia sem registro há ${glucoseDays} dias.` });
  }

  return out.slice(0, 5);
}
