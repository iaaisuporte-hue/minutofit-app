import type { MetabolicCheckinRecord, MetabolicNudgeState, MetabolicTrendItem } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

type NumericKey = 'weightKg' | 'waistCm' | 'bodyFatPct' | 'fastingGlucoseMgdl';

function byOldestFirst(records: MetabolicCheckinRecord[]) {
  return [...records].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

function formatDelta(delta: number, unit: string, digits = 1) {
  if (Math.abs(delta) < 0.05) return `estável`;
  const signal = delta > 0 ? '+' : '−';
  return `${signal}${Math.abs(delta).toFixed(digits)}${unit}`;
}

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / DAY_MS));
}

function pickMetric(records: MetabolicCheckinRecord[], key: NumericKey, maxDays: number) {
  const ordered = byOldestFirst(records).filter((record) => record[key] != null);
  if (ordered.length < 2) return null;
  const latest = ordered[ordered.length - 1];
  const latestTime = new Date(latest.recordedAt).getTime();
  const baseline = [...ordered]
    .reverse()
    .find((record) => latestTime - new Date(record.recordedAt).getTime() >= Math.min(maxDays, 7) * DAY_MS) ?? ordered[0];
  if (!baseline || baseline.id === latest.id) return null;
  const delta = Number(latest[key]) - Number(baseline[key]);
  return { delta, days: daysBetween(baseline.recordedAt, latest.recordedAt) };
}

function trendTone(delta: number, lowerIsGenerallyBetter = true): MetabolicTrendItem['tone'] {
  if (Math.abs(delta) < 0.05) return 'neutral';
  if (!lowerIsGenerallyBetter) return 'neutral';
  return delta < 0 ? 'positive' : 'attention';
}

export function computeMetabolicTrends(records: MetabolicCheckinRecord[]): MetabolicTrendItem[] {
  const items: MetabolicTrendItem[] = [];
  const weight = pickMetric(records, 'weightKg', 30);
  if (weight) {
    items.push({
      key: 'weight',
      label: 'Peso',
      value: Math.abs(weight.delta) < 0.2 ? 'estável' : formatDelta(weight.delta, 'kg'),
      tone: Math.abs(weight.delta) < 0.2 ? 'neutral' : trendTone(weight.delta),
      sinceLabel: `${weight.days} dias`,
    });
  }

  const waist = pickMetric(records, 'waistCm', 60);
  if (waist) {
    items.push({
      key: 'waist',
      label: 'Cintura',
      value: Math.abs(waist.delta) < 0.2 ? 'estável' : formatDelta(waist.delta, 'cm'),
      tone: Math.abs(waist.delta) < 0.2 ? 'neutral' : trendTone(waist.delta),
      sinceLabel: `${waist.days} dias`,
    });
  }

  const bodyFat = pickMetric(records, 'bodyFatPct', 60);
  if (bodyFat) {
    items.push({
      key: 'bodyFat',
      label: '% gordura',
      value: Math.abs(bodyFat.delta) < 0.2 ? 'estável' : formatDelta(bodyFat.delta, 'pp'),
      tone: Math.abs(bodyFat.delta) < 0.2 ? 'neutral' : trendTone(bodyFat.delta),
      sinceLabel: `${bodyFat.days} dias`,
    });
  }

  const glucose = pickMetric(records, 'fastingGlucoseMgdl', 60);
  if (glucose) {
    items.push({
      key: 'glucose',
      label: 'Glicemia',
      value: Math.abs(glucose.delta) < 1 ? 'estável' : formatDelta(glucose.delta, 'mg/dL', 0),
      tone: Math.abs(glucose.delta) < 1 ? 'neutral' : trendTone(glucose.delta),
      sinceLabel: `${glucose.days} dias`,
    });
  }

  return items;
}

function latestMetricDate(records: MetabolicCheckinRecord[], key: NumericKey) {
  return records
    .filter((record) => record[key] != null)
    .map((record) => new Date(record.recordedAt).getTime())
    .sort((a, b) => b - a)[0] ?? null;
}

function hasRecordToday(records: MetabolicCheckinRecord[], today: Date) {
  const todayKey = today.toISOString().slice(0, 10);
  return records.some((record) => record.recordedAt.slice(0, 10) === todayKey);
}

function daysSince(timestamp: number | null, today: Date) {
  if (!timestamp) return Infinity;
  return Math.floor((today.getTime() - timestamp) / DAY_MS);
}

export function computeNudgeState(records: MetabolicCheckinRecord[], today = new Date()): MetabolicNudgeState {
  if (hasRecordToday(records, today)) {
    return { shouldShow: false, reason: null, title: '', description: '' };
  }

  if (records.length === 0) {
    return {
      shouldShow: true,
      reason: 'first',
      title: 'Hora do seu check-in metabólico',
      description: 'Leva menos de 2 minutos e ajuda o MetaCore a adaptar sua experiência.',
    };
  }

  const weightAge = daysSince(latestMetricDate(records, 'weightKg'), today);
  if (weightAge > 7) {
    return {
      shouldShow: true,
      reason: 'weight',
      title: 'Atualize seu peso esta semana',
      description: 'Um sinal simples ajuda a acompanhar tendência, energia e recuperação.',
    };
  }

  const waistAge = daysSince(latestMetricDate(records, 'waistCm'), today);
  if (waistAge > 21) {
    return {
      shouldShow: true,
      reason: 'waist',
      title: 'Vale atualizar sua cintura',
      description: 'Esse dado mensal ajuda a ler evolução além do peso.',
    };
  }

  return { shouldShow: false, reason: null, title: '', description: '' };
}
