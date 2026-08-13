import { useEffect, useState } from "react";
import { searchExercises, type ExerciseSummary } from "../../services/exercisesApi";
import { createGoal, type CreateGoalInput, type Goal, type GoalKind } from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";

/**
 * Criação de meta (Spec 033, Onda P4).
 *
 * O fluxo é tipo → exercício (quando o tipo pede) → alvo → prazo opcional. Não
 * há campo de "valor atual": o ponto de partida é medido pelo servidor. Deixar
 * o aluno digitá-lo abriria a porta para uma meta que nasce a 90% de progresso
 * — e o número dele discordaria do que a aba Recordes mostra.
 *
 * O erro do servidor é exibido literal porque ele é, com frequência,
 * orientação: "você já está nesse patamar, escolha um alvo acima do seu melhor
 * atual" ensina mais do que um "erro ao criar meta" genérico.
 */

const KINDS: { id: GoalKind; label: string; help: string; needsExercise: boolean }[] = [
  { id: "exercise_load", label: "Carga em um exercício", help: "Ex.: chegar a 100 kg no supino.", needsExercise: true },
  { id: "exercise_e1rm", label: "1RM estimado", help: "Sua força máxima estimada em um exercício.", needsExercise: true },
  { id: "exercise_reps_at_load", label: "Repetições com uma carga", help: "Ex.: 12 repetições com 30 kg.", needsExercise: true },
  { id: "weekly_frequency", label: "Treinos por semana", help: "Quantos dias treinar de segunda a domingo.", needsExercise: false },
  { id: "monthly_frequency", label: "Treinos no mês", help: "Quantos dias treinar neste mês.", needsExercise: false },
  { id: "streak", label: "Dias seguidos", help: "Sequência de dias treinando sem interromper.", needsExercise: false },
];

/** Rótulo do alvo por tipo — a unidade é do tipo, não uma escolha do aluno. */
const TARGET_LABEL: Record<GoalKind, string> = {
  exercise_load: "Carga alvo (kg)",
  exercise_e1rm: "1RM alvo (kg)",
  exercise_reps_at_load: "Carga (kg)",
  weekly_frequency: "Treinos por semana",
  monthly_frequency: "Treinos no mês",
  streak: "Dias seguidos",
};

export function GoalForm({
  onCreated,
  onCancel,
}: {
  onCreated: (goal: Goal) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<GoalKind>("exercise_load");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ExerciseSummary[]>([]);
  const [exercise, setExercise] = useState<ExerciseSummary | null>(null);
  const [target, setTarget] = useState("");
  const [reps, setReps] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = KINDS.find((k) => k.id === kind)!;

  useEffect(() => {
    if (!meta.needsExercise || query.trim().length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchExercises({ q: query.trim(), limit: 8 })
        .then((res) => {
          if (!cancelled) setOptions(res);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, meta.needsExercise]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (meta.needsExercise && !exercise) {
      setError("Escolha o exercício da meta.");
      return;
    }
    const alvo = Number(target.replace(",", "."));
    if (!Number.isFinite(alvo) || alvo <= 0) {
      setError("Informe um alvo válido.");
      return;
    }

    const payload: CreateGoalInput = {
      kind,
      exerciseId: meta.needsExercise ? exercise!.id : null,
      targetValue: alvo,
      targetReps: kind === "exercise_reps_at_load" ? Number(reps) : null,
      dueOn: dueOn || null,
    };

    setSaving(true);
    try {
      const goal = await createGoal(payload);
      // Só o tipo: quanto o aluno quer levantar é dado dele, não métrica de produto.
      postPerformanceEvent("performance.goal_created", { kind });
      onCreated(goal);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="perf-goal-form" onSubmit={submit}>
      <div className="perf-goal-field">
        <label htmlFor="goal-kind">Tipo de meta</label>
        <select
          id="goal-kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as GoalKind);
            setExercise(null);
            setQuery("");
            setTarget("");
            setReps("");
            setError(null);
          }}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <p className="perf-goal-help">{meta.help}</p>
      </div>

      {meta.needsExercise && (
        <div className="perf-goal-field">
          <label htmlFor="goal-exercise">Exercício</label>
          {exercise ? (
            <div className="perf-goal-chosen">
              <span>{exercise.name}</span>
              <button type="button" className="perf-goal-action" onClick={() => setExercise(null)}>
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input
                id="goal-exercise"
                type="text"
                autoComplete="off"
                placeholder="Buscar exercício"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {options.length > 0 && (
                <ul className="perf-goal-options">
                  {options.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setExercise(o)}>
                        {o.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="perf-goal-field">
        <label htmlFor="goal-target">{TARGET_LABEL[kind]}</label>
        <input
          id="goal-target"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="1"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>

      {kind === "exercise_reps_at_load" && (
        <div className="perf-goal-field">
          <label htmlFor="goal-reps">Repetições</label>
          <input
            id="goal-reps"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="100"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
      )}

      <div className="perf-goal-field">
        <label htmlFor="goal-due">Prazo (opcional)</label>
        <input
          id="goal-due"
          type="date"
          value={dueOn}
          onChange={(e) => setDueOn(e.target.value)}
        />
        <p className="perf-goal-help">Sem prazo, a meta fica valendo até você concluir ou abandonar.</p>
      </div>

      {error && (
        <p className="perf-goal-error" role="alert">
          {error}
        </p>
      )}

      <div className="perf-goal-form-actions">
        <button type="submit" className="perf-goal-submit" disabled={saving}>
          {saving ? "Criando..." : "Criar meta"}
        </button>
        <button type="button" className="perf-goal-action" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
