import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getScoreHistory,
  type ProgressScoreBlock,
  type ScoreFactor,
  type TrainingLoadBlock,
} from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";

/**
 * Progress Score (Spec 033, Onda P3).
 *
 * ## O número nunca aparece sozinho
 *
 * A decisão de produto que autorizou este score exige que ele venha sempre com
 * o breakdown — a regra é que o aluno consiga responder "por que mudou?" sem
 * perguntar a ninguém. Por isso a hierarquia é: número → o que mudou na semana
 * → de onde ele vem. O gráfico é o último nível, para quem quiser.
 *
 * ## Sem depender de cor
 *
 * Cada movimento carrega SETA e TEXTO além da cor. Quem não distingue verde de
 * vermelho — ou está no modo daltônico do app — lê a mesma informação.
 */

const TREND_META: Record<ProgressScoreBlock["trend"], { arrow: string; label: string }> = {
  up: { arrow: "↑", label: "em alta" },
  stable: { arrow: "→", label: "estável" },
  down: { arrow: "↓", label: "em queda" },
};

function DeltaChip({ factor }: { factor: ScoreFactor }) {
  const up = factor.delta > 0;
  const flat = factor.delta === 0;
  const arrow = flat ? "→" : up ? "↑" : "↓";
  const cls = flat ? "" : up ? " is-up" : " is-down";
  return (
    <li className={`perf-score-factor${cls}`}>
      <span className="perf-score-factor-arrow" aria-hidden="true">{arrow}</span>
      <span className="perf-score-factor-label">{factor.label}</span>
      {!flat && (
        <span className="perf-score-factor-delta">
          {up ? "+" : "−"}
          {Math.abs(factor.delta)}
        </span>
      )}
    </li>
  );
}

function ScoreHistoryChart() {
  const [points, setPoints] = useState<{ date: string; score: number }[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getScoreHistory(90, controller.signal).then((res) => {
      if (!controller.signal.aborted && res && !res.gated) setPoints(res.points);
    });
    postPerformanceEvent("performance.score_history_viewed", {});
    return () => controller.abort();
  }, []);

  // Menos de dois pontos não é uma linha. Mostrar um ponto solto sugeriria
  // tendência onde só existe uma medição.
  if (!points || points.length < 2) return null;

  const data = points.map((p) => ({
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
      .format(new Date(`${p.date}T12:00:00Z`)),
    score: p.score,
  }));

  return (
    <div style={{ width: "100%", height: 140 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} stroke="var(--color-border)" />
          <YAxis domain={[0, 100]} width={30} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} stroke="var(--color-border)" />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
            }}
            formatter={(v) => [`${v}`, "Progress Score"]}
          />
          {/* Sem interpolar buraco: dia sem snapshot não é um valor. */}
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressScoreCard({
  score,
  load,
  headline,
}: {
  score: ProgressScoreBlock | null;
  load: TrainingLoadBlock | null;
  headline: string;
}) {
  const [showFactors, setShowFactors] = useState(false);

  useEffect(() => {
    if (score) {
      postPerformanceEvent("performance.score_viewed", {
        status: score.status,
        // só a faixa, não o número: analytics mede adoção, não o dado do aluno
        hasValue: score.value != null,
      });
    }
  }, [score]);

  const somaSemana = useMemo(
    () => (score?.changes7d ?? []).reduce((acc, c) => acc + c.delta, 0),
    [score],
  );

  if (!score) return null;

  if (score.status === "onboarding") {
    return (
      <section className="perf-score-card">
        <div className="metabolic-eyebrow">Progress Score</div>
        <span className="perf-score-value perf-score-value--calibrating">Calibrando</span>
        <p className="metabolic-section-copy">{headline}</p>
      </section>
    );
  }

  const trend = TREND_META[score.trend];

  return (
    <section className="perf-score-card">
      <div className="metabolic-eyebrow">Progress Score</div>

      <div className="perf-score-head">
        <span className="perf-score-value">{score.value}</span>
        <span className="perf-score-trend">
          <span aria-hidden="true">{trend.arrow}</span> {trend.label}
        </span>
      </div>

      {score.changes7d.length > 0 && (
        <p className="perf-score-week">
          {somaSemana > 0 ? "+" : somaSemana < 0 ? "−" : ""}
          {somaSemana !== 0 ? Math.abs(somaSemana) : "sem mudança"}
          {somaSemana !== 0 ? " em relação à semana passada" : " em relação à semana passada"}
        </p>
      )}

      <p className="metabolic-section-copy">{headline}</p>

      {load?.ratioLabel && (
        <p className="perf-score-load">
          Ritmo de treino: <strong>{load.ratioLabel.toLowerCase()}</strong>
        </p>
      )}

      <button
        type="button"
        className="perf-score-toggle"
        aria-expanded={showFactors}
        onClick={() => {
          const next = !showFactors;
          setShowFactors(next);
          if (next) postPerformanceEvent("performance.score_component_opened", {});
        }}
      >
        {showFactors ? "Ocultar o que compõe" : "Ver o que compõe este número"}
      </button>

      {showFactors && (
        <>
          {score.changes7d.length > 0 && (
            <>
              <div className="metabolic-eyebrow">O que mudou na semana</div>
              <ul className="perf-score-factors">
                {score.changes7d.map((f) => (
                  <DeltaChip key={`c-${f.id}`} factor={f} />
                ))}
              </ul>
            </>
          )}

          <div className="metabolic-eyebrow">De onde vem o número</div>
          <ul className="perf-score-factors">
            {score.factors.map((f) => (
              <DeltaChip key={f.id} factor={f} />
            ))}
          </ul>

          <ScoreHistoryChart />
        </>
      )}
    </section>
  );
}
