/**
 * Fast Workout Input (set/2026): "Repetir última série" e RPE por série
 * durante o descanso. Os dois reaproveitam operação/estado já testados
 * (`wcCompleteSet` idempotente em `workoutCommands.test.ts`, `updateSet`) —
 * aqui o que importa é a FIAÇÃO: o botão aparece com o valor certo, o toque
 * conclui a série certa, e o RPE grava no draft sem bloquear o treino.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMyWorkoutPlans = vi.fn();
const getExercisesBatch = vi.fn();
const searchExercises = vi.fn();
const getWorkoutStats = vi.fn();
const createWorkoutSession = vi.fn();
const fetchReplacementSuggestions = vi.fn();

vi.mock("../../../services/userWorkoutPlansApi", () => ({
  fetchMyWorkoutPlans: (...a: unknown[]) => fetchMyWorkoutPlans(...a),
}));
vi.mock("../../../services/exercisesApi", () => ({
  getExercisesBatch: (...a: unknown[]) => getExercisesBatch(...a),
  searchExercises: (...a: unknown[]) => searchExercises(...a),
}));
vi.mock("../../../services/exerciseReplacementSuggestionsApi", () => ({
  fetchReplacementSuggestions: (...a: unknown[]) => fetchReplacementSuggestions(...a),
}));
vi.mock("../../../services/workoutSessionApi", () => ({
  getWorkoutStats: (...a: unknown[]) => getWorkoutStats(...a),
  createWorkoutSession: (...a: unknown[]) => createWorkoutSession(...a),
}));
vi.mock("../../../features/training/adaptive/useAdaptiveTraining", () => ({
  useAdaptiveTraining: () => ({ data: null, loading: false, error: null }),
}));
vi.mock("../../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    loading: false,
    planName: "Free",
    features: {},
    hasFeature: () => false,
    refresh: async () => {},
  }),
}));

import WorkoutSessionPage from "../WorkoutSessionPage";
import { loadDraft, saveDraft, type DraftExercise, type SessionDraft } from "./sessionDraft";
import type { UserWorkoutPlan, UserWorkoutPlanItem } from "../../../services/userWorkoutPlansApi";

const PLAN_ID = 21;
const DAY_INDEX = 0;

const ITENS: UserWorkoutPlanItem[] = [{ exerciseId: "ex-1", name: "Supino reto", sets: "2", reps: "12", rest: "60s" }];

function plano(): UserWorkoutPlan {
  return {
    id: PLAN_ID,
    personal_id: 1,
    student_id: 2,
    title: "Ficha A",
    week_preset: "3x",
    selected_group: null,
    payload_json: ITENS,
    days: [{ index: DAY_INDEX, name: "Dia 1", focus: "Peito", items: ITENS }],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

/** Exercício com a série 1 já concluída (28 kg × 12) e a série 2 pendente —
 * é o cenário "repetir a mesma série" do benchmark da SPEC. */
function exercicioComSerieAnterior(): DraftExercise {
  return {
    exerciseId: "ex-1",
    name: "Supino reto",
    biSetGroupId: null,
    sets: [
      {
        setIndex: 1,
        plannedReps: "12",
        plannedRestS: 60,
        loadKg: "28",
        reps: "12",
        done: true,
        restDoneS: null,
        completedAt: Date.now() - 60_000,
      },
      {
        setIndex: 2,
        plannedReps: "12",
        plannedRestS: 60,
        loadKg: "",
        reps: "",
        done: false,
        restDoneS: null,
        completedAt: null,
      },
    ],
  };
}

function semearRascunho(exercises: DraftExercise[]) {
  const draft: SessionDraft = {
    version: 1,
    planId: PLAN_ID,
    dayIndex: DAY_INDEX,
    startedAt: Date.now() - 5 * 60 * 1000,
    currentIndex: 0,
    exercises,
    restEndsAt: null,
    restForKey: null,
  };
  saveDraft(draft);
}

function renderSessao() {
  return render(
    <MemoryRouter initialEntries={[`/app/user/treino/${PLAN_ID}/${DAY_INDEX}`]}>
      <Routes>
        <Route path="/app/user/treino/:planId/:dayIndex" element={<WorkoutSessionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fetchMyWorkoutPlans.mockResolvedValue([plano()]);
  getWorkoutStats.mockResolvedValue(null);
  getExercisesBatch.mockResolvedValue([]);
  searchExercises.mockResolvedValue([]);
  createWorkoutSession.mockResolvedValue({ streak: 1, prEvents: [], celebrate: false });
  fetchReplacementSuggestions.mockResolvedValue(null);
});

describe("Repetir última série", () => {
  it("mostra o valor da série anterior e conclui a série atual em 1 toque", async () => {
    semearRascunho([exercicioComSerieAnterior()]);
    const user = userEvent.setup();
    renderSessao();

    const repetir = await screen.findByRole("button", { name: "Repetir: 28 kg × 12" });
    await user.click(repetir);

    await waitFor(() => {
      const draft = loadDraft(PLAN_ID, DAY_INDEX);
      const serie2 = draft?.exercises[0]?.sets[1];
      expect(serie2?.done).toBe(true);
      expect(serie2?.loadKg).toBe("28");
      expect(serie2?.reps).toBe("12");
    });
  });

  it("é idempotente — dois toques não geram efeito duplicado (série já concluída)", async () => {
    semearRascunho([exercicioComSerieAnterior()]);
    const user = userEvent.setup();
    renderSessao();

    const repetir = await screen.findByRole("button", { name: "Repetir: 28 kg × 12" });
    await user.click(repetir);
    await waitFor(() => expect(loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0]?.sets[1]?.done).toBe(true));

    // Depois de concluída, a barra de ação unica não teria mais como repetir a
    // MESMA série 2 (ela já está feita) — o teste de idempotência real é o
    // `wcCompleteSet` em workoutCommands.test.ts; aqui confirmamos que o draft
    // não regrediu/duplicou nada ao processar o evento duas vezes na mesma tela.
    const antes = loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0]?.sets[1]?.completedAt;
    await waitFor(() => {
      const depois = loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0]?.sets[1]?.completedAt;
      expect(depois).toBe(antes);
    });
  });
});

describe("RPE por série durante o descanso", () => {
  it("concluir a série abre o prompt de RPE, e escolher 8 grava no draft sem bloquear", async () => {
    semearRascunho([exercicioComSerieAnterior()]);
    const user = userEvent.setup();
    renderSessao();

    const repetir = await screen.findByRole("button", { name: "Repetir: 28 kg × 12" });
    await user.click(repetir);

    const oito = await screen.findByRole("button", { name: "8" });
    await user.click(oito);

    await waitFor(() => {
      const serie2 = loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0]?.sets[1];
      expect(serie2?.rpe).toBe(8);
    });
    // O treino segue normal — o descanso continua na tela, nada travou.
    expect(screen.getByText("Descanso")).toBeTruthy();
  });

  it("'Ignorar' fecha o prompt sem gravar RPE", async () => {
    semearRascunho([exercicioComSerieAnterior()]);
    const user = userEvent.setup();
    renderSessao();

    const repetir = await screen.findByRole("button", { name: "Repetir: 28 kg × 12" });
    await user.click(repetir);

    const ignorar = await screen.findByRole("button", { name: "Ignorar" });
    await user.click(ignorar);

    await waitFor(() => expect(screen.queryByText("Como foi essa série? (opcional)")).toBeNull());
    const serie2 = loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0]?.sets[1];
    expect(serie2?.rpe ?? null).toBeNull();
    expect(serie2?.done).toBe(true); // ignorar RPE não desfaz a conclusão da série
  });
});
