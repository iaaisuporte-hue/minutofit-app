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

import type { DraftExercise, DraftExerciseOrigin } from "../workoutSession/sessionDraft";
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
 * Desfaz o par de Bi-Set do qual `groupId` fazia parte.
 *
 * Bi-Set é uma dupla executada sem descanso no meio: sozinho, o vínculo deixa de
 * significar alguma coisa e passa a ser só um exercício que nunca dispara o
 * cronômetro. Por isso substituir ou remover um membro devolve o outro à
 * condição de exercício normal, com descanso — e também limpa `technique` do
 * remanescente quando ela ainda dizia "bi_set": sem isso o chip da execução
 * continuava anunciando um par que o próprio descanso já não respeitava mais
 * (QA da Execução Dinâmica, set/2026 — achado P2).
 */
function unlinkBiSetPartners(
  exercises: DraftExercise[],
  groupId: string | null | undefined,
): DraftExercise[] {
  if (!groupId) return exercises;
  return exercises.map((ex) => {
    if (ex.biSetGroupId !== groupId) return ex;
    const technique = ex.technique?.type === "bi_set" ? null : ex.technique;
    return { ...ex, biSetGroupId: null, technique };
  });
}

/**
 * Adiciona com os mesmos padrões da montagem (3×10, 60s) e séries zeradas.
 * Devolve `changed: false` no teto e no exercício repetido — a folha fica
 * aberta, e um toque a mais não pode duplicar em silêncio.
 *
 * Sem `opts` entra no fim e sem origem marcada, que é o comportamento do treino
 * livre desde sempre. `atIndex` (inserir no meio) e `origin` existem para o
 * treino prescrito, onde importa saber depois o que veio da ficha e o que o
 * aluno acrescentou.
 */
export function addLiveExercise(
  state: LiveSessionState,
  exercise: { id: string; name: string; bodyPart: string | null },
  opts?: { origin?: Extract<DraftExerciseOrigin, "user_added">; atIndex?: number },
): LiveSessionResult {
  if (state.exercises.length >= MAX_EXERCISES) return unchanged(state);
  if (state.exercises.some((ex) => ex.exerciseId === exercise.id)) return unchanged(state);

  const [built] = buildFreeDraftExercises([
    {
      exerciseId: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
      restS: DEFAULT_REST_S,
    },
  ]);
  const fresh: DraftExercise = opts?.origin ? { ...built, origin: opts.origin } : built;

  const position =
    opts?.atIndex == null ? state.exercises.length : clamp(opts.atIndex, 0, state.exercises.length);
  const exercises = [...state.exercises];
  exercises.splice(position, 0, fresh);

  // Entrando no fim nada muda de posição e o mapeamento vira a identidade —
  // nenhum índice existente é `>= position`.
  return applyMapping(state, exercises, (index) => (index >= position ? index + 1 : index));
}

/**
 * Troca o exercício de `index` por outro, herdando os parâmetros prescritos.
 *
 * O substituto nasce com o MESMO número de séries e as mesmas repetições e
 * descanso planejados — quem troca por banco ocupado quer o mesmo estímulo, não
 * recomeçar a prescrição. A execução, essa, nasce zerada: é outro exercício.
 * O original inteiro fica em `replacedSnapshot`, que é o que torna o desfazer
 * possível sem reler a ficha.
 */
export function replaceLiveExercise(
  state: LiveSessionState,
  index: number,
  exercise: { id: string; name: string; bodyPart: string | null },
  reason?: string | null,
): LiveSessionResult {
  const original = state.exercises[index];
  if (!original) return unchanged(state);
  if (state.exercises.some((ex, i) => i !== index && ex.exerciseId === exercise.id)) {
    return unchanged(state);
  }

  const first = original.sets[0];
  // Piso de uma série: exercício sem série nenhuma não é estado que o Modo
  // Treino saiba renderizar.
  const setCount = Math.max(1, original.sets.length);
  const substitute: DraftExercise = {
    exerciseId: exercise.id,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    biSetGroupId: null,
    origin: "replacement",
    replacedSnapshot: { ...original, sets: original.sets.map((set) => ({ ...set })) },
    substitutionReason: reason ?? null,
    sets: Array.from({ length: setCount }, (_, i) => ({
      setIndex: i + 1,
      plannedReps: first?.plannedReps ?? DEFAULT_REPS,
      plannedRestS: first?.plannedRestS ?? DEFAULT_REST_S,
      loadKg: "",
      reps: "",
      done: false,
      restDoneS: null,
      completedAt: null,
    })),
  };

  const exercises = unlinkBiSetPartners(
    state.exercises.map((ex, i) => (i === index ? substitute : ex)),
    original.biSetGroupId,
  );

  // Ninguém sai do lugar, então o mapeamento é a identidade.
  const result = applyMapping(state, exercises, (i) => i);
  // Exceção ao mapeamento: o desconforto era do exercício que saiu. Deixá-lo
  // colado ao índice faria a dor do agachamento virar dor do leg press — dado
  // clínico trocado em silêncio.
  result.discomfort.delete(index);
  return result;
}

/**
 * Desfaz uma substituição, restaurando o exercício original com as séries que
 * ele tinha. Recusa depois da primeira série concluída no substituto: a partir
 * daí existe execução real, e voltar atrás a apagaria.
 */
export function undoReplaceLiveExercise(state: LiveSessionState, index: number): LiveSessionResult {
  const current = state.exercises[index];
  if (!current) return unchanged(state);
  if (current.origin !== "replacement" || !current.replacedSnapshot) return unchanged(state);
  if (countDoneSets(current) > 0) return unchanged(state);

  // O par de Bi-Set não volta junto: o parceiro perdeu o vínculo na
  // substituição e devolver o groupId só ao restaurado deixaria um membro
  // órfão — exercício preso sem descanso, que é o defeito que desfazer o par
  // corrige.
  const restored: DraftExercise = { ...current.replacedSnapshot, biSetGroupId: null };
  return applyMapping(
    state,
    state.exercises.map((ex, i) => (i === index ? restored : ex)),
    (i) => i,
  );
}

/**
 * Remove um exercício.
 *
 * Recusa o último: um treino sem exercício nenhum não é um estado que o Modo
 * Treino saiba renderizar, e sair de vez já tem fluxo próprio (descartar).
 * Quem chama decide se pede confirmação — `countDoneSets` diz o que se perde.
 *
 * Tirar um membro de Bi-Set desfaz o par (o parceiro volta a ter descanso). No
 * treino livre é sempre no-op: lá `biSetGroupId` é sempre null.
 */
export function removeLiveExercise(state: LiveSessionState, index: number): LiveSessionResult {
  if (index < 0 || index >= state.exercises.length) return unchanged(state);
  if (state.exercises.length <= 1) return unchanged(state);

  const exercises = unlinkBiSetPartners(
    state.exercises.filter((_, i) => i !== index),
    state.exercises[index].biSetGroupId,
  );
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
