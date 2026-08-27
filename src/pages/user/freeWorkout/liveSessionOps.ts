/**
 * Edição da lista DURANTE o treino livre — puras, sem React.
 *
 * As operações de `freeSessionOps.ts` não servem aqui: lá a lista é de escolhas
 * (`FreeWorkoutItem`), aqui é de execução (`DraftExercise`), e cada série já
 * pode ter carga, repetições e ✓ que precisam sobreviver a um "troquei a ordem"
 * ou "o banco estava ocupado, tirei esse".
 *
 * O que torna estas funções necessárias é o remapeamento: três coisas do Modo
 * Treino apontam para exercício POR ÍNDICE — o exercício atual, o dono do
 * descanso em contagem e os desconfortos marcados no resumo. Reordenar sem
 * remapear os três faria o aluno relatar dor no exercício errado, que é dado
 * clínico entrando torto. Por isso toda operação devolve a lista nova E os
 * índices já corrigidos, num resultado só: não há como aplicar metade.
 */

import type { DraftExercise } from "../workoutSession/sessionDraft";
import {
  buildFreeDraftExercises,
  DEFAULT_REPS,
  DEFAULT_REST_S,
  DEFAULT_SETS,
  MAX_EXERCISES,
} from "./freeSessionOps";

export interface LiveSessionState {
  exercises: readonly DraftExercise[];
  currentIndex: number;
  /** Índice do exercício dono do descanso em contagem; null quando não há. */
  restExIdx: number | null;
  /** Índices marcados como "incomodou" (o Set do resumo). */
  discomfort: ReadonlySet<number>;
}

export interface LiveSessionResult {
  exercises: DraftExercise[];
  currentIndex: number;
  restExIdx: number | null;
  /**
   * true quando o dono do descanso saiu da lista: o timer perdeu o sentido e
   * precisa ser cancelado. Reordenar não cancela — o descanso é o mesmo, só
   * mudou de posição.
   */
  restOwnerRemoved: boolean;
  discomfort: Set<number>;
  /** false quando a operação foi recusada (teto, duplicado, último exercício). */
  changed: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unchanged(state: LiveSessionState): LiveSessionResult {
  return {
    exercises: [...state.exercises],
    currentIndex: state.currentIndex,
    restExIdx: state.restExIdx,
    restOwnerRemoved: false,
    discomfort: new Set(state.discomfort),
    changed: false,
  };
}

/** `null` no retorno de `mapIndex` significa "este exercício deixou de existir". */
function applyMapping(
  state: LiveSessionState,
  exercises: DraftExercise[],
  mapIndex: (index: number) => number | null,
): LiveSessionResult {
  const last = Math.max(0, exercises.length - 1);
  // Quando o exercício atual é o removido, o índice fica onde estava: quem
  // assumiu a posição é o próximo da lista, que é para onde o aluno olharia.
  const mappedCurrent = mapIndex(state.currentIndex) ?? state.currentIndex;
  const mappedRest = state.restExIdx == null ? null : mapIndex(state.restExIdx);

  const discomfort = new Set<number>();
  state.discomfort.forEach((index) => {
    const next = mapIndex(index);
    if (next != null) discomfort.add(next);
  });

  return {
    exercises,
    currentIndex: clamp(mappedCurrent, 0, last),
    restExIdx: mappedRest,
    restOwnerRemoved: state.restExIdx != null && mappedRest == null,
    discomfort,
    changed: true,
  };
}

/**
 * Adiciona ao fim, com os mesmos padrões da montagem (3×10, 60s) e séries
 * zeradas. Devolve `changed: false` no teto e no exercício repetido — a folha
 * fica aberta, e um toque a mais não pode duplicar em silêncio.
 */
export function addLiveExercise(
  state: LiveSessionState,
  exercise: { id: string; name: string; bodyPart: string | null },
): LiveSessionResult {
  if (state.exercises.length >= MAX_EXERCISES) return unchanged(state);
  if (state.exercises.some((ex) => ex.exerciseId === exercise.id)) return unchanged(state);

  const [fresh] = buildFreeDraftExercises([
    {
      exerciseId: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
      restS: DEFAULT_REST_S,
    },
  ]);

  // Só cresce no fim: nada muda de posição, então o mapeamento é a identidade.
  return applyMapping(state, [...state.exercises, fresh], (index) => index);
}

/**
 * Remove um exercício.
 *
 * Recusa o último: um treino sem exercício nenhum não é um estado que o Modo
 * Treino saiba renderizar, e sair de vez já tem fluxo próprio (descartar).
 * Quem chama decide se pede confirmação — `countDoneSets` diz o que se perde.
 */
export function removeLiveExercise(state: LiveSessionState, index: number): LiveSessionResult {
  if (index < 0 || index >= state.exercises.length) return unchanged(state);
  if (state.exercises.length <= 1) return unchanged(state);

  const exercises = state.exercises.filter((_, i) => i !== index);
  return applyMapping(state, exercises, (i) => (i === index ? null : i > index ? i - 1 : i));
}

/** Move uma posição para cima (`-1`) ou para baixo (`+1`). Borda = sem efeito. */
export function moveLiveExercise(
  state: LiveSessionState,
  index: number,
  direction: -1 | 1,
): LiveSessionResult {
  const target = index + direction;
  if (index < 0 || index >= state.exercises.length) return unchanged(state);
  if (target < 0 || target >= state.exercises.length) return unchanged(state);

  const exercises = [...state.exercises];
  [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
  return applyMapping(state, exercises, (i) => (i === index ? target : i === target ? index : i));
}

export function countDoneSets(exercise: DraftExercise): number {
  return exercise.sets.filter((set) => set.done).length;
}

/**
 * Há trabalho registrado que a remoção descartaria?
 *
 * Conta série marcada E série apenas digitada: carga anotada e não marcada é
 * trabalho que o aluno acha que registrou — sumir com ela sem avisar seria a
 * mesma perda silenciosa que o alerta de "séries preenchidas" existe para evitar.
 */
export function hasRecordedWork(exercise: DraftExercise): boolean {
  return exercise.sets.some(
    (set) => set.done || set.loadKg.trim() !== "" || set.reps.trim() !== "",
  );
}
