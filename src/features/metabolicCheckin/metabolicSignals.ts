import type { MetabolicCheckinRecord } from './types';
import type { WorkoutStats } from '../../services/workoutSessionApi';

// Sinais derivados puros, compartilhados entre o hero (deriveMetabolicNarrative)
// e a lista de insights (deriveScreenInsights). Sem IA, determinístico.

const DAY_MS = 24 * 60 * 60 * 1000;

export type Direction = 'down' | 'stable' | 'up';

export interface MetricSignal {
  direction: Direction;
  delta: number;
  days: number;
}

/**
 * Delta de uma métrica do registro mais recente vs. um baseline de ~7+ dias atrás.
 * Retorna null quando há menos de 2 registros ou a janela é curta demais para
 * sustentar tendência (evita afirmar evolução cedo demais).
 */
export function windowSignal(
  records: MetabolicCheckinRecord[],
  key: 'weightKg' | 'waistCm',
  stableThreshold: number,
  minDays: number,
): MetricSignal | null {
  const ordered = records
    .filter((record) => record[key] != null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  if (ordered.length < 2) return null;

  const latest = ordered[ordered.length - 1];
  const latestTime = new Date(latest.recordedAt).getTime();
  const baseline = [...ordered].reverse().find((record) => latestTime - new Date(record.recordedAt).getTime() >= 7 * DAY_MS) ?? ordered[0];
  if (baseline.id === latest.id) return null;

  const days = Math.max(1, Math.round((latestTime - new Date(baseline.recordedAt).getTime()) / DAY_MS));
  if (days < minDays) return null;

  const delta = Number(latest[key]) - Number(baseline[key]);
  const direction: Direction = Math.abs(delta) < stableThreshold ? 'stable' : delta < 0 ? 'down' : 'up';
  return { direction, delta, days };
}

/**
 * Direção agregada da carga a partir da progressão por exercício.
 *
 * Só entram exercícios com dois pontos: um registro isolado tem `deltaKg` 0 por
 * construção, e quem só treinou uma vez receberia "Carga: estável" — afirmação
 * sobre uma tendência que não existe. Sem nenhum exercício com dois pontos o
 * card volta a ser "—", que é o convite a registrar carga.
 */
export function loadDirection(stats: WorkoutStats | null): Direction | null {
  const progression = stats?.exerciseProgression.filter((ex) => ex.points.length >= 2) ?? [];
  if (progression.length === 0) return null;
  const ups = progression.filter((ex) => ex.deltaKg > 0).length;
  const downs = progression.filter((ex) => ex.deltaKg < 0).length;
  const net = progression.reduce((sum, ex) => sum + ex.deltaKg, 0);
  if (ups > downs && net > 0) return 'up';
  if (downs > ups && net < 0) return 'down';
  return 'stable';
}
