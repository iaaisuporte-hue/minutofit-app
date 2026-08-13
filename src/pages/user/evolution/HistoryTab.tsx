import { WorkoutHistorySection } from '../components/WorkoutHistorySection';

/**
 * Aba Histórico — o "training log" do aluno.
 *
 * A seção já existia na Evolução; aqui ela ganha a aba e, na P1, passa a
 * paginar por cursor (antes puxava 100 sessões de uma vez e cortava no cliente,
 * o que escondia o histórico antigo de quem treina há mais de um ano).
 */
export default function HistoryTab() {
  return <WorkoutHistorySection />;
}
