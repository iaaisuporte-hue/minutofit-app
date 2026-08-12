import { WorkoutProgressSection } from '../components/WorkoutProgressSection';
import { useWorkoutStats } from '../components/useWorkoutStats';

/**
 * Aba Progressão.
 *
 * Na P1 ela apenas dá casa própria à `WorkoutProgressSection`, que já existia e
 * já funcionava dentro da Evolução — nenhuma capacidade nova. A P2 é que traz
 * seletor de exercício, e1RM e a janela configurável, consumindo
 * `/performance/progression`.
 */
export default function ProgressionTab() {
  const { stats, loading } = useWorkoutStats();

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <WorkoutProgressSection stats={stats} loading={loading} />

      {!loading && (!stats || stats.exerciseProgression.length === 0) && (
        <div className="metabolic-empty">
          <p className="metabolic-section-copy">
            A progressão aparece quando o mesmo exercício é registrado com carga em pelo menos dois
            dias diferentes. Anote a carga no Modo Treino e ela começa a desenhar a curva.
          </p>
        </div>
      )}
    </div>
  );
}
