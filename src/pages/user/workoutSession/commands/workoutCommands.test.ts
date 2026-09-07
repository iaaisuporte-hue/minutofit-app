import { describe, expect, it } from "vitest";
import type { DraftExercise } from "../sessionDraft";
import { applySetValues, attachSetObservation, completeSet, uncompleteSet } from "./workoutCommands";

function exercicio(overrides: Partial<DraftExercise> = {}): DraftExercise {
  return {
    exerciseId: "ex-1",
    name: "Supino inclinado",
    biSetGroupId: null,
    sets: [
      { setIndex: 1, plannedReps: "10-12", plannedRestS: 90, loadKg: "", reps: "", done: false, restDoneS: null, completedAt: null },
      { setIndex: 2, plannedReps: "10-12", plannedRestS: 90, loadKg: "", reps: "", done: false, restDoneS: null, completedAt: null },
    ],
    ...overrides,
  };
}

describe("completeSet", () => {
  it("conclui a série, grava reps/carga e sinaliza início de descanso", () => {
    const exercises = [exercicio()];
    const result = completeSet(exercises, 0, 1, { reps: "12", loadKg: "28" }, 1000);

    expect(result.changed).toBe(true);
    expect(result.exercises[0].sets[0]).toMatchObject({
      done: true,
      reps: "12",
      loadKg: "28",
      completedAt: 1000,
    });
    expect(result.restStart).toEqual({ plannedRestS: 90 });
  });

  it("é idempotente: chamar de novo na série já concluída não desmarca nada", () => {
    const first = completeSet([exercicio()], 0, 1, { reps: "12", loadKg: "28" }, 1000);
    const second = completeSet(first.exercises, 0, 1, { reps: "999", loadKg: "999" }, 2000);

    expect(second.changed).toBe(false);
    expect(second.reason).toBe("already_completed");
    // nada foi sobrescrito pela segunda chamada
    expect(second.exercises[0].sets[0]).toMatchObject({ reps: "12", loadKg: "28", completedAt: 1000 });
  });

  it("não inicia descanso em bi-set mesmo com plannedRestS", () => {
    const exercises = [exercicio({ biSetGroupId: "grp-1" })];
    const result = completeSet(exercises, 0, 1, {}, 1000);
    expect(result.changed).toBe(true);
    expect(result.restStart).toBeNull();
  });

  it("devolve no_exercise/no_set sem tocar a lista quando o alvo não existe", () => {
    const exercises = [exercicio()];
    const semExercicio = completeSet(exercises, 5, 1, {}, 1000);
    expect(semExercicio.changed).toBe(false);
    expect(semExercicio.reason).toBe("no_exercise");

    const semSerie = completeSet(exercises, 0, 99, {}, 1000);
    expect(semSerie.changed).toBe(false);
    expect(semSerie.reason).toBe("no_set");
  });
});

describe("uncompleteSet", () => {
  it("reverte uma série concluída", () => {
    const done = completeSet([exercicio()], 0, 1, { reps: "12", loadKg: "28" }, 1000);
    const reverted = uncompleteSet(done.exercises, 0, 1);
    expect(reverted.changed).toBe(true);
    expect(reverted.exercises[0].sets[0]).toMatchObject({ done: false, completedAt: null });
  });

  it("é no-op numa série que não estava concluída", () => {
    const result = uncompleteSet([exercicio()], 0, 1);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("not_completed");
  });
});

describe("applySetValues", () => {
  it("grava carga sem concluir a série", () => {
    const result = applySetValues([exercicio()], 0, 1, { loadKg: "30" });
    expect(result.changed).toBe(true);
    expect(result.exercises[0].sets[0]).toMatchObject({ loadKg: "30", done: false });
  });

  it("recusa patch vazio", () => {
    const result = applySetValues([exercicio()], 0, 1, {});
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("invalid_value");
  });
});

describe("attachSetObservation", () => {
  it("grava o relato original, truncado em 280 caracteres", () => {
    const longa = "a".repeat(300);
    const result = attachSetObservation([exercicio()], 0, 1, longa);
    expect(result.changed).toBe(true);
    expect(result.exercises[0].sets[0].observation).toHaveLength(280);
  });

  it("string vazia ou null remove a observação", () => {
    const withObs = attachSetObservation([exercicio()], 0, 1, "senti uma fisgada");
    const cleared = attachSetObservation(withObs.exercises, 0, 1, "");
    expect(cleared.exercises[0].sets[0].observation).toBeNull();
  });
});
