import { describe, expect, it } from "vitest";
import type { DraftExercise } from "../sessionDraft";
import { buildWorkoutSnapshot } from "./WorkoutSnapshot";

function exercicio(overrides: Partial<DraftExercise> = {}): DraftExercise {
  return {
    exerciseId: "ex-1",
    name: "Supino inclinado",
    biSetGroupId: null,
    sets: [
      { setIndex: 1, plannedReps: "10-12", plannedRestS: 90, loadKg: "26", reps: "12", done: true, restDoneS: null, completedAt: 500 },
      { setIndex: 2, plannedReps: "10-12", plannedRestS: 90, loadKg: "", reps: "", done: false, restDoneS: null, completedAt: null },
    ],
    ...overrides,
  };
}

describe("buildWorkoutSnapshot", () => {
  it("expõe a série atual (primeira não concluída) e a anterior desta sessão", () => {
    const snapshot = buildWorkoutSnapshot({
      mode: "plan",
      exercises: [exercicio()],
      currentIndex: 0,
      startedAt: 0,
      now: 60_000,
      lastKnownLoadKg: 24,
      rest: { active: false, running: false, secondsLeft: 0 },
      restEndsAt: null,
    });

    expect(snapshot.exerciseName).toBe("Supino inclinado");
    expect(snapshot.currentSetIndex).toBe(2);
    expect(snapshot.previousSetLoadKg).toBe(26);
    expect(snapshot.lastKnownLoadKg).toBe(24);
    expect(snapshot.elapsedSeconds).toBe(60);
    expect(snapshot.totalExercises).toBe(1);
  });

  it("marca filledUnchecked quando há carga/reps digitadas sem marcar", () => {
    const exercises = [
      exercicio({
        sets: [
          { setIndex: 1, plannedReps: "10", plannedRestS: 60, loadKg: "20", reps: "", done: false, restDoneS: null, completedAt: null },
        ],
      }),
    ];
    const snapshot = buildWorkoutSnapshot({
      mode: "free",
      exercises,
      currentIndex: 0,
      startedAt: 0,
      now: 0,
      lastKnownLoadKg: null,
      rest: { active: false, running: false, secondsLeft: 0 },
      restEndsAt: null,
    });
    expect(snapshot.filledUnchecked).toBe(true);
    expect(snapshot.pendingExercises).toBe(1);
  });

  it("currentSetIndex é null quando o exercício está todo concluído", () => {
    const exercises = [
      exercicio({
        sets: [
          { setIndex: 1, plannedReps: "10", plannedRestS: 60, loadKg: "20", reps: "10", done: true, restDoneS: null, completedAt: 1 },
        ],
      }),
    ];
    const snapshot = buildWorkoutSnapshot({
      mode: "plan",
      exercises,
      currentIndex: 0,
      startedAt: 0,
      now: 0,
      lastKnownLoadKg: null,
      rest: { active: false, running: false, secondsLeft: 0 },
      restEndsAt: null,
    });
    expect(snapshot.currentSetIndex).toBeNull();
    expect(snapshot.pendingExercises).toBe(0);
  });
});
