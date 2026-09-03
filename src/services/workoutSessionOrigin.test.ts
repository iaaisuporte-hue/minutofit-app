/**
 * Origem da execução no detalhe da sessão (execução dinâmica).
 *
 * O servidor devolve snake_case; o histórico do aluno só sabe desenhar o selo
 * de "substituiu"/"adicionado" se o mapper carregar esses campos — e precisa
 * tolerar um backend uma versão atrás, que não os manda.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const authFetch = vi.fn();
vi.mock("./apiClient", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));
vi.mock("./authTokens", () => ({ getAccessToken: () => "token-de-teste" }));

import { getWorkoutSessionDetail } from "./workoutSessionApi";

function respondWith(sets: Record<string, unknown>[]) {
  authFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        id: 1,
        source: "personal",
        plan_id: 7,
        day_index: 0,
        readiness_level: null,
        status: "completed",
        session_rpe: null,
        title: "Treino A",
        started_at: "2026-09-01T10:00:00.000Z",
        ended_at: "2026-09-01T11:00:00.000Z",
        performed_at: "2026-09-01T10:00:00.000Z",
        is_retroactive: false,
        sets_done: sets.length,
        notes: null,
        sets,
      },
    }),
  });
}

const baseSet = {
  exercise_id: "11111111-1111-4111-8111-111111111111",
  exercise_name: "Supino inclinado",
  order_index: 0,
  set_index: 1,
  planned_reps: "10",
  reps_done: 10,
  load_done_kg: 40,
  rpe: 7,
  discomfort: null,
  status: "done",
};

beforeEach(() => vi.clearAllMocks());

describe("getWorkoutSessionDetail — origem da execução", () => {
  it("mapeia os campos snake_case da substituição para camelCase", async () => {
    respondWith([
      {
        ...baseSet,
        execution_source: "replacement",
        substituted_from_exercise_id: "22222222-2222-4222-8222-222222222222",
        substituted_from_name: "Supino reto",
        substitution_reason: "aparelho ocupado",
      },
    ]);

    const detail = await getWorkoutSessionDetail(1);

    expect(detail?.sets[0]).toMatchObject({
      exerciseName: "Supino inclinado",
      repsDone: 10,
      loadDoneKg: 40,
      executionSource: "replacement",
      substitutedFromExerciseId: "22222222-2222-4222-8222-222222222222",
      substitutedFromName: "Supino reto",
      substitutionReason: "aparelho ocupado",
    });
  });

  it("mantém `null` quando o exercício original saiu do catálogo", async () => {
    respondWith([
      {
        ...baseSet,
        execution_source: "replacement",
        substituted_from_exercise_id: null,
        substituted_from_name: null,
        substitution_reason: null,
      },
    ]);

    const detail = await getWorkoutSessionDetail(1);

    expect(detail?.sets[0].executionSource).toBe("replacement");
    expect(detail?.sets[0].substitutedFromName).toBeNull();
  });

  it("mapeia exercício acrescentado pelo aluno", async () => {
    respondWith([{ ...baseSet, execution_source: "user_added" }]);

    const detail = await getWorkoutSessionDetail(1);

    expect(detail?.sets[0].executionSource).toBe("user_added");
  });

  it("backend sem os campos novos não vira selo — origem fica indefinida", async () => {
    respondWith([baseSet]);

    const detail = await getWorkoutSessionDetail(1);

    expect(detail?.sets[0].executionSource).toBeUndefined();
    expect(detail?.sets[0].substitutedFromName).toBeNull();
  });

  it("origem desconhecida é descartada em vez de virar selo errado", async () => {
    respondWith([{ ...baseSet, execution_source: "origem_do_futuro" }]);

    const detail = await getWorkoutSessionDetail(1);

    expect(detail?.sets[0].executionSource).toBeUndefined();
  });
});
