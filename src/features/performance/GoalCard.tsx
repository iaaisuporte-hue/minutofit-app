import { useState } from "react";
import { Target } from "lucide-react";
import type { Goal } from "./performanceApi";

/**
 * Cartão de uma meta (Spec 033, Onda P4).
 *
 * Responde, na ordem em que a pergunta aparece na cabeça de quem olha: qual é a
 * meta, onde estou, quanto falta, estou avançando.
 *
 * ## A barra só aparece quando significa alguma coisa
 *
 * Sem medição (`progress === null`), não há barra — uma barra vazia comunica
 * "zero de progresso", que é uma afirmação diferente de "ainda não medimos".
 * Meta encerrada também não tem barra: ela conta um desfecho, não um caminho.
 */

const KIND_LABEL: Record<Goal["kind"], string> = {
  exercise_load: "Carga",
  exercise_e1rm: "1RM estimado",
  exercise_reps_at_load: "Repetições com carga",
  weekly_frequency: "Treinos por semana",
  monthly_frequency: "Treinos no mês",
  streak: "Dias seguidos",
};

const STATUS_LABEL: Record<Goal["status"], string> = {
  active: "Em andamento",
  achieved: "Concluída",
  abandoned: "Abandonada",
  expired: "Prazo vencido",
};

function fmt(n: number | null, unit: string): string {
  if (n == null) return "—";
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  return unit === "kg" ? `${v} kg` : unit === "reps" ? `${v} reps` : v;
}

/**
 * O rótulo vem do BACKEND (`displayLabel`), não é montado aqui.
 *
 * Na P4 esta função construía o texto no cliente. Funcionava até a P5 precisar
 * da mesma frase em outros dois lugares — a tela do personal e o resumo escrito
 * —, e três cópias da regra divergem no primeiro ajuste de redação: o personal
 * passaria a ler sobre uma meta que o aluno não reconhece.
 *
 * O fallback existe só para respostas antigas em cache do navegador; some
 * sozinho no primeiro carregamento novo.
 */
export function goalTitle(goal: Goal): string {
  if (goal.displayLabel) return goal.displayLabel;
  if (goal.kind === "exercise_reps_at_load") {
    return `${goal.exerciseName}: ${fmt(goal.targetValue, "kg")} × ${goal.targetReps} reps`;
  }
  if (goal.exerciseName) {
    return `${goal.exerciseName}: ${KIND_LABEL[goal.kind]} de ${fmt(goal.targetValue, "kg")}`;
  }
  if (goal.kind === "streak") return `${goal.targetValue} dias seguidos de treino`;
  if (goal.kind === "weekly_frequency") return `${goal.targetValue} treinos por semana`;
  return `${goal.targetValue} treinos no mês`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

export function GoalCard({
  goal,
  onAbandon,
}: {
  goal: Goal;
  onAbandon?: (goal: Goal) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const pct = goal.progress == null ? null : Math.round(goal.progress * 100);

  return (
    <article className={`perf-goal-card${goal.status === "achieved" ? " is-achieved" : ""}`}>
      <header className="perf-goal-head">
        <Target size={16} aria-hidden="true" className="perf-goal-icon" />
        <h3 className="perf-goal-title">{goalTitle(goal)}</h3>
        {/* Estado por texto, nunca só por cor — e só quando acrescenta algo: a
            meta ativa já vive sob o título "Em andamento", e repetir a palavra
            no cartão é ruído que o leitor de tela também teria de ouvir. */}
        {goal.status !== "active" && (
          <span className={`perf-goal-status is-${goal.status}`}>{STATUS_LABEL[goal.status]}</span>
        )}
      </header>

      {goal.status === "active" && (
        <>
          <p className="perf-goal-numbers">
            <strong>{fmt(goal.currentValue, goal.progressUnit)}</strong>
            {goal.baselineValue != null && (
              <span className="perf-goal-baseline"> · saiu de {fmt(goal.baselineValue, goal.progressUnit)}</span>
            )}
          </p>

          {pct != null ? (
            <>
              <div
                className="perf-goal-bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progresso da meta ${goalTitle(goal)}`}
              >
                <span className="perf-goal-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="perf-goal-remaining">
                {pct}% — faltam {fmt(goal.remaining, goal.progressUnit)}
              </p>
            </>
          ) : (
            <p className="perf-goal-remaining">
              Registre um treino deste exercício para começarmos a medir.
            </p>
          )}

          {goal.dueOn && <p className="perf-goal-due">Prazo: {formatDate(goal.dueOn)}</p>}

          {onAbandon &&
            (confirming ? (
              <div className="perf-goal-confirm">
                <span>Abandonar esta meta?</span>
                <button type="button" className="perf-goal-action" onClick={() => onAbandon(goal)}>
                  Abandonar
                </button>
                <button type="button" className="perf-goal-action" onClick={() => setConfirming(false)}>
                  Manter
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="perf-goal-action"
                onClick={() => setConfirming(true)}
              >
                Abandonar meta
              </button>
            ))}
        </>
      )}

      {goal.status === "achieved" && goal.achievedAt && (
        <p className="perf-goal-numbers">
          Alcançada em {formatDate(goal.achievedAt)}
          {goal.baselineValue != null && ` · saiu de ${fmt(goal.baselineValue, goal.progressUnit)}`}
        </p>
      )}

      {(goal.status === "abandoned" || goal.status === "expired") && (
        <p className="perf-goal-numbers perf-goal-muted">
          Alvo era {fmt(goal.targetValue, goal.unit)}
          {goal.dueOn && goal.status === "expired" && ` · prazo em ${formatDate(goal.dueOn)}`}
        </p>
      )}
    </article>
  );
}
