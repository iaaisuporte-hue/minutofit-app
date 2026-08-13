import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { GoalCard } from "../../../features/performance/GoalCard";
import { GoalForm } from "../../../features/performance/GoalForm";
import { PerformanceUpsell } from "../../../features/performance/PerformanceUpsell";
import { abandonGoal, getGoals, type Goal } from "../../../features/performance/performanceApi";
import { postPerformanceEvent } from "../../../features/performance/performanceEvents";

/**
 * Aba Metas (Spec 033, Onda P4).
 *
 * A lista separa em andamento de encerradas porque as duas respondem perguntas
 * diferentes: as ativas são compromisso, as encerradas são história. Abandonadas
 * e expiradas ficam na mesma seção das concluídas, mas sem destaque — não
 * merecem competir visualmente com uma conquista.
 */
export default function GoalsTab() {
  const [data, setData] = useState<Goal[] | null>(null);
  const [gated, setGated] = useState(false);
  const [limits, setLimits] = useState({ activeCount: 0, maxActive: 5 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await getGoals(signal);
    if (signal?.aborted) return;
    if (!res) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setGated(res.gated);
    setData(res.goals);
    setLimits({ activeCount: res.activeCount, maxActive: res.maxActive });
    setFailed(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    postPerformanceEvent("performance.goal_viewed", {});
    return () => controller.abort();
  }, [load]);

  async function handleAbandon(goal: Goal) {
    setActionError(null);
    try {
      await abandonGoal(goal.id);
      postPerformanceEvent("performance.goal_cancelled", { kind: goal.kind });
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="metabolic-history-page" aria-busy="true">
        <p className="metabolic-section-copy">Carregando suas metas...</p>
      </div>
    );
  }

  if (gated) return <PerformanceUpsell area="metas" />;

  if (failed) {
    return (
      <div className="metabolic-history-page">
        <p className="metabolic-section-copy" role="alert">
          Não conseguimos carregar suas metas agora. Tente novamente em instantes.
        </p>
      </div>
    );
  }

  const goals = data ?? [];
  const ativas = goals.filter((g) => g.status === "active");
  const encerradas = goals.filter((g) => g.status !== "active");
  const noLimite = limits.activeCount >= limits.maxActive;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="metabolic-eyebrow">Metas</div>
          <h2 className="metabolic-section-title">Onde você quer chegar</h2>
          <p className="metabolic-section-copy">
            Você define o alvo; o acompanhamento é automático a partir dos treinos que você registra.
          </p>
        </div>

        {creating ? (
          <GoalForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              load();
            }}
          />
        ) : (
          <button
            type="button"
            className="perf-goal-submit"
            disabled={noLimite}
            onClick={() => setCreating(true)}
          >
            Criar meta
          </button>
        )}

        {noLimite && !creating && (
          <p className="perf-goal-help">
            Você tem {limits.maxActive} metas em andamento. Conclua ou abandone uma para criar outra.
          </p>
        )}

        {actionError && (
          <p className="perf-goal-error" role="alert">
            {actionError}
          </p>
        )}
      </section>

      {ativas.length === 0 && encerradas.length === 0 && !creating && (
        <section className="perf-soon">
          <Target size={22} aria-hidden="true" style={{ justifySelf: "center", color: "var(--color-accent)" }} />
          <span className="perf-soon-title">Nenhuma meta por enquanto</span>
          <p className="perf-soon-copy">
            Uma meta transforma "quero evoluir" em algo que dá para acompanhar: escolha um alvo de
            carga, de repetições ou de frequência e o S2Core mede o resto a partir dos seus treinos.
          </p>
        </section>
      )}

      {ativas.length > 0 && (
        <section style={{ display: "grid", gap: "var(--space-3)" }}>
          <div className="metabolic-eyebrow">Em andamento</div>
          {ativas.map((g) => (
            <GoalCard key={g.id} goal={g} onAbandon={handleAbandon} />
          ))}
        </section>
      )}

      {encerradas.length > 0 && (
        <section style={{ display: "grid", gap: "var(--space-3)" }}>
          <div className="metabolic-eyebrow">Histórico</div>
          {encerradas.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </section>
      )}
    </div>
  );
}
