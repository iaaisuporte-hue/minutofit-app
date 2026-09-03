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
  replaceLiveExercise,
  undoReplaceLiveExercise,
  type LiveSessionState,
} from "./liveSessionOps";
import {
  buildFreeDraftExercises,
  DEFAULT_REPS,
  DEFAULT_REST_S,
  DEFAULT_SETS,
  MAX_EXERCISES,
} from "./freeSessionOps";
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

function estadoCom(
  exercises: DraftExercise[],
  patch: Partial<LiveSessionState> = {},
): LiveSessionState {
  return {
    exercises,
    currentIndex: 0,
    restExIdx: null,
    discomfort: new Set<number>(),
    ...patch,
  };
}

/** Vincula dois exercícios num Bi-Set, como a ficha do personal faria. */
function comBiSet(
  exercises: DraftExercise[],
  a: number,
  b: number,
  groupId = "g1",
): DraftExercise[] {
  return exercises.map((ex, i) => (i === a || i === b ? { ...ex, biSetGroupId: groupId } : ex));
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

describe("addLiveExercise — chamada sem opts (regressão)", () => {
  it("continua entrando no fim, sem origem marcada e sem mexer em índice nenhum", () => {
    const state = estado(["a", "b", "c"], {
      currentIndex: 1,
      restExIdx: 2,
      discomfort: new Set([0, 2]),
    });
    const out = addLiveExercise(state, { id: "d", name: "Remada", bodyPart: "costas" });

    expect(out.exercises).toEqual([
      ...draftCom(["a", "b", "c"]),
      ...buildFreeDraftExercises([
        {
          exerciseId: "d",
          name: "Remada",
          bodyPart: "costas",
          sets: DEFAULT_SETS,
          reps: DEFAULT_REPS,
          restS: DEFAULT_REST_S,
        },
      ]),
    ]);
    // Conteúdo igual não basta: o campo novo não pode aparecer onde antes não
    // havia nada — rascunho gravado assim precisa continuar valendo "prescrito".
    expect(out.exercises.every((ex) => !("origin" in ex))).toBe(true);
    expect(out.currentIndex).toBe(1);
    expect(out.restExIdx).toBe(2);
    expect(out.restOwnerRemoved).toBe(false);
    expect([...out.discomfort].sort()).toEqual([0, 2]);
    expect(out.changed).toBe(true);
  });
});

describe("addLiveExercise — atIndex e origin", () => {
  it("insere na posição pedida e marca a origem", () => {
    const out = addLiveExercise(
      estado(["a", "b", "c"]),
      { id: "novo", name: "Crucifixo", bodyPart: "peito" },
      { atIndex: 1, origin: "user_added" },
    );

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "novo", "b", "c"]);
    expect(out.exercises[1].origin).toBe("user_added");
    expect(out.exercises[1].sets).toHaveLength(DEFAULT_SETS);
  });

  it("empurra o exercício atual, o descanso e os desconfortos que estavam no ponto ou depois", () => {
    const state = estado(["a", "b", "c"], {
      currentIndex: 1,
      restExIdx: 1,
      discomfort: new Set([0, 1, 2]),
    });
    const out = addLiveExercise(state, { id: "novo", name: "Crucifixo", bodyPart: "peito" }, { atIndex: 1 });

    expect(out.currentIndex).toBe(2);
    expect(out.restExIdx).toBe(2);
    expect(out.restOwnerRemoved).toBe(false);
    expect([...out.discomfort].sort()).toEqual([0, 2, 3]);
  });

  it("não mexe em quem está antes do ponto de inserção", () => {
    const state = estado(["a", "b", "c"], { currentIndex: 0, restExIdx: 0, discomfort: new Set([0]) });
    const out = addLiveExercise(state, { id: "novo", name: "Crucifixo", bodyPart: "peito" }, { atIndex: 2 });

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b", "novo", "c"]);
    expect(out.currentIndex).toBe(0);
    expect(out.restExIdx).toBe(0);
    expect([...out.discomfort]).toEqual([0]);
  });
});

describe("replaceLiveExercise", () => {
  it("herda séries e parâmetros do original, zerando a execução", () => {
    const state = estadoCom(
      buildFreeDraftExercises([
        { exerciseId: "a", name: "Supino", bodyPart: "peito", sets: 4, reps: "8", restS: 90 },
        { exerciseId: "b", name: "Remada", bodyPart: "costas", sets: 3, reps: "10", restS: 60 },
      ]),
    );
    const comCarga = { ...state, exercises: comSerieFeita([...state.exercises], 0) };
    const out = replaceLiveExercise(comCarga, 0, {
      id: "z",
      name: "Crucifixo",
      bodyPart: "peito",
    }, "banco ocupado");

    expect(out.changed).toBe(true);
    const novo = out.exercises[0];
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["z", "b"]);
    expect(novo.name).toBe("Crucifixo");
    expect(novo.sets).toHaveLength(4);
    expect(novo.sets.every((s) => s.plannedReps === "8" && s.plannedRestS === 90)).toBe(true);
    expect(novo.sets.every((s) => !s.done && s.loadKg === "" && s.reps === "" && s.completedAt === null)).toBe(true);
    expect(novo.origin).toBe("replacement");
    expect(novo.substitutionReason).toBe("banco ocupado");
    expect(novo.replacedSnapshot?.exerciseId).toBe("a");
    expect(novo.replacedSnapshot?.sets[0].done).toBe(true);
    expect(novo.replacedSnapshot?.sets[0].loadKg).toBe("40");
  });

  it("não move ninguém: posição, exercício atual e descanso ficam onde estavam", () => {
    const state = estado(["a", "b", "c"], { currentIndex: 2, restExIdx: 2 });
    const out = replaceLiveExercise(state, 1, { id: "z", name: "Crucifixo", bodyPart: "peito" });

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "z", "c"]);
    expect(out.currentIndex).toBe(2);
    expect(out.restExIdx).toBe(2);
    expect(out.restOwnerRemoved).toBe(false);
  });

  it("descarta o desconforto do substituído e preserva os outros", () => {
    const state = estado(["a", "b", "c"], { discomfort: new Set([0, 1, 2]) });
    const out = replaceLiveExercise(state, 1, { id: "z", name: "Crucifixo", bodyPart: "peito" });
    // A dor era do "b". Migrar para o "z" seria inventar um relato clínico.
    expect([...out.discomfort].sort()).toEqual([0, 2]);
  });

  it("sem motivo informado grava null", () => {
    const out = replaceLiveExercise(estado(["a"]), 0, { id: "z", name: "Crucifixo", bodyPart: null });
    expect(out.exercises[0].substitutionReason).toBeNull();
  });

  it("recusa trocar por exercício que já está na lista", () => {
    const out = replaceLiveExercise(estado(["a", "b"]), 0, {
      id: "b",
      name: "Exercício b",
      bodyPart: "peito",
    });
    expect(out.changed).toBe(false);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
  });

  it("aceita trocar pelo mesmo exercício que está sendo substituído", () => {
    const out = replaceLiveExercise(estado(["a", "b"]), 0, {
      id: "a",
      name: "Exercício a",
      bodyPart: "peito",
    });
    expect(out.changed).toBe(true);
  });

  it("ignora índice fora da lista", () => {
    const out = replaceLiveExercise(estado(["a", "b"]), 5, { id: "z", name: "Crucifixo", bodyPart: null });
    expect(out.changed).toBe(false);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
  });
});

describe("Bi-Set — trocar ou tirar um membro desfaz o par", () => {
  /** Vincula com a `technique` que a montagem prescrita copiaria para o par. */
  function comTecnicaBiSet(exercises: DraftExercise[], a: number, b: number, groupId = "g1"): DraftExercise[] {
    return comBiSet(exercises, a, b, groupId).map((ex, i) =>
      i === a || i === b ? { ...ex, technique: { type: "bi_set", biSetGroupId: groupId } } : ex,
    );
  }

  it("substituir limpa o vínculo dos dois lados", () => {
    const state = estadoCom(comBiSet(draftCom(["a", "b", "c"]), 0, 1));
    const out = replaceLiveExercise(state, 0, { id: "z", name: "Crucifixo", bodyPart: "peito" });

    expect(out.exercises[0].biSetGroupId).toBeNull(); // o substituto nasce solto
    expect(out.exercises[1].biSetGroupId).toBeNull(); // e o parceiro volta a ter descanso
  });

  it("remover limpa o vínculo do parceiro que fica", () => {
    const state = estadoCom(comBiSet(draftCom(["a", "b", "c"]), 0, 1));
    const out = removeLiveExercise(state, 0);

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["b", "c"]);
    expect(out.exercises[0].biSetGroupId).toBeNull();
  });

  // QA da Execução Dinâmica (set/2026): o descanso do parceiro voltava a
  // funcionar, mas o chip "Bi-set" continuava na tela — a `technique` copiada
  // na montagem não acompanhava o `biSetGroupId` sendo limpo.
  it("substituir limpa também a `technique` do parceiro, não só o groupId", () => {
    const state = estadoCom(comTecnicaBiSet(draftCom(["a", "b", "c"]), 0, 1));
    const out = replaceLiveExercise(state, 0, { id: "z", name: "Crucifixo", bodyPart: "peito" });

    expect(out.exercises[1].technique).toBeNull();
  });

  it("remover limpa também a `technique` do parceiro remanescente", () => {
    const state = estadoCom(comTecnicaBiSet(draftCom(["a", "b", "c"]), 0, 1));
    const out = removeLiveExercise(state, 0);

    expect(out.exercises[0].technique).toBeNull();
  });

  it("não mexe em par de outro grupo", () => {
    const comDoisPares = comBiSet(comBiSet(draftCom(["a", "b", "c", "d"]), 0, 1, "g1"), 2, 3, "g2");
    const out = removeLiveExercise(estadoCom(comDoisPares), 0);

    expect(out.exercises.map((e) => e.biSetGroupId)).toEqual([null, "g2", "g2"]);
  });
});

describe("undoReplaceLiveExercise", () => {
  it("restaura o original com as séries que ele já tinha", () => {
    const base = estadoCom(comSerieFeita(draftCom(["a", "b"]), 0), { currentIndex: 1, restExIdx: 1 });
    const trocado = replaceLiveExercise(base, 0, { id: "z", name: "Crucifixo", bodyPart: "peito" });
    const out = undoReplaceLiveExercise({ ...base, exercises: trocado.exercises }, 0);

    expect(out.changed).toBe(true);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
    expect(out.exercises[0].sets[0].done).toBe(true);
    expect(out.exercises[0].sets[0].loadKg).toBe("40");
    expect(out.exercises[0].origin).toBeUndefined();
    expect(out.currentIndex).toBe(1);
    expect(out.restExIdx).toBe(1);
  });

  it("recusa depois de série concluída no substituto", () => {
    const trocado = replaceLiveExercise(estado(["a", "b"]), 0, {
      id: "z",
      name: "Crucifixo",
      bodyPart: "peito",
    });
    const executado = estadoCom(comSerieFeita(trocado.exercises, 0));
    const out = undoReplaceLiveExercise(executado, 0);

    expect(out.changed).toBe(false);
    expect(out.exercises[0].exerciseId).toBe("z");
  });

  it("recusa exercício que não veio de substituição", () => {
    expect(undoReplaceLiveExercise(estado(["a", "b"]), 0).changed).toBe(false);
  });

  it("recusa quando o snapshot não veio junto (rascunho corrompido)", () => {
    const trocado = replaceLiveExercise(estado(["a", "b"]), 0, {
      id: "z",
      name: "Crucifixo",
      bodyPart: "peito",
    });
    const semSnapshot = trocado.exercises.map((ex, i) =>
      i === 0 ? { ...ex, replacedSnapshot: undefined } : ex,
    );
    expect(undoReplaceLiveExercise(estadoCom(semSnapshot), 0).changed).toBe(false);
  });

  it("ignora índice fora da lista", () => {
    expect(undoReplaceLiveExercise(estado(["a", "b"]), 9).changed).toBe(false);
  });

  it("NÃO recompõe o Bi-Set desfeito — comportamento esperado, não defeito", () => {
    const state = estadoCom(comBiSet(draftCom(["a", "b"]), 0, 1));
    const trocado = replaceLiveExercise(state, 0, { id: "z", name: "Crucifixo", bodyPart: "peito" });
    const out = undoReplaceLiveExercise(estadoCom(trocado.exercises), 0);

    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["a", "b"]);
    // O parceiro perdeu o groupId na substituição e ninguém o devolve. Restaurar
    // só de um lado deixaria um membro órfão: exercício sem descanso para sempre.
    expect(out.exercises[0].biSetGroupId).toBeNull();
    expect(out.exercises[1].biSetGroupId).toBeNull();
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
