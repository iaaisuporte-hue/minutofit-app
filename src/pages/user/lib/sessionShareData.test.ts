import { describe, expect, it } from "vitest";
import { buildShareFromSession } from "./sessionShareData";
import type { WorkoutSessionDetail, WorkoutSetLogRow } from "../../../services/workoutSessionApi";

// Compartilhar uma sessão JÁ gravada (aberta pelo marcador de hoje no gráfico).
// É esta conversão que decide o que a arte afirma sobre o treino.

function set(p: Partial<WorkoutSetLogRow> & { exerciseName: string; orderIndex: number }): WorkoutSetLogRow {
  return {
    setIndex: 1,
    plannedReps: null,
    repsDone: null,
    loadDoneKg: null,
    rpe: null,
    discomfort: null,
    status: "done",
    ...p,
  };
}

function session(p: Partial<WorkoutSessionDetail> & { sets: WorkoutSetLogRow[] }): WorkoutSessionDetail {
  return {
    id: 1,
    source: "personal",
    planId: 3,
    dayIndex: 1,
    readinessLevel: null,
    status: "completed",
    sessionRpe: null,
    title: "Plano Base · Treino B",
    startedAt: "2026-08-27T10:00:00.000Z",
    endedAt: "2026-08-27T10:52:00.000Z",
    performedAt: "2026-08-27T10:00:00.000Z",
    isRetroactive: false,
    setsDone: p.sets.filter((s) => s.status === "done").length,
    notes: null,
    ...p,
  };
}

describe("buildShareFromSession", () => {
  it("agrupa séries por exercício na ordem da execução, com a faixa de reps feita", () => {
    const out = buildShareFromSession(
      session({
        sets: [
          set({ exerciseName: "Puxada frente", orderIndex: 1, setIndex: 1, repsDone: 12 }),
          set({ exerciseName: "Puxada frente", orderIndex: 1, setIndex: 2, repsDone: 10 }),
          set({ exerciseName: "Remada baixa", orderIndex: 2, setIndex: 1, repsDone: 12 }),
          set({ exerciseName: "Remada baixa", orderIndex: 2, setIndex: 2, repsDone: 12 }),
        ],
      }),
    );
    expect(out.exercises).toEqual([
      { name: "Puxada frente", sets: 2, reps: "10-12" },
      { name: "Remada baixa", sets: 2, reps: "12" },
    ]);
  });

  it("mostra o EXECUTADO: exercício inteiramente pulado não entra na arte", () => {
    const out = buildShareFromSession(
      session({
        sets: [
          set({ exerciseName: "Agachamento", orderIndex: 1, repsDone: 10 }),
          set({ exerciseName: "Leg press", orderIndex: 2, status: "skipped" }),
          set({ exerciseName: "Leg press", orderIndex: 2, setIndex: 2, status: "skipped" }),
        ],
      }),
    );
    expect(out.exercises.map((e) => e.name)).toEqual(["Agachamento"]);
    expect(out.stats.doneSets).toBe(1);
    expect(out.stats.totalSets).toBe(3);
    expect(out.stats.completionPct).toBe(33);
  });

  it("cai no previsto quando a pessoa marcou o ✓ sem digitar reps", () => {
    const out = buildShareFromSession(
      session({ sets: [set({ exerciseName: "Prancha", orderIndex: 1, plannedReps: "8-12" })] }),
    );
    expect(out.exercises[0]).toEqual({ name: "Prancha", sets: 1, reps: "8-12" });
  });

  it("soma volume só das séries feitas e separa título em foco + contexto", () => {
    const out = buildShareFromSession(
      session({
        title: "Treino livre · Costas e Ombros",
        sets: [
          set({ exerciseName: "Remada", orderIndex: 1, repsDone: 10, loadDoneKg: 40 }),
          set({ exerciseName: "Remada", orderIndex: 1, setIndex: 2, repsDone: 10, loadDoneKg: 40, status: "skipped" }),
        ],
      }),
    );
    expect(out.focus).toBe("Costas e Ombros");
    expect(out.dayName).toBe("Treino livre");
    expect(out.stats.volumeKg).toBe(400);
    expect(out.stats.durationMin).toBe(52);
  });

  it("sessão retroativa não inventa duração (ended_at empata com o início)", () => {
    const out = buildShareFromSession(
      session({
        startedAt: "2026-08-27T12:00:00.000Z",
        endedAt: "2026-08-27T12:00:00.000Z",
        sets: [set({ exerciseName: "Corrida", orderIndex: 1, repsDone: 1 })],
      }),
    );
    expect(out.stats.durationMin).toBeNull();
  });

  it("sobrevive a título ausente e a sessão sem série alguma", () => {
    const out = buildShareFromSession(session({ title: null, sets: [] }));
    expect(out.focus).toBe("Treino");
    expect(out.dayName).toBeUndefined();
    expect(out.exercises).toEqual([]);
    expect(out.stats.volumeKg).toBeNull();
    expect(out.stats.completionPct).toBeNull();
  });
});
