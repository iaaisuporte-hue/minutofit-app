/**
 * Operações de lista do treino livre.
 *
 * As bordas aqui são as que o aluno encontra primeiro: tocar em "subir" no
 * primeiro exercício, tocar duas vezes no mesmo item da folha, segurar o "+"
 * das séries. Nenhuma delas pode perder um exercício ou estourar os limites que
 * o servidor aplica no POST.
 */
import { describe, expect, it } from "vitest";
import {
  addExercise,
  buildFreeDraftExercises,
  DEFAULT_REPS,
  DEFAULT_REST_S,
  DEFAULT_SETS,
  isFull,
  MAX_EXERCISES,
  MAX_REPS,
  MAX_REST_S,
  MAX_SETS,
  MIN_REPS,
  MIN_REST_S,
  MIN_SETS,
  moveExercise,
  removeAt,
  setRest,
  setSets,
  stepReps,
  stepRest,
  stepSets,
  totalSets,
  type FreeWorkoutItem,
} from "./freeSessionOps";

const ex = (id: string, name = `Exercício ${id}`, bodyPart: string | null = "peito") => ({
  id,
  name,
  bodyPart,
});

function listaCom(ids: string[]): FreeWorkoutItem[] {
  return ids.reduce<FreeWorkoutItem[]>((acc, id) => addExercise(acc, ex(id)), []);
}

describe("addExercise", () => {
  it("adiciona ao fim com os padrões da tela", () => {
    const [item] = addExercise([], ex("a", "Supino reto", "peito"));
    expect(item).toEqual({
      exerciseId: "a",
      name: "Supino reto",
      bodyPart: "peito",
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
      restS: DEFAULT_REST_S,
    });
  });

  it("preserva a ordem de escolha", () => {
    expect(listaCom(["a", "b", "c"]).map((i) => i.exerciseId)).toEqual(["a", "b", "c"]);
  });

  it("toque repetido na folha não duplica o exercício", () => {
    const lista = listaCom(["a"]);
    const depois = addExercise(lista, ex("a"));
    expect(depois).toHaveLength(1);
    expect(depois).toBe(lista); // mesma referência: nada mudou
  });

  it("no teto de exercícios devolve a lista intacta", () => {
    const cheia = listaCom(Array.from({ length: MAX_EXERCISES }, (_, i) => `e${i}`));
    expect(isFull(cheia)).toBe(true);
    const depois = addExercise(cheia, ex("extra"));
    expect(depois).toHaveLength(MAX_EXERCISES);
    expect(depois.some((i) => i.exerciseId === "extra")).toBe(false);
  });

  it("não muta a lista de entrada", () => {
    const lista = listaCom(["a"]);
    const copia = JSON.parse(JSON.stringify(lista));
    addExercise(lista, ex("b"));
    expect(lista).toEqual(copia);
  });
});

describe("removeAt", () => {
  it("tira o item e mantém os vizinhos na ordem", () => {
    const depois = removeAt(listaCom(["a", "b", "c"]), 1);
    expect(depois.map((i) => i.exerciseId)).toEqual(["a", "c"]);
  });

  it("índice fora da lista não apaga nada", () => {
    const lista = listaCom(["a", "b"]);
    expect(removeAt(lista, 5)).toBe(lista);
    expect(removeAt(lista, -1)).toBe(lista);
  });
});

describe("moveExercise", () => {
  it("sobe uma posição", () => {
    const depois = moveExercise(listaCom(["a", "b", "c"]), 2, -1);
    expect(depois.map((i) => i.exerciseId)).toEqual(["a", "c", "b"]);
  });

  it("desce uma posição", () => {
    const depois = moveExercise(listaCom(["a", "b", "c"]), 0, 1);
    expect(depois.map((i) => i.exerciseId)).toEqual(["b", "a", "c"]);
  });

  it("subir o primeiro não perde o exercício", () => {
    const lista = listaCom(["a", "b"]);
    expect(moveExercise(lista, 0, -1)).toBe(lista);
  });

  it("descer o último não perde o exercício", () => {
    const lista = listaCom(["a", "b"]);
    expect(moveExercise(lista, 1, 1)).toBe(lista);
  });

  it("mover preserva séries, reps e descanso de cada item", () => {
    const lista = stepSets(listaCom(["a", "b"]), 0, 2);
    const depois = moveExercise(lista, 0, 1);
    expect(depois[1].exerciseId).toBe("a");
    expect(depois[1].sets).toBe(DEFAULT_SETS + 2);
    expect(depois[0].sets).toBe(DEFAULT_SETS);
  });

  it("índice inválido não reordena", () => {
    const lista = listaCom(["a", "b"]);
    expect(moveExercise(lista, 9, -1)).toBe(lista);
  });
});

describe("séries, repetições e descanso", () => {
  it("séries respeitam o mínimo e o máximo", () => {
    let lista = listaCom(["a"]);
    for (let i = 0; i < 20; i++) lista = stepSets(lista, 0, 1);
    expect(lista[0].sets).toBe(MAX_SETS);
    for (let i = 0; i < 20; i++) lista = stepSets(lista, 0, -1);
    expect(lista[0].sets).toBe(MIN_SETS);
  });

  it("valor absurdo de séries é fixado no intervalo", () => {
    expect(setSets(listaCom(["a"]), 0, 999)[0].sets).toBe(MAX_SETS);
    expect(setSets(listaCom(["a"]), 0, -5)[0].sets).toBe(MIN_SETS);
    expect(setSets(listaCom(["a"]), 0, Number.NaN)[0].sets).toBe(DEFAULT_SETS);
  });

  it("repetições ficam como texto e respeitam o intervalo", () => {
    let lista = stepReps(listaCom(["a"]), 0, 2);
    expect(lista[0].reps).toBe("12");
    for (let i = 0; i < 100; i++) lista = stepReps(lista, 0, 1);
    expect(lista[0].reps).toBe(String(MAX_REPS));
    for (let i = 0; i < 100; i++) lista = stepReps(lista, 0, -1);
    expect(lista[0].reps).toBe(String(MIN_REPS));
  });

  it("descanso anda de 15 em 15 e não passa dos limites", () => {
    let lista = stepRest(listaCom(["a"]), 0, 15);
    expect(lista[0].restS).toBe(DEFAULT_REST_S + 15);
    for (let i = 0; i < 40; i++) lista = stepRest(lista, 0, 15);
    expect(lista[0].restS).toBe(MAX_REST_S);
    for (let i = 0; i < 40; i++) lista = stepRest(lista, 0, -15);
    expect(lista[0].restS).toBe(MIN_REST_S);
  });

  it("descanso zero é válido — circuito sem pausa", () => {
    expect(setRest(listaCom(["a"]), 0, 0)[0].restS).toBe(0);
  });

  it("índice inválido não altera nada", () => {
    const lista = listaCom(["a"]);
    expect(stepSets(lista, 4, 1)).toBe(lista);
    expect(stepReps(lista, 4, 1)).toBe(lista);
    expect(stepRest(lista, 4, 15)).toBe(lista);
  });

  it("ajuste em um exercício não vaza para os outros", () => {
    const lista = stepSets(listaCom(["a", "b"]), 1, 1);
    expect(lista[0].sets).toBe(DEFAULT_SETS);
    expect(lista[1].sets).toBe(DEFAULT_SETS + 1);
  });
});

describe("tetos combinados com o servidor", () => {
  it("o máximo aceito pela tela é exatamente o máximo aceito pelo POST", () => {
    // 20 exercícios × 10 séries = 200 séries, o teto do servidor.
    let lista = listaCom(Array.from({ length: MAX_EXERCISES }, (_, i) => `e${i}`));
    for (let index = 0; index < lista.length; index++) lista = setSets(lista, index, MAX_SETS);
    expect(totalSets(lista)).toBe(200);
  });
});

describe("buildFreeDraftExercises", () => {
  it("expande cada exercício no número de séries escolhido", () => {
    const lista = stepSets(listaCom(["a"]), 0, 1); // 4 séries
    const [draft] = buildFreeDraftExercises(lista);
    expect(draft.sets).toHaveLength(4);
    expect(draft.sets.map((s) => s.setIndex)).toEqual([1, 2, 3, 4]);
  });

  it("séries nascem vazias e não feitas — carga é digitada durante o treino", () => {
    const [draft] = buildFreeDraftExercises(listaCom(["a"]));
    expect(draft.sets.every((s) => s.done === false && s.loadKg === "" && s.reps === "")).toBe(true);
  });

  it("leva planejado e body_part para a sessão", () => {
    const lista = addExercise([], ex("a", "Remada curvada", "costas"));
    const [draft] = buildFreeDraftExercises(lista);
    expect(draft.exerciseId).toBe("a");
    expect(draft.name).toBe("Remada curvada");
    expect(draft.bodyPart).toBe("costas");
    expect(draft.sets[0].plannedReps).toBe(DEFAULT_REPS);
    expect(draft.sets[0].plannedRestS).toBe(DEFAULT_REST_S);
  });

  it("treino livre não tem bi-set", () => {
    const [draft] = buildFreeDraftExercises(listaCom(["a"]));
    expect(draft.biSetGroupId).toBeNull();
  });

  it("lista vazia gera sessão vazia, sem lançar", () => {
    expect(buildFreeDraftExercises([])).toEqual([]);
  });
});
