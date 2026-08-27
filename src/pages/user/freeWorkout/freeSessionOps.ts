/**
 * Operações de lista do treino livre — puras, sem React.
 *
 * A montagem (esta tela) e a edição durante a sessão são a MESMA lista: o aluno
 * que percebe na terceira série que o banco está ocupado troca o exercício sem
 * sair do treino. Manter as regras aqui, fora do componente, é o que permite
 * reusá-las nos dois lugares sem duplicar clamps — e testar as bordas (limite
 * de exercícios, primeiro/último ao reordenar) sem montar tela nenhuma.
 */

import type { DraftExercise } from "../workoutSession/sessionDraft";

/** Exercício escolhido pelo aluno, antes de virar séries. */
export interface FreeWorkoutItem {
  exerciseId: string;
  name: string;
  bodyPart: string | null;
  sets: number;
  /** Repetições planejadas — texto, como no fluxo prescrito (`plannedReps`). */
  reps: string;
  restS: number;
}

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = "10";
export const DEFAULT_REST_S = 60;

/**
 * Tetos do cliente. O servidor recusa mais de 40 itens e 200 séries por sessão;
 * 20 × 10 dá exatamente 200, então nenhuma combinação aceita aqui é recusada
 * lá. O limite de 20 é de produto (nenhum treino de academia tem mais que
 * isso), não técnico.
 */
export const MAX_EXERCISES = 20;
export const MAX_SETS = 10;
export const MIN_SETS = 1;
export const MAX_REPS = 50;
export const MIN_REPS = 1;
export const MAX_REST_S = 300;
export const MIN_REST_S = 0;
export const REST_STEP_S = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isFull(items: readonly FreeWorkoutItem[]): boolean {
  return items.length >= MAX_EXERCISES;
}

export function totalSets(items: readonly FreeWorkoutItem[]): number {
  return items.reduce((sum, item) => sum + item.sets, 0);
}

/**
 * Adiciona ao fim da lista.
 *
 * Devolve a MESMA lista quando o exercício já está montado ou quando o teto foi
 * atingido — a sheet fica aberta durante a montagem, e um toque repetido não
 * pode duplicar silenciosamente o mesmo exercício.
 */
export function addExercise(
  items: readonly FreeWorkoutItem[],
  exercise: { id: string; name: string; bodyPart: string | null },
): FreeWorkoutItem[] {
  if (isFull(items)) return items as FreeWorkoutItem[];
  if (items.some((item) => item.exerciseId === exercise.id)) return items as FreeWorkoutItem[];
  return [
    ...items,
    {
      exerciseId: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
      restS: DEFAULT_REST_S,
    },
  ];
}

export function removeAt(items: readonly FreeWorkoutItem[], index: number): FreeWorkoutItem[] {
  if (index < 0 || index >= items.length) return items as FreeWorkoutItem[];
  return items.filter((_, i) => i !== index);
}

/**
 * Move um exercício uma posição para cima (`-1`) ou para baixo (`+1`).
 *
 * Setas e não arrastar: o drag-and-drop HTML5 do builder do personal não
 * dispara em touch, e esta tela é usada com uma mão, de pé. Nas bordas devolve
 * a mesma lista, então o primeiro item nunca "some" ao tocar em subir.
 */
export function moveExercise(
  items: readonly FreeWorkoutItem[],
  index: number,
  direction: -1 | 1,
): FreeWorkoutItem[] {
  const target = index + direction;
  if (index < 0 || index >= items.length) return items as FreeWorkoutItem[];
  if (target < 0 || target >= items.length) return items as FreeWorkoutItem[];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function patchAt(
  items: readonly FreeWorkoutItem[],
  index: number,
  patch: (item: FreeWorkoutItem) => FreeWorkoutItem,
): FreeWorkoutItem[] {
  if (index < 0 || index >= items.length) return items as FreeWorkoutItem[];
  return items.map((item, i) => (i === index ? patch(item) : item));
}

export function setSets(items: readonly FreeWorkoutItem[], index: number, value: number): FreeWorkoutItem[] {
  const safe = Number.isFinite(value) ? Math.round(value) : DEFAULT_SETS;
  return patchAt(items, index, (item) => ({ ...item, sets: clamp(safe, MIN_SETS, MAX_SETS) }));
}

export function stepSets(items: readonly FreeWorkoutItem[], index: number, delta: number): FreeWorkoutItem[] {
  const current = items[index];
  return current ? setSets(items, index, current.sets + delta) : (items as FreeWorkoutItem[]);
}

/** Repetições ficam como texto (é o formato de `plannedReps`), mas só aceitam número. */
export function setReps(items: readonly FreeWorkoutItem[], index: number, value: number): FreeWorkoutItem[] {
  const safe = Number.isFinite(value) ? Math.round(value) : Number(DEFAULT_REPS);
  return patchAt(items, index, (item) => ({ ...item, reps: String(clamp(safe, MIN_REPS, MAX_REPS)) }));
}

export function stepReps(items: readonly FreeWorkoutItem[], index: number, delta: number): FreeWorkoutItem[] {
  const current = items[index];
  if (!current) return items as FreeWorkoutItem[];
  const parsed = parseInt(current.reps, 10);
  const base = Number.isFinite(parsed) ? parsed : Number(DEFAULT_REPS);
  return setReps(items, index, base + delta);
}

export function setRest(items: readonly FreeWorkoutItem[], index: number, value: number): FreeWorkoutItem[] {
  const safe = Number.isFinite(value) ? Math.round(value) : DEFAULT_REST_S;
  return patchAt(items, index, (item) => ({ ...item, restS: clamp(safe, MIN_REST_S, MAX_REST_S) }));
}

export function stepRest(items: readonly FreeWorkoutItem[], index: number, delta: number): FreeWorkoutItem[] {
  const current = items[index];
  return current ? setRest(items, index, current.restS + delta) : (items as FreeWorkoutItem[]);
}

/**
 * Converte a lista montada no formato que o Modo Treino consome.
 *
 * Variante local da `buildExercises` do fluxo prescrito — aquela parte de
 * `UserWorkoutPlanItem` (séries em texto, técnicas, bi-set) e não tem nada a
 * ler aqui. Bi-set não existe no treino livre: `biSetGroupId` é sempre null.
 */
export function buildFreeDraftExercises(items: readonly FreeWorkoutItem[]): DraftExercise[] {
  return items.map((item) => ({
    exerciseId: item.exerciseId,
    name: item.name,
    biSetGroupId: null,
    bodyPart: item.bodyPart,
    sets: Array.from({ length: clamp(item.sets, MIN_SETS, MAX_SETS) }, (_, i) => ({
      setIndex: i + 1,
      plannedReps: item.reps,
      plannedRestS: item.restS,
      loadKg: "",
      reps: "",
      done: false,
      restDoneS: null,
      completedAt: null,
    })),
  }));
}
