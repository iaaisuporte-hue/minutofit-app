/**
 * Read model da sessão de treino (P5A — fundação do Voice Workout).
 *
 * O parser de comandos de voz (P5B) não deve ler dezenas de `useState`
 * internos da página — ele lê ISTO, um objeto plano derivado do mesmo estado
 * que a UI manual já usa. `buildWorkoutSnapshot` é pura: não sabe de React,
 * só de `DraftExercise[]` e alguns primitivos, os mesmos que a página já
 * calcula para renderizar (`current`, `serieAtual`, `prevLoad`, `rest`).
 */

import type { DraftExercise } from "../sessionDraft";
import { serieAtual } from "../setSteppers";

export interface WorkoutSnapshot {
  mode: "free" | "plan";
  workoutStartedAt: number;
  elapsedSeconds: number;

  exerciseIndex: number;
  totalExercises: number;
  exerciseId: string | null;
  exerciseName: string;

  currentSetIndex: number | null;
  totalSets: number;
  plannedReps: string | null;
  currentLoadKg: string | null;
  currentReps: string | null;

  /** Carga da série anterior JÁ REGISTRADA nesta sessão, ou `null`. */
  previousSetLoadKg: number | null;
  /** Última carga conhecida deste exercício (histórico), ou `null`. */
  lastKnownLoadKg: number | null;

  restActive: boolean;
  restRunning: boolean;
  restSecondsLeft: number;
  restEndsAt: number | null;

  nextExerciseName: string | null;
  biSet: boolean;

  /** Há série preenchida (carga ou reps) mas não marcada em algum exercício. */
  filledUnchecked: boolean;
  /** Quantos exercícios não têm nenhuma série concluída. */
  pendingExercises: number;

  /** Nomes de todos os exercícios da sessão — universo de "vai para o X". */
  sessionExerciseNames: string[];
}

export interface BuildSnapshotInput {
  mode: "free" | "plan";
  exercises: readonly DraftExercise[];
  currentIndex: number;
  startedAt: number;
  now: number;
  /** `prevLoad.get(exerciseId)` — já calculado pela página a partir do histórico. */
  lastKnownLoadKg: number | null;
  rest: { active: boolean; running: boolean; secondsLeft: number };
  restEndsAt: number | null;
}

function parseCarga(v: string | undefined | null): number | null {
  if (!v) return null;
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function buildWorkoutSnapshot(input: BuildSnapshotInput): WorkoutSnapshot {
  const { mode, exercises, currentIndex, startedAt, now, lastKnownLoadKg, rest, restEndsAt } = input;
  const current = exercises[currentIndex] ?? null;
  const currentSet = current ? serieAtual(current.sets) : null;
  const setPos = current && currentSet ? current.sets.findIndex((s) => s.setIndex === currentSet.setIndex) : -1;
  const previousSet = current && setPos > 0 ? current.sets[setPos - 1] : null;

  let pendingExercises = 0;
  let filledUnchecked = false;
  for (const ex of exercises) {
    if (!ex.sets.some((s) => s.done)) pendingExercises += 1;
    if (ex.sets.some((s) => !s.done && (s.loadKg.trim() !== "" || s.reps.trim() !== ""))) {
      filledUnchecked = true;
    }
  }

  return {
    mode,
    workoutStartedAt: startedAt,
    elapsedSeconds: Math.max(0, Math.floor((now - startedAt) / 1000)),

    exerciseIndex: currentIndex,
    totalExercises: exercises.length,
    exerciseId: current?.exerciseId ?? null,
    exerciseName: current?.name ?? "",

    currentSetIndex: currentSet?.setIndex ?? null,
    totalSets: current?.sets.length ?? 0,
    plannedReps: currentSet?.plannedReps ?? null,
    currentLoadKg: currentSet?.loadKg ?? null,
    currentReps: currentSet?.reps ?? null,

    previousSetLoadKg: parseCarga(previousSet?.loadKg),
    lastKnownLoadKg,

    restActive: rest.active,
    restRunning: rest.running,
    restSecondsLeft: rest.secondsLeft,
    restEndsAt,

    nextExerciseName: exercises[currentIndex + 1]?.name ?? null,
    biSet: !!current?.biSetGroupId,

    filledUnchecked,
    pendingExercises,
    sessionExerciseNames: exercises.map((e) => e.name),
  };
}
