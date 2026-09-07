/**
 * Comandos puros sobre a sessão de treino (P5A — fundação do Voice Workout).
 *
 * Mesma ideia de `liveSessionOps.ts`: funções sem React, testáveis isoladas,
 * que devolvem a lista nova (ou a mesma, sem mudar nada) e um `changed` que diz
 * se algo de fato aconteceu. A página aplica o resultado (`setExercises`,
 * `persist`, evento, háptico, início de descanso) — aqui só mora a REGRA.
 *
 * `completeSet` é IDEMPOTENTE de propósito: chamar duas vezes com a mesma série
 * já concluída não desmarca nada (`changed: false`). É a garantia que falta
 * para um comando de voz, sujeito a eco/repetição do reconhecedor, poder ser
 * reenviado sem risco — diferente do `toggleDone` da UI manual, que alterna e
 * continua existindo, para quem precisa desmarcar por engano.
 */

import type { DraftExercise, DraftSetEntry } from "../sessionDraft";

export type SetCommandReason =
  | "no_exercise"
  | "no_set"
  | "already_completed"
  | "not_completed"
  | "invalid_value";

export interface SetCommandResult {
  exercises: DraftExercise[];
  changed: boolean;
  reason?: SetCommandReason;
  /**
   * Presente só quando uma série foi REALMENTE concluída agora (não em um
   * no-op idempotente) e ela dispara descanso — mesma regra de hoje: bi-set
   * não descansa, série sem `plannedRestS` não descansa. É o sinal para a
   * página chamar `rest.start(...)`, que continua sendo o único dono do
   * cronômetro.
   */
  restStart: { plannedRestS: number } | null;
}

function semMudanca(exercises: readonly DraftExercise[], reason: SetCommandReason): SetCommandResult {
  return { exercises: [...exercises], changed: false, reason, restStart: null };
}

function encontrarSerie(
  exercises: readonly DraftExercise[],
  exerciseIndex: number,
  setIndex: number,
): { exercicio: DraftExercise; serie: DraftSetEntry } | null {
  const exercicio = exercises[exerciseIndex];
  if (!exercicio) return null;
  const serie = exercicio.sets.find((s) => s.setIndex === setIndex);
  if (!serie) return null;
  return { exercicio, serie };
}

function substituirSerie(
  exercises: readonly DraftExercise[],
  exerciseIndex: number,
  setIndex: number,
  patch: Partial<DraftSetEntry>,
): DraftExercise[] {
  return exercises.map((ex, i) =>
    i === exerciseIndex
      ? { ...ex, sets: ex.sets.map((s) => (s.setIndex === setIndex ? { ...s, ...patch } : s)) }
      : ex,
  );
}

export interface CompleteSetInput {
  reps?: string;
  loadKg?: string;
}

/**
 * Conclui a série. No-op (idempotente) se ela já estava concluída — repetir a
 * chamada não desmarca, diferente do toggle manual.
 */
export function completeSet(
  exercises: readonly DraftExercise[],
  exerciseIndex: number,
  setIndex: number,
  input: CompleteSetInput,
  now: number,
): SetCommandResult {
  const alvo = encontrarSerie(exercises, exerciseIndex, setIndex);
  if (!alvo) {
    return semMudanca(exercises, exercises[exerciseIndex] ? "no_set" : "no_exercise");
  }
  if (alvo.serie.done) return semMudanca(exercises, "already_completed");

  const nextExercises = substituirSerie(exercises, exerciseIndex, setIndex, {
    reps: input.reps ?? alvo.serie.reps,
    loadKg: input.loadKg ?? alvo.serie.loadKg,
    done: true,
    completedAt: now,
  });

  const planned = alvo.serie.plannedRestS ?? 0;
  const isBiSet = !!alvo.exercicio.biSetGroupId;
  return {
    exercises: nextExercises,
    changed: true,
    restStart: planned > 0 && !isBiSet ? { plannedRestS: planned } : null,
  };
}

/** Reverte uma conclusão. Usado pelo "Desfazer" da voz — nunca pelo comando de voz em si. */
export function uncompleteSet(
  exercises: readonly DraftExercise[],
  exerciseIndex: number,
  setIndex: number,
): SetCommandResult {
  const alvo = encontrarSerie(exercises, exerciseIndex, setIndex);
  if (!alvo) return semMudanca(exercises, exercises[exerciseIndex] ? "no_set" : "no_exercise");
  if (!alvo.serie.done) return semMudanca(exercises, "not_completed");

  const nextExercises = substituirSerie(exercises, exerciseIndex, setIndex, {
    done: false,
    completedAt: null,
  });
  return { exercises: nextExercises, changed: true, restStart: null };
}

/** Escreve carga e/ou reps sem concluir a série — "30 quilos" dito antes de "fiz". */
export function applySetValues(
  exercises: readonly DraftExercise[],
  exerciseIndex: number,
  setIndex: number,
  patch: { reps?: string; loadKg?: string },
): SetCommandResult {
  const alvo = encontrarSerie(exercises, exerciseIndex, setIndex);
  if (!alvo) return semMudanca(exercises, exercises[exerciseIndex] ? "no_set" : "no_exercise");
  if (patch.reps === undefined && patch.loadKg === undefined) {
    return semMudanca(exercises, "invalid_value");
  }
  const nextExercises = substituirSerie(exercises, exerciseIndex, setIndex, patch);
  return { exercises: nextExercises, changed: true, restStart: null };
}

/**
 * Anexa o relato original de um comando de voz à série ("senti uma fisgada").
 * Sem classificação por tipo ainda (P5B/P5D) — aqui só o texto, preservado
 * como foi dito, truncado no mesmo limite do `discomfort`/`substitution_reason`
 * do backend (280). `null`/string vazia remove a observação.
 */
export function attachSetObservation(
  exercises: readonly DraftExercise[],
  exerciseIndex: number,
  setIndex: number,
  observation: string | null,
): SetCommandResult {
  const alvo = encontrarSerie(exercises, exerciseIndex, setIndex);
  if (!alvo) return semMudanca(exercises, exercises[exerciseIndex] ? "no_set" : "no_exercise");

  const trimmed = observation == null ? null : observation.trim().slice(0, 280) || null;
  const nextExercises = substituirSerie(exercises, exerciseIndex, setIndex, { observation: trimmed });
  return { exercises: nextExercises, changed: true, restStart: null };
}
