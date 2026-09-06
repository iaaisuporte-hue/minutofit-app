/**
 * Lock Screen do treino (P1D): a página precisa iniciar/atualizar/encerrar a
 * superfície de exibição ao vivo no momento certo — sem depender do dispositivo
 * nativo (impossível testar aqui), verificamos o CONTRATO: quando `iniciar()`,
 * `atualizar()` e `parar()` são chamados, e com que estado.
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

const iniciar = vi.fn();
const atualizar = vi.fn();
const parar = vi.fn();

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
vi.mock("./liveSurface/createWorkoutLiveSurface", () => ({
  createWorkoutLiveSurface: () => ({ iniciar, atualizar, parar }),
}));

import WorkoutSessionPage from "../WorkoutSessionPage";
import type { UserWorkoutPlan, UserWorkoutPlanItem } from "../../../services/userWorkoutPlansApi";

const PLAN_ID = 7;
const DAY_INDEX = 0;

const ITENS: UserWorkoutPlanItem[] = [
  { exerciseId: "ex-1", name: "Supino reto", sets: "1", reps: "10", rest: "60s" },
  { exerciseId: "ex-2", name: "Crucifixo", sets: "1", reps: "12", rest: "60s" },
];

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

function renderSessao() {
  return render(
    <MemoryRouter initialEntries={[`/app/user/treino/${PLAN_ID}/${DAY_INDEX}`]}>
      <Routes>
        <Route path="/app/user/treino/:planId/:dayIndex" element={<WorkoutSessionPage />} />
        <Route path="/app/user/outra" element={<div>Outra tela</div>} />
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

describe("WorkoutSessionPage × WorkoutLiveSurface (P1D)", () => {
  it("chama iniciar() ao entrar no treino, e atualizar() com o estado inicial", async () => {
    renderSessao();
    await screen.findByText("Supino reto");

    await waitFor(() => expect(iniciar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(atualizar).toHaveBeenCalled());

    const primeiro = atualizar.mock.calls[0][0];
    expect(primeiro).toMatchObject({
      status: "ativo",
      exercicioNome: "Supino reto",
      serieLabel: "Série 1 de 1",
    });
  });

  it("concluir a série empurra o estado ATUALIZADO (descanso ou próxima série)", async () => {
    const user = userEvent.setup();
    renderSessao();
    await screen.findByText("Supino reto");
    atualizar.mockClear();

    // Dois elementos carregam o mesmo aria-label ("Concluir série 1"): o
    // check pequeno por série na lista E o botão grande do rodapé
    // (`ws-ab-done`) — o real alvo do toque, replicando o gesto do usuário.
    const botaoRodape = (await screen.findAllByRole("button", { name: "Concluir série 1" })).find((el) =>
      el.className.includes("ws-ab-done"),
    );
    if (!botaoRodape) throw new Error("botão 'Concluir série' do rodapé não encontrado");
    await user.click(botaoRodape);

    await waitFor(() => expect(atualizar).toHaveBeenCalled());
    const depois = atualizar.mock.calls[atualizar.mock.calls.length - 1][0];
    // 60s de descanso planejado nesta ficha — deve entrar em "descansando".
    expect(["descansando", "ativo"]).toContain(depois.status);
  });

  it("desmontar a página (sair da tela, por QUALQUER motivo) encerra a superfície", async () => {
    const view = renderSessao();
    await screen.findByText("Supino reto");
    await waitFor(() => expect(iniciar).toHaveBeenCalledTimes(1));
    expect(parar).not.toHaveBeenCalled();

    // `.unmount()` é o desmonte real do React — o mesmo que acontece ao
    // navegar para outra rota, finalizar ou descartar o treino. O cleanup do
    // efeito não distingue o motivo (mesma garantia da P1B/P1C).
    view.unmount();

    expect(parar).toHaveBeenCalledTimes(1);
  });
});
