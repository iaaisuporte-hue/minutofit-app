import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, History, ListChecks, Pencil } from "lucide-react";
import {
  getExerciseInsights,
  getStudentAdherence,
  reviewExerciseInsight,
  PersonalInsightsError,
  type AdherenceSummary,
  type ExecutionCategory,
  type ExerciseInsight,
} from "../../../services/personalInsightsApi";
import { trackPersonalInsightsEvent } from "./personalInsightsEvents";
import { ExerciseInsightDrilldownModal } from "./ExerciseInsightDrilldownModal";
import { PlanReviewModal } from "./PlanReviewModal";

/**
 * Seção "Como a ficha foi seguida" + Insights (Sprint P2B), dentro da aba
 * Performance do cockpit (`CockpitTabPerformance.tsx`).
 *
 * Granularidade de EXERCÍCIO — não confundir com "Aderência às séries" do
 * `StudentExecutionCard.tsx` (série-a-série, aba Semana). As duas fórmulas
 * respondem perguntas diferentes e continuam coexistindo (ADHERENCE_DEFINITION
 * do harness da sprint) — a P2B resolve a ambiguidade por documentação, não
 * apagando a que já existia.
 *
 * Linguagem sem juízo (item 20 do harness): os buckets dizem "adaptado", não
 * "não seguiu a ficha"; o card de desconforto descreve o fato relatado, nunca
 * um diagnóstico.
 */

const BUCKET_ORDER: ExecutionCategory[] = [
  "EXECUTADO_CONFORME_PRESCRITO",
  "SUBSTITUIDO",
  "PARCIAL",
  "NAO_EXECUTADO",
];

const BUCKET_LABEL: Record<ExecutionCategory, string> = {
  EXECUTADO_CONFORME_PRESCRITO: "Conforme prescrição",
  SUBSTITUIDO: "Adaptado",
  PARCIAL: "Parcial",
  NAO_EXECUTADO: "Não executado",
};

const BUCKET_COLOR: Record<ExecutionCategory, string> = {
  EXECUTADO_CONFORME_PRESCRITO: "var(--color-success)",
  SUBSTITUIDO: "var(--color-info)",
  PARCIAL: "var(--color-warn)",
  NAO_EXECUTADO: "var(--color-danger)",
};

function AdherenceBuckets({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<AdherenceSummary | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorCode(null);
    getStudentAdherence(studentId, 30, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSummary(data);
        trackPersonalInsightsEvent("personal_adherence_viewed", { denominator: data.denominator });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setErrorCode(err instanceof PersonalInsightsError ? err.code : "UNKNOWN");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studentId]);

  if (loading) return <p className="ppf-muted">Calculando como a ficha foi seguida...</p>;

  if (errorCode) {
    const consent = errorCode === "CONSENT_REQUIRED";
    const semVinculo = errorCode === "ASSIGNMENT_REQUIRED";
    return (
      <p className="ppf-muted">
        {consent
          ? "O aluno não compartilha os dados de treino com você."
          : semVinculo
            ? "Este aluno não está mais na sua carteira."
            : "Não foi possível calcular a aderência à ficha agora."}
      </p>
    );
  }

  if (!summary || summary.denominator === 0) {
    return (
      <p className="ppf-muted">
        Ainda não há padrões relevantes de execução para mostrar aqui. À medida que o aluno treina, a
        ficha vai revelando o que está sendo seguido, adaptado ou pulado.
      </p>
    );
  }

  return (
    <div className="ppi-buckets">
      {BUCKET_ORDER.map((cat) => {
        const bucket = summary.buckets[cat];
        return (
          <div key={cat} className="ppi-bucket-row">
            <div className="ppi-bucket-label">
              <span>{BUCKET_LABEL[cat]}</span>
              <span className="ppf-muted">
                {bucket.count} · {bucket.pct ?? 0}%
              </span>
            </div>
            <div className="ppi-bucket-bar">
              <div
                className="ppi-bucket-fill"
                style={{ width: `${bucket.pct ?? 0}%`, background: BUCKET_COLOR[cat] }}
              />
            </div>
          </div>
        );
      })}
      {summary.addedCount > 0 ? (
        <p className="ppf-muted">
          + {summary.addedCount} {summary.addedCount === 1 ? "exercício adicionado" : "exercícios adicionados"} pelo
          aluno durante o treino (fora da ficha, não entra no total acima)
        </p>
      ) : null}
      <p className="ppf-muted">
        Últimos {summary.windowDays} dias · {summary.sessionsConsidered}{" "}
        {summary.sessionsConsidered === 1 ? "sessão considerada" : "sessões consideradas"}
      </p>
    </div>
  );
}

function InsightCard({
  insight,
  onViewHistory,
  onReview,
  onDismiss,
}: {
  insight: ExerciseInsight;
  onViewHistory: (insight: ExerciseInsight) => void;
  onReview: (insight: ExerciseInsight) => void;
  onDismiss: (insight: ExerciseInsight) => void;
}) {
  const isDiscomfort = insight.type === "DISCOMFORT_PATTERN";
  const topAlternative = insight.alternatives[0] ?? null;
  const approved = insight.alternatives.some((a) => a.approvedByPersonal);

  return (
    <article className={`ppi-insight ${isDiscomfort ? "is-discomfort" : "is-recurring"}`}>
      <header className="ppi-insight-head">
        {isDiscomfort ? (
          <AlertTriangle size={15} aria-hidden="true" />
        ) : (
          <ArrowRightLeft size={15} aria-hidden="true" />
        )}
        <h4 className="ppi-insight-title">{insight.originalExerciseName}</h4>
      </header>

      <p className="ppi-insight-desc">
        {isDiscomfort
          ? `Desconforto foi informado em ${insight.occurrenceCount} das últimas ${insight.windowSize} execuções recentes. Considere revisar com o aluno.`
          : `Substituído ${insight.occurrenceCount} das últimas ${insight.windowSize} vezes.`}
      </p>

      {topAlternative ? (
        <p className="ppf-muted">
          Principal alternativa: <strong>{topAlternative.exerciseName}</strong> ({topAlternative.count}x)
          {approved ? <span className="ppi-approved-badge"> · Alternativa já aprovada por você</span> : null}
        </p>
      ) : null}

      {!isDiscomfort && insight.predominantReason ? (
        <p className="ppf-muted">
          Motivo mais comum: {insight.predominantReason.text} ({insight.predominantReason.count}x)
        </p>
      ) : null}

      <div className="ppi-insight-actions">
        <button type="button" className="ppf-link-btn" onClick={() => onViewHistory(insight)}>
          <History size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Ver histórico
        </button>
        {topAlternative ? (
          <button type="button" className="ppf-link-btn" onClick={() => onReview(insight)}>
            <Pencil size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Revisar ficha
          </button>
        ) : null}
        <button type="button" className="ppf-link-btn" onClick={() => onDismiss(insight)}>
          Ignorar
        </button>
      </div>
    </article>
  );
}

export function CockpitAdherenceInsights({ studentId }: { studentId: string }) {
  const [insights, setInsights] = useState<ExerciseInsight[] | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<ExerciseInsight | null>(null);
  const [reviewing, setReviewing] = useState<ExerciseInsight | null>(null);

  const loadInsights = useCallback(
    async (signal?: AbortSignal) => {
      setInsightsLoading(true);
      setInsightsError(null);
      try {
        const data = await getExerciseInsights(studentId, signal);
        if (signal?.aborted) return;
        setInsights(data.insights);
        if (data.insights.length > 0) {
          trackPersonalInsightsEvent("personal_exercise_insight_viewed", { count: data.insights.length });
          const recurringCount = data.insights.filter((i) => i.type === "RECURRING_REPLACEMENT").length;
          if (recurringCount > 0) {
            trackPersonalInsightsEvent("personal_recurring_replacement_viewed", { count: recurringCount });
          }
        }
      } catch (err) {
        if (signal?.aborted) return;
        setInsightsError(err instanceof PersonalInsightsError ? err.code : "UNKNOWN");
      } finally {
        if (!signal?.aborted) setInsightsLoading(false);
      }
    },
    [studentId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadInsights(controller.signal);
    return () => controller.abort();
  }, [loadInsights]);

  const visibleInsights = useMemo(
    () => (insights ?? []).filter((i) => !dismissedIds.has(i.originalExerciseId)),
    [insights, dismissedIds],
  );

  function handleDismiss(insight: ExerciseInsight) {
    // Otimista: some da tela na hora (item do harness — "ignorar" é da SESSÃO
    // atual da UI, sem estado persistido). A chamada ao backend é best-effort,
    // só para registrar a decisão como cancelamento na telemetria.
    setDismissedIds((prev) => new Set(prev).add(insight.originalExerciseId));
    trackPersonalInsightsEvent("personal_plan_review_cancelled", { insightType: insight.type, source: "dismiss" });
    reviewExerciseInsight(studentId, insight.originalExerciseId, { action: "dismiss" }).catch(() => {});
  }

  function handleApplied(originalExerciseId: string) {
    setInsights((prev) => (prev ? prev.filter((i) => i.originalExerciseId !== originalExerciseId) : prev));
    void loadInsights();
  }

  return (
    <>
      <section className="ppf-panel">
        <h3 className="ppf-h3">
          <ListChecks size={16} aria-hidden="true" /> Como a ficha foi seguida
        </h3>
        <AdherenceBuckets studentId={studentId} />
      </section>

      <section className="ppf-panel">
        <h3 className="ppf-h3">
          <ArrowRightLeft size={16} aria-hidden="true" /> Padrões de execução
        </h3>

        {insightsLoading ? <p className="ppf-muted">Buscando padrões de substituição e desconforto...</p> : null}

        {!insightsLoading && insightsError ? (
          <p className="ppf-muted">
            {insightsError === "CONSENT_REQUIRED"
              ? "O aluno não compartilha os dados de treino com você."
              : insightsError === "ASSIGNMENT_REQUIRED"
                ? "Este aluno não está mais na sua carteira."
                : "Não foi possível carregar os padrões de execução agora."}
          </p>
        ) : null}

        {!insightsLoading && !insightsError && visibleInsights.length === 0 ? (
          <p className="ppf-muted">
            Ainda não há padrões relevantes de substituição ou desconforto para revisar.
          </p>
        ) : null}

        {!insightsLoading && !insightsError && visibleInsights.length > 0 ? (
          <div className="ppi-insights">
            {visibleInsights.map((insight) => (
              <InsightCard
                key={`${insight.type}-${insight.originalExerciseId}`}
                insight={insight}
                onViewHistory={setDrillDown}
                onReview={setReviewing}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        ) : null}
      </section>

      {drillDown ? (
        <ExerciseInsightDrilldownModal
          studentId={studentId}
          exerciseId={drillDown.originalExerciseId}
          exerciseName={drillDown.originalExerciseName}
          onClose={() => setDrillDown(null)}
        />
      ) : null}

      {reviewing ? (
        <PlanReviewModal
          studentId={studentId}
          insight={reviewing}
          onClose={() => setReviewing(null)}
          onApplied={handleApplied}
        />
      ) : null}
    </>
  );
}
