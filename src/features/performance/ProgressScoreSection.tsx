import { ProgressScoreCard } from "./ProgressScoreCard";
import { PerformanceUpsell } from "./PerformanceUpsell";
import { usePerformanceOverview } from "./usePerformanceOverview";

/**
 * Entrada do Progress Score na aba Visão geral (Spec 033, P3).
 *
 * Falha de rede não vira mensagem de erro: a Evolução inteira continua útil sem
 * o score, e um alerta vermelho no topo por causa de um bloco opcional custaria
 * mais confiança do que informa. O gating, ao contrário, é dito — o aluno tem o
 * direito de saber que existe algo do outro lado.
 */
export function ProgressScoreSection() {
  const state = usePerformanceOverview();

  if (state.status === "loading") {
    return (
      <section className="perf-score-card" aria-busy="true">
        <div className="metabolic-eyebrow">Progress Score</div>
        <p className="metabolic-section-copy">Carregando sua leitura de evolução...</p>
      </section>
    );
  }

  if (state.status === "error") return null;

  if (state.data.gated) return <PerformanceUpsell area="evolucao" />;

  return (
    <ProgressScoreCard
      score={state.data.score}
      load={state.data.load}
      headline={state.data.headline}
    />
  );
}
