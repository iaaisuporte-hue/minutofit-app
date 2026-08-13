import { useEffect, useState } from "react";
import { getPerformanceOverview, type PerformanceOverview } from "./performanceApi";
import { MonthHeatmap } from "./MonthHeatmap";

// Aba Consistência (Spec 033, P1).
//
// O número aqui é CONSISTÊNCIA DE FREQUÊNCIA — dias ativos ÷ dias prescritos
// pela ficha. Não confundir com "Aderência às séries" (séries feitas ÷ séries
// prescritas), que vive no cockpit do personal. São métricas diferentes, e um
// QA anterior encontrou as duas exibidas sob o mesmo rótulo. O glossário no fim
// da aba existe para que ninguém precise adivinhar qual é qual.

export function ConsistencyTab() {
  const [data, setData] = useState<PerformanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getPerformanceOverview(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const consistency = data?.consistency;
  const pct = consistency?.pct ?? null;
  const activeDays = consistency?.activeDays28 ?? 0;
  const targetPerWeek = consistency?.targetPerWeek ?? null;
  // O denominador pode vir da ficha do personal OU da meta que o próprio aluno
  // declarou (o aluno B2C nunca tem ficha). Chamar as duas de "sua ficha"
  // mentiria para metade da base.
  const targetSource = consistency?.targetSource ?? null;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="metabolic-eyebrow">Últimos 28 dias</div>
          <h2 className="metabolic-section-title">Consistência de frequência</h2>
          <p className="metabolic-section-copy">
            Quantos dias você treinou, comparado ao que está previsto para você.
          </p>
        </div>

        {loading ? (
          <p className="metabolic-section-copy">Carregando sua consistência…</p>
        ) : (
          <>
            <div className="metabolic-metric-grid">
              <div className="metabolic-metric">
                <span className="metabolic-metric-label">Dias ativos</span>
                <span className="perf-figure-value">
                  {activeDays}
                  <span className="perf-figure-unit">de 28</span>
                </span>
                <span className="metabolic-metric-hint">
                  Conta treino registrado no app e presença marcada pelo seu personal.
                </span>
              </div>

              <div className="metabolic-metric">
                <span className="metabolic-metric-label">Consistência</span>
                {/* pct null = sem ficha E sem meta. Mostrar 0% seria dizer que
                    o aluno faltou a tudo, quando nada foi combinado. */}
                {pct == null ? (
                  <>
                    <span className="perf-figure-value">—</span>
                    <span className="metabolic-metric-hint">
                      Defina uma meta de frequência semanal para acompanhar sua consistência —
                      ou peça a frequência ao seu personal.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="perf-figure-value">
                      {pct}
                      <span className="perf-figure-unit">%</span>
                    </span>
                    <span className="metabolic-metric-hint">
                      {targetSource === "goal" ? "Sua meta é de" : "Sua ficha prescreve"}{" "}
                      {targetPerWeek} {targetPerWeek === 1 ? "treino" : "treinos"} por semana.
                    </span>
                  </>
                )}
              </div>
            </div>

            {pct != null && (
              <div
                className="perf-bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Consistência de frequência"
              >
                <div className="perf-bar-fill" style={{ ["--perf-fill" as string]: `${pct}%` }} />
              </div>
            )}
          </>
        )}
      </section>

      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="metabolic-eyebrow">Calendário</div>
          <h2 className="metabolic-section-title">Seus dias de treino</h2>
        </div>
        <MonthHeatmap />
      </section>

      <dl className="perf-glossary">
        <div>
          <dt>Consistência de frequência</dt>
          <dd>
            Dias em que você treinou ÷ dias previstos para você — pela ficha do seu personal ou
            pela meta que você definiu —, nos últimos 28 dias. Mede presença.
          </dd>
        </div>
        <div>
          <dt>Aderência às séries</dt>
          <dd>
            Séries feitas ÷ séries prescritas dentro dos treinos. Mede execução, e aparece na visão
            do seu personal. É outro número — treinar todos os dias fazendo metade das séries dá
            consistência alta e aderência baixa.
          </dd>
        </div>
      </dl>
    </div>
  );
}
