import { useMemo } from 'react';
import './metabolicCheckin.css';
import type { MetabolicCheckinRecord } from './types';
import type { WorkoutStats } from '../../services/workoutSessionApi';
import { deriveMetabolicNarrative } from './deriveMetabolicNarrative';
import { deriveIndicators } from './deriveIndicators';
import { deriveScreenInsights } from './deriveScreenInsights';
import { MetabolicSummaryCard } from './MetabolicSummaryCard';
import { MetabolicIndicators } from './MetabolicIndicators';
import { MetabolicInsightList } from './MetabolicInsightList';
import { WeightLoadTrendChart } from './WeightLoadTrendChart';

// Visão read-only da evolução metabólica reusada pelo cockpit do profissional
// (Spec 014). Recomputa hero/indicadores/insights/gráfico a partir dos mesmos
// dados do aluno — uma só fonte visual. Sem CTA, sem check-in diário (o backend
// não tem o sinal client-side de fadiga), cutoff=0 = histórico completo.

export interface MetabolicEvolutionPayload {
  checkins: MetabolicCheckinRecord[];
  workoutStats: WorkoutStats | null;
  scopes: { bodyMetrics: boolean; workouts: boolean };
}

export function MetabolicEvolutionView({ records, stats, workoutsShared = true }: {
  records: MetabolicCheckinRecord[];
  stats: WorkoutStats | null;
  workoutsShared?: boolean;
}) {
  const narrative = useMemo(() => deriveMetabolicNarrative({ records, stats }), [records, stats]);
  const indicators = useMemo(() => deriveIndicators({ records, stats }), [records, stats]);
  const insights = useMemo(() => deriveScreenInsights({ records, stats }), [records, stats]);

  if (records.length === 0 && !stats) {
    return <p className="metabolic-section-copy">Este aluno ainda não registrou sinais de evolução.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {narrative && <MetabolicSummaryCard narrative={narrative} readOnly />}
      <MetabolicIndicators cards={indicators} readOnly />
      <WeightLoadTrendChart records={records} stats={stats} cutoff={0} />
      <MetabolicInsightList insights={insights} />
      {!workoutsShared && (
        <p className="metabolic-section-copy">A carga de treino não foi compartilhada com você. Se fizer sentido para o acompanhamento, peça ao aluno para liberar esse acesso.</p>
      )}
    </div>
  );
}
