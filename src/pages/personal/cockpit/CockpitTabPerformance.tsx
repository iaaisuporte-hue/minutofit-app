import { useCallback, useEffect, useState } from "react";
import { Sparkles, Target, TrendingUp, Trophy } from "lucide-react";
import {
  PerformanceAccessError,
  fetchStudentPerformance,
  requestPerformanceInsight,
  type PerformanceAiSummary,
  type PerformanceSignal,
  type PerformanceSnapshot,
} from "../../../services/personalPerformanceApi";
import { postPerformanceEvent } from "../../../features/performance/performanceEvents";

/**
 * Aba Performance do cockpit (Spec 033, Onda P5).
 *
 * ## Só leitura, e isso é uma decisão
 *
 * Não existe um botão sequer que altere score, recorde ou meta. O histórico de
 * performance é do aluno — foi ele quem treinou —, e a P5 é a camada que permite
 * ao personal ACOMPANHAR. Um "editar meta" aqui transformaria o registro do
 * esforço de alguém em documento editável por terceiros.
 *
 * ## Ordem da tela
 *
 * Estado geral → o que mudou → metas → recordes. É a ordem das perguntas que o
 * personal faz ao abrir o aluno: "como ele está?", depois "o que mudou desde a
 * última vez?", e só então os detalhes.
 *
 * ## Fato e texto não se misturam
 *
 * Os números vêm de `facts`, os cartões de `signals`, e o resumo em linguagem
 * natural fica atrás de um botão, num bloco próprio, dizendo se foi escrito por
 * IA. Sem essa separação visual o personal não teria como saber o que é cálculo
 * e o que é redação.
 */

const SEVERITY_LABEL: Record<PerformanceSignal["severity"], string> = {
  positive: "Avanço",
  attention: "Atenção",
  neutral: "Observação",
};

const TREND_LABEL: Record<string, { arrow: string; text: string }> = {
  up: { arrow: "↑", text: "em alta" },
  stable: { arrow: "→", text: "estável" },
  down: { arrow: "↓", text: "em queda" },
};

const PR_KIND_LABEL: Record<string, string> = {
  max_load: "carga máxima",
  best_e1rm: "1RM estimado",
  session_volume: "volume da sessão",
  max_reps: "repetições",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso));
}

function SignalCard({ signal }: { signal: PerformanceSignal }) {
  const [openEvidence, setOpenEvidence] = useState(false);
  return (
    <article className={`ppf-signal is-${signal.severity}`}>
      <header className="ppf-signal-head">
        {/* Severidade por TEXTO além da cor: a borda colorida é reforço. */}
        <span className="ppf-signal-badge">{SEVERITY_LABEL[signal.severity]}</span>
        <h4 className="ppf-signal-title">{signal.title}</h4>
      </header>
      <p className="ppf-signal-desc">{signal.description}</p>
      <button
        type="button"
        className="ppf-link-btn"
        aria-expanded={openEvidence}
        onClick={() => {
          const next = !openEvidence;
          setOpenEvidence(next);
          if (next) postPerformanceEvent("personal.performance_insight_opened", { type: signal.type });
        }}
      >
        {openEvidence ? "Ocultar evidência" : "Ver evidência"}
      </button>
      {openEvidence && (
        <dl className="ppf-evidence">
          <div>
            <dt>Período</dt>
            <dd>{signal.period}</dd>
          </div>
          {Object.entries(signal.evidence).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function CockpitTabPerformance({ studentId }: { studentId: string }) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PerformanceAiSummary | null>(null);
  const [summaryState, setSummaryState] = useState<"idle" | "loading" | "blocked">("idle");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await fetchStudentPerformance(studentId, signal);
        if (signal?.aborted) return;
        setSnapshot(data);
        setErrorCode(null);
      } catch (err) {
        if (signal?.aborted) return;
        setErrorCode(err instanceof PerformanceAccessError ? err.code : "UNKNOWN");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [studentId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    postPerformanceEvent("personal.performance_opened", {});
    return () => controller.abort();
  }, [load]);

  async function pedirResumo() {
    setSummaryState("loading");
    postPerformanceEvent("personal.performance_ai_summary_requested", {});
    try {
      const res = await requestPerformanceInsight(studentId);
      setSummary(res);
      setSummaryState("idle");
      postPerformanceEvent("personal.performance_ai_summary_shown", { source: res.source });
    } catch (err) {
      // Plano sem IA não é falha: é uma porta fechada, e a tela diz qual.
      setSummaryState(err instanceof PerformanceAccessError && err.code === "AI_NOT_ENABLED" ? "blocked" : "idle");
      if (!(err instanceof PerformanceAccessError && err.code === "AI_NOT_ENABLED")) {
        setSummary(null);
      }
    }
  }

  if (loading) {
    return (
      <div className="ppf-panel" aria-busy="true">
        <p className="ppf-muted">Carregando a performance do aluno...</p>
      </div>
    );
  }

  if (errorCode) {
    const consent = errorCode === "CONSENT_REQUIRED" || errorCode === "consent_required";
    const semVinculo = errorCode === "ASSIGNMENT_REQUIRED";
    return (
      <div className="pp-error-state" role="alert">
        <strong>
          {consent
            ? "O aluno não compartilha os dados de treino com você"
            : semVinculo
              ? "Este aluno não está na sua carteira"
              : "Não foi possível carregar a performance"}
        </strong>
        <p className="ppf-muted">
          {consent
            ? "Ele controla isso em “Minha equipe”, no app dele. Assim que autorizar, os dados aparecem aqui."
            : semVinculo
              ? "O vínculo pode ter sido encerrado."
              : "Tente novamente em instantes."}
        </p>
      </div>
    );
  }

  if (!snapshot) return null;

  const { facts, signals } = snapshot;
  const trend = facts.scoreTrend ? TREND_LABEL[facts.scoreTrend] : null;
  const semDados =
    facts.score == null && facts.recentPrs.length === 0 && facts.goals.length === 0 && facts.sessions30d === 0;

  if (semDados) {
    return (
      <div className="ppf-panel">
        <h3 className="ppf-h3">Ainda sem histórico de treino</h3>
        <p className="ppf-muted">
          Quando o aluno registrar treinos, a evolução dele aparece aqui: carga por exercício,
          recordes, frequência e metas.
        </p>
      </div>
    );
  }

  return (
    <div className="ppf-wrap">
      {/* ── Estado geral ─────────────────────────────────────────────── */}
      <section className="ppf-panel">
        <h3 className="ppf-h3">
          <TrendingUp size={16} aria-hidden="true" /> Estado geral
        </h3>
        <div className="ppf-score-row">
          <div>
            <span className="ppf-score">
              {facts.score ?? (facts.scoreStatus === "onboarding" ? "Calibrando" : "—")}
            </span>
            {facts.score != null && trend && (
              <span className="ppf-muted">
                {" "}
                <span aria-hidden="true">{trend.arrow}</span> {trend.text}
              </span>
            )}
          </div>
          <p className="ppf-muted ppf-score-caption">
            Progress Score{facts.scoreFormulaVersion != null ? ` · fórmula v${facts.scoreFormulaVersion}` : ""}
          </p>
        </div>

        <dl className="ppf-metrics">
          <div>
            <dt>Frequência (28 dias)</dt>
            <dd>
              {facts.consistency.activeDays28} dias
              {facts.consistency.pct != null ? ` · ${facts.consistency.pct}% do previsto` : ""}
            </dd>
          </div>
          <div>
            <dt>Esta semana</dt>
            <dd>
              {facts.consistency.activeDaysThisWeek} dias
              <span className="ppf-muted"> (semana passada: {facts.consistency.activeDaysLastWeek})</span>
            </dd>
          </div>
          <div>
            <dt>Ritmo de carga</dt>
            <dd>{facts.trainingLoad.label ?? "sem amostra suficiente"}</dd>
          </div>
          <div>
            <dt>Progressão de carga</dt>
            <dd>
              {facts.progressionHighlights.total > 0
                ? `${facts.progressionHighlights.improved} de ${facts.progressionHighlights.total} exercícios melhoraram`
                : "sem exercícios comparáveis ainda"}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── O que mudou ──────────────────────────────────────────────── */}
      <section className="ppf-panel">
        <h3 className="ppf-h3">
          <Sparkles size={16} aria-hidden="true" /> O que mudou
        </h3>
        {signals.length === 0 ? (
          <p className="ppf-muted">Nada fora do padrão dele no período.</p>
        ) : (
          <div className="ppf-signals">
            {signals.map((s) => (
              <SignalCard key={`${s.type}-${s.title}`} signal={s} />
            ))}
          </div>
        )}

        {summary ? (
          <div className="ppf-summary">
            <p className="ppf-summary-text">{summary.summary}</p>
            {summary.highlights.length > 0 && (
              <ul className="ppf-summary-list">
                {summary.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {summary.attentionPoints.length > 0 && (
              <ul className="ppf-summary-list">
                {summary.attentionPoints.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <p className="ppf-muted ppf-disclaimer">
              {summary.source === "ai"
                ? summary.disclaimer
                : "Resumo montado a partir dos próprios dados, sem IA."}
            </p>
          </div>
        ) : summaryState === "blocked" ? (
          <p className="ppf-muted">O resumo escrito faz parte do plano Pro.</p>
        ) : (
          <button
            type="button"
            className="ppf-link-btn"
            disabled={summaryState === "loading"}
            onClick={pedirResumo}
          >
            {summaryState === "loading" ? "Escrevendo..." : "Resumir em texto"}
          </button>
        )}
      </section>

      {/* ── Metas (somente leitura) ──────────────────────────────────── */}
      <section className="ppf-panel">
        <h3 className="ppf-h3">
          <Target size={16} aria-hidden="true" /> Metas do aluno
        </h3>
        {facts.goals.length === 0 ? (
          <p className="ppf-muted">O aluno ainda não definiu metas.</p>
        ) : (
          <ul className="ppf-goals">
            {facts.goals.slice(0, 6).map((g) => (
              <li key={g.id} className="ppf-goal">
                <span className="ppf-goal-label">{g.displayLabel}</span>
                <span className="ppf-muted">
                  {g.status === "active"
                    ? g.progress != null
                      ? `${Math.round(g.progress * 100)}%`
                      : "sem medição"
                    : g.status === "achieved"
                      ? "concluída"
                      : g.status === "expired"
                        ? "prazo vencido"
                        : "abandonada"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="ppf-muted ppf-note">Quem define as metas é o aluno. Aqui elas são só leitura.</p>
      </section>

      {/* ── Recordes ─────────────────────────────────────────────────── */}
      <section className="ppf-panel">
        <h3 className="ppf-h3">
          <Trophy size={16} aria-hidden="true" /> Recordes recentes
        </h3>
        {facts.recentPrs.length === 0 ? (
          <p className="ppf-muted">Nenhum recorde nos últimos 28 dias.</p>
        ) : (
          <ul className="ppf-prs">
            {facts.recentPrs.map((p) => (
              <li key={`${p.exerciseName}-${p.kind}-${p.achievedAt}`} className="ppf-pr">
                {/* O nome vem do evento, não de JOIN: exercício removido do
                    catálogo continua legível. */}
                <span className="ppf-pr-name">{p.exerciseName}</span>
                <span className="ppf-muted">
                  {PR_KIND_LABEL[p.kind] ?? p.kind} · {p.value}
                  {p.previousValue != null ? ` (antes ${p.previousValue})` : ""} · {formatDate(p.achievedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
