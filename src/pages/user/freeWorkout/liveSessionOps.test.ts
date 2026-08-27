/**
 * Edição da lista durante o treino livre.
 *
 * O que está sob teste aqui não é a lista — é o remapeamento. Trocar dois
 * exercícios de lugar sem levar junto o índice do desconforto faz o aluno
 * relatar dor no exercício que não doeu; remover o dono do descanso sem avisar
 * deixa um cronômetro contando para ninguém. As duas coisas passam despercebidas
 * em teste de renderização e aparecem no dado.
 */
import { describe, expect, it } from "vitest";
import {
  addLiveExercise,
  countDoneSets,
  hasRecordedWork,
  moveLiveExercise,
  removeLiveExercise,
  type LiveSessionState,
} from "./liveSessionOps";
import { buildFreeDraftExercises, DEFAULT_REST_S, MAX_EXERCISES } from "./freeSessionOps";
import type { DraftExercise } from "../workoutSession/sessionDraft";

function draftCom(ids: string[]): DraftExercise[] {
  return buildFreeDraftExercises(
    ids.map((id) => ({
      exerciseId: id,
      name: `Exercício ${id}`,
      bodyPart: "peito",
      sets: 3,
      reps: "10",
      restS: DEFAULT_REST_S,
    })),
  );
}

function estado(ids: string[], patch: Partial<LiveSessionState> = {}): LiveSessionState {
  return {
    exercises: draftCom(ids),
    currentIndex: 0,
    restExIdx: null,
    discomfort: new Set<number>(),
    ...patch,
  };
}

/** Marca a 1ª série do exercício como feita (com carga), como o aluno faria. */
function comSerieFeita(exercises: DraftExercise[], index: number): DraftExercise[] {
  return exercises.map((ex, i) =>
    i === index
      ? { ...ex, sets: ex.sets.map((s, j) => (j === 0 ? { ...s, done: true, loadKg: "40", reps: "10" } : s)) }
      : ex,
  );
}

describe("addLiveExercise", () => {
  it("entra no fim com os padrões da montagem e séries zeradas", () => {
    const out = addLiveExercise(estado(["a"]), { id: "b", name: "Remada", bodyPart: "costas" });

    expect(out.changed).toBe(true);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
    const novo = out.exercises[1];
    expect(novo.sets).toHaveLength(3);
    expect(novo.sets.every((s) => !s.done && s.loadKg === "" && s.reps === "")).toBe(true);
    expect(novo.sets[0].plannedReps).toBe("10");
    expect(novo.sets[0].plannedRestS).toBe(DEFAULT_REST_S);
    expect(novo.bodyPart).toBe("costas");
  });

  it("não move o exercício atual, o descanso nem os desconfortos", () => {
    const state = estado(["a", "b"], { currentIndex: 1, restExIdx: 1, discomfort: new Set([0, 1]) });
    const out = addLiveExercise(state, { id: "c", name: "Crucifixo", bodyPart: "peito" });

    expect(out.currentIndex).toBe(1);
    expect(out.restExIdx).toBe(1);
    expect(out.restOwnerRemoved).toBe(false);
    expect([...out.discomfort].sort()).toEqual([0, 1]);
  });

  it("recusa exercício já na lista", () => {
    const out = addLiveExercise(estado(["a"]), { id: "a", name: "Exercício a", bodyPart: "peito" });
    expect(out.changed).toBe(false);
    expect(out.exercises).toHaveLength(1);
  });

  it("recusa acima do teto de exercícios", () => {
    const ids = Array.from({ length: MAX_EXERCISES }, (_, i) => `e${i}`);
    const out = addLiveExercise(estado(ids), { id: "extra", name: "Extra", bodyPart: null });
    expect(out.changed).toBe(false);
    expect(out.exercises).toHaveLength(MAX_EXERCISES);
  });
});

describe("removeLiveExercise", () => {
  it("preserva as séries já executadas dos que ficam", () => {
    const state = estado(["a", "b", "c"]);
    const comCarga = { ...state, exercises: comSerieFeita([...state.exercises], 2) };
    const out = removeLiveExercise(comCarga, 0);

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["b", "c"]);
    expect(out.exercises[1].sets[0].done).toBe(true);
    expect(out.exercises[1].sets[0].loadKg).toBe("40");
  });

  it("desloca o exercício atual quando some alguém antes dele", () => {
    const out = removeLiveExercise(estado(["a", "b", "c"], { currentIndex: 2 }), 0);
    expect(out.currentIndex).toBe(1);
  });

  it("mantém a posição quando o removido é o atual — quem assume é o seguinte", () => {
    const out = removeLiveExercise(estado(["a", "b", "c"], { currentIndex: 1 }), 1);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "c"]);
    expect(out.currentIndex).toBe(1);
  });

  it("recua quando o removido é o último e era o atual", () => {
    const out = removeLiveExercise(estado(["a", "b"], { currentIndex: 1 }), 1);
    expect(out.currentIndex).toBe(0);
  });

  it("avisa que o dono do descanso saiu", () => {
    const out = removeLiveExercise(estado(["a", "b"], { restExIdx: 0 }), 0);
    expect(out.restOwnerRemoved).toBe(true);
    expect(out.restExIdx).toBeNull();
  });

  it("mantém o descanso quando quem saiu foi outro, corrigindo o índice", () => {
    const out = removeLiveExercise(estado(["a", "b", "c"], { restExIdx: 2 }), 0);
    expect(out.restOwnerRemoved).toBe(false);
    expect(out.restExIdx).toBe(1);
  });

  it("remapeia os desconfortos e descarta o do removido", () => {
    const state = estado(["a", "b", "c"], { discomfort: new Set([1, 2]) });
    const out = removeLiveExercise(state, 1);
    expect([...out.discomfort]).toEqual([1]); // era o índice 2 ("c")
  });

  it("recusa remover o último exercício", () => {
    const out = removeLiveExercise(estado(["a"]), 0);
    expect(out.changed).toBe(false);
    expect(out.exercises).toHaveLength(1);
  });

  it("ignora índice fora da lista", () => {
    const out = removeLiveExercise(estado(["a", "b"]), 5);
    expect(out.changed).toBe(false);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
  });
});

describe("moveLiveExercise", () => {
  it("troca de posição levando junto as séries executadas", () => {
    const state = estado(["a", "b"]);
    const comCarga = { ...state, exercises: comSerieFeita([...state.exercises], 0) };
    const out = moveLiveExercise(comCarga, 0, 1);

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["b", "a"]);
    expect(out.exercises[1].sets[0].done).toBe(true);
    expect(out.exercises[0].sets[0].done).toBe(false);
  });

  it("leva o exercício atual junto do movimento", () => {
    const out = moveLiveExercise(estado(["a", "b", "c"], { currentIndex: 0 }), 0, 1);
    expect(out.currentIndex).toBe(1);
  });

  it("empurra quem foi trocado de lugar", () => {
    const out = moveLiveExercise(estado(["a", "b", "c"], { currentIndex: 1 }), 0, 1);
    expect(out.currentIndex).toBe(0);
  });

  it("segue o descanso sem cancelá-lo", () => {
    const out = moveLiveExercise(estado(["a", "b"], { restExIdx: 0 }), 0, 1);
    expect(out.restExIdx).toBe(1);
    expect(out.restOwnerRemoved).toBe(false);
  });

  it("leva o desconforto para a nova posição", () => {
    const state = estado(["a", "b", "c"], { discomfort: new Set([2]) });
    const out = moveLiveExercise(state, 2, -1);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "c", "b"]);
    expect([...out.discomfort]).toEqual([1]);
  });

  it("não faz nada nas bordas", () => {
    expect(moveLiveExercise(estado(["a", "b"]), 0, -1).changed).toBe(false);
    expect(moveLiveExercise(estado(["a", "b"]), 1, 1).changed).toBe(false);
  });
});

describe("countDoneSets / hasRecordedWork", () => {
  it("conta só o que está marcado", () => {
    const exercises = comSerieFeita(draftCom(["a"]), 0);
    expect(countDoneSets(exercises[0])).toBe(1);
  });

  it("exercício intocado não tem trabalho registrado", () => {
    expect(hasRecordedWork(draftCom(["a"])[0])).toBe(false);
  });

  it("carga digitada e não marcada também conta como trabalho", () => {
    const [ex] = draftCom(["a"]);
    const digitado = { ...ex, sets: ex.sets.map((s, i) => (i === 0 ? { ...s, loadKg: "20" } : s)) };
    expect(hasRecordedWork(digitado)).toBe(true);
    expect(countDoneSets(digitado)).toBe(0);
  });
});
