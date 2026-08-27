/**
 * Rascunho da montagem do treino livre.
 *
 * O que se testa aqui é o par escrever/ler: a seleção volta inteira depois de um
 * F5, e nada do que estiver gravado no aparelho consegue montar uma lista que o
 * POST recusaria — ou pior, quebrar a tela de montagem no boot.
 */
import { describe, expect, it } from "vitest";
import {
  clearFreeSetupDraft,
  loadFreeSetupDraft,
  parseFreeSetupDraft,
  saveFreeSetupDraft,
  serializeFreeSetupDraft,
  FREE_SETUP_DRAFT_KEY,
} from "./freeSetupDraft";
import {
  addExercise,
  DEFAULT_REPS,
  DEFAULT_REST_S,
  DEFAULT_SETS,
  MAX_EXERCISES,
  MAX_REPS,
  MAX_REST_S,
  MAX_SETS,
  MIN_REST_S,
  MIN_SETS,
  stepSets,
  type FreeWorkoutItem,
} from "./freeSessionOps";

function lista(ids: string[]): FreeWorkoutItem[] {
  return ids.reduce<FreeWorkoutItem[]>(
    (acc, id) => addExercise(acc, { id, name: `Exercício ${id}`, bodyPart: "peito" }),
    [],
  );
}

describe("serializeFreeSetupDraft / parseFreeSetupDraft", () => {
  it("devolve a seleção inteira, na ordem, com séries e descanso ajustados", () => {
    const montagem = stepSets(lista(["a", "b", "c"]), 1, 2);
    const restaurada = parseFreeSetupDraft(serializeFreeSetupDraft(montagem));
    expect(restaurada).toEqual(montagem);
  });

  it("chave ausente ou lixo no lugar do JSON não quebra a tela", () => {
    expect(parseFreeSetupDraft(null)).toEqual([]);
    expect(parseFreeSetupDraft("")).toEqual([]);
    expect(parseFreeSetupDraft("{quebrado")).toEqual([]);
    expect(parseFreeSetupDraft("[]")).toEqual([]);
    expect(parseFreeSetupDraft('"texto"')).toEqual([]);
  });

  it("versão ou modo diferentes são descartados — inclusive o rascunho de SESSÃO", () => {
    // A chave é outra, mas ler o draft da sessão por engano montaria uma lista
    // "em execução" na tela de montagem. O `mode` é a guarda.
    const sessao = JSON.stringify({ version: 1, mode: "free", exercises: [], startedAt: 1 });
    expect(parseFreeSetupDraft(sessao)).toEqual([]);
    expect(parseFreeSetupDraft(JSON.stringify({ version: 2, mode: "free-setup", items: [] }))).toEqual(
      [],
    );
  });

  it("item sem id ou sem nome é descartado, o resto da lista sobrevive", () => {
    const raw = JSON.stringify({
      version: 1,
      mode: "free-setup",
      updatedAt: Date.now(),
      items: [
        { exerciseId: "a", name: "Supino reto", bodyPart: "peito", sets: 3, reps: "10", restS: 60 },
        { exerciseId: "", name: "Sem id", bodyPart: null, sets: 3, reps: "10", restS: 60 },
        { exerciseId: "c", name: "   ", bodyPart: null, sets: 3, reps: "10", restS: 60 },
        null,
        "não é objeto",
      ],
    });
    expect(parseFreeSetupDraft(raw).map((i) => i.exerciseId)).toEqual(["a"]);
  });

  it("números adulterados voltam dentro dos limites que o POST aceita", () => {
    const raw = JSON.stringify({
      version: 1,
      mode: "free-setup",
      updatedAt: Date.now(),
      items: [
        { exerciseId: "a", name: "A", sets: 999, reps: "999", restS: 99999 },
        { exerciseId: "b", name: "B", sets: -3, reps: "0", restS: -10 },
        { exerciseId: "c", name: "C", sets: "não é número", reps: null, restS: undefined },
      ],
    });
    const itens = parseFreeSetupDraft(raw);
    expect(itens[0].sets).toBe(MAX_SETS);
    expect(itens[0].reps).toBe(String(MAX_REPS));
    expect(itens[0].restS).toBe(MAX_REST_S);
    expect(itens[1].sets).toBe(MIN_SETS);
    expect(itens[1].restS).toBe(MIN_REST_S);
    expect(itens[2].sets).toBe(DEFAULT_SETS);
    expect(itens[2].reps).toBe(DEFAULT_REPS);
    expect(itens[2].restS).toBe(DEFAULT_REST_S);
  });

  it("id repetido entra uma vez só — a tela nunca aceitou duplicata", () => {
    const raw = JSON.stringify({
      version: 1,
      mode: "free-setup",
      updatedAt: Date.now(),
      items: [
        { exerciseId: "a", name: "A", sets: 3, reps: "10", restS: 60 },
        { exerciseId: "a", name: "A de novo", sets: 3, reps: "10", restS: 60 },
      ],
    });
    expect(parseFreeSetupDraft(raw)).toHaveLength(1);
  });

  it("não restaura mais exercícios do que a tela deixa montar", () => {
    const excedente = lista(Array.from({ length: MAX_EXERCISES + 5 }, (_, i) => `e${i}`));
    const raw = JSON.stringify({
      version: 1,
      mode: "free-setup",
      updatedAt: Date.now(),
      // Escreve à força uma lista maior que o teto, como faria um JSON editado.
      items: excedente.concat(lista(["extra1", "extra2"])),
    });
    expect(parseFreeSetupDraft(raw)).toHaveLength(MAX_EXERCISES);
  });
});

describe("loadFreeSetupDraft / saveFreeSetupDraft", () => {
  it("grava e lê pela chave própria, separada da sessão", () => {
    clearFreeSetupDraft();
    const montagem = lista(["a", "b"]);
    saveFreeSetupDraft(montagem);
    expect(localStorage.getItem(FREE_SETUP_DRAFT_KEY)).toBeTruthy();
    expect(localStorage.getItem("s2core:workout:draft:free")).toBeNull();
    expect(loadFreeSetupDraft()).toEqual(montagem);
  });

  it("montagem esvaziada apaga a chave — não é rascunho de nada", () => {
    saveFreeSetupDraft(lista(["a"]));
    saveFreeSetupDraft([]);
    expect(localStorage.getItem(FREE_SETUP_DRAFT_KEY)).toBeNull();
    expect(loadFreeSetupDraft()).toEqual([]);
  });

  it("começar o treino limpa a montagem", () => {
    saveFreeSetupDraft(lista(["a"]));
    clearFreeSetupDraft();
    expect(loadFreeSetupDraft()).toEqual([]);
  });
});
