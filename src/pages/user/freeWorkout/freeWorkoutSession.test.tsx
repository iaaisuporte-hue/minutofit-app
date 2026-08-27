/**
 * Modo livre da engine de treino.
 *
 * O risco desta feature não está em montar a lista — está em executar sem ficha:
 * a mesma tela roda os dois modos, e o rascunho é a ÚNICA cópia do treino livre.
 * Por isso os três alvos aqui: o livre não vai buscar ficha nenhuma, editar a
 * lista no meio da sessão grava o rascunho, e uma falha ao salvar não apaga o
 * treino — ela oferece nova tentativa com a mesma chave de idempotência.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMyWorkoutPlans = vi.fn();
const getExercisesBatch = vi.fn();
const searchExercises = vi.fn();
const getWorkoutStats = vi.fn();
const registerFreeWorkoutSession = vi.fn();
const registerWorkoutSession = vi.fn();

vi.mock("../../../services/userWorkoutPlansApi", () => ({
  fetchMyWorkoutPlans: (...a: unknown[]) => fetchMyWorkoutPlans(...a),
}));
vi.mock("../../../services/exercisesApi", () => ({
  getExercisesBatch: (...a: unknown[]) => getExercisesBatch(...a),
  searchExercises: (...a: unknown[]) => searchExercises(...a),
}));
vi.mock("../../../services/workoutSessionApi", () => ({
  getWorkoutStats: (...a: unknown[]) => getWorkoutStats(...a),
}));
vi.mock("../workoutSession/registerWorkoutSession", () => ({
  registerFreeWorkoutSession: (...a: unknown[]) => registerFreeWorkoutSession(...a),
  registerWorkoutSession: (...a: unknown[]) => registerWorkoutSession(...a),
}));
vi.mock("../../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    loading: false,
    planName: "Free",
    features: { free_workout: true },
    hasFeature: (key: string) => key === "free_workout",
    refresh: async () => {},
  }),
}));

import WorkoutSessionPage from "../WorkoutSessionPage";
import { buildFreeDraftExercises } from "./freeSessionOps";
import { loadFreeDraft, saveFreeDraft } from "../workoutSession/sessionDraft";

const CLIENT_KEY = "11111111-2222-4333-8444-555555555555";

function semearRascunho() {
  saveFreeDraft({
    version: 1,
    mode: "free",
    startedAt: Date.now() - 10 * 60 * 1000,
    currentIndex: 0,
    exercises: buildFreeDraftExercises([
      { exerciseId: "ex-1", name: "Supino reto", bodyPart: "peito", sets: 3, reps: "10", restS: 60 },
      { exerciseId: "ex-2", name: "Remada curvada", bodyPart: "costas", sets: 3, reps: "10", restS: 60 },
    ]),
    restEndsAt: null,
    restForKey: null,
    clientKey: CLIENT_KEY,
  });
}

function renderSessao() {
  return render(
    <MemoryRouter initialEntries={["/app/user/treino-livre/sessao"]}>
      <Routes>
        <Route path="/app/user/treino-livre" element={<div>Montagem do treino livre</div>} />
        <Route path="/app/user/treino-livre/sessao" element={<WorkoutSessionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  getWorkoutStats.mockResolvedValue(null);
  getExercisesBatch.mockResolvedValue([]);
  searchExercises.mockResolvedValue([]);
});

describe("treino livre · execução", () => {
  it("executa a partir do rascunho, sem buscar ficha alguma", async () => {
    semearRascunho();
    renderSessao();

    expect(await screen.findByText("Treino livre · Peito e Costas")).toBeTruthy();
    expect(screen.getByText("Supino reto")).toBeTruthy();
    expect(fetchMyWorkoutPlans).not.toHaveBeenCalled();
  });

  it("manda montar quando não há treino aberto", async () => {
    renderSessao();
    expect(await screen.findByText("Montagem do treino livre")).toBeTruthy();
  });

  it("reordenar no meio da sessão grava a nova ordem no rascunho", async () => {
    semearRascunho();
    renderSessao();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Exercícios" }));
    await user.click(await screen.findByLabelText("Mover Supino reto para baixo"));

    await waitFor(() => {
      expect(loadFreeDraft()?.exercises.map((e) => e.name)).toEqual([
        "Remada curvada",
        "Supino reto",
      ]);
    });
    // A chave de idempotência sobrevive à edição — senão o retry duplicaria.
    expect(loadFreeDraft()?.clientKey).toBe(CLIENT_KEY);
  });

  it("falha ao salvar preserva o rascunho e oferece nova tentativa", async () => {
    semearRascunho();
    renderSessao();
    const user = userEvent.setup();

    registerFreeWorkoutSession.mockRejectedValueOnce(new Error("rede"));
    await user.click(await screen.findByRole("button", { name: "Finalizar treino" }));
    await user.click(await screen.findByRole("button", { name: "Concluir e salvar" }));

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(loadFreeDraft()).not.toBeNull();

    registerFreeWorkoutSession.mockResolvedValueOnce({
      streak: 3,
      title: "Treino livre",
      prEvents: [],
      celebrate: false,
    });
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(loadFreeDraft()).toBeNull());
    // Mesma chave nas duas tentativas: é o que impede o reenvio de virar duas sessões.
    expect(registerFreeWorkoutSession.mock.calls.every(([p]) => p.clientKey === CLIENT_KEY)).toBe(true);
    expect(registerFreeWorkoutSession.mock.calls[0][0].exercises).toHaveLength(2);
  });
});
