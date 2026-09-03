/**
 * Selos de origem no histórico do aluno (execução dinâmica).
 *
 * O aluno precisa reconhecer, semanas depois, o que ele trocou e o que ele
 * acrescentou — sem isso o histórico mostra um exercício que a ficha nunca
 * pediu e parece erro. Prescrito continua sem selo: é o caso normal.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WorkoutSessionDetail, WorkoutSetLogRow } from "../../../services/workoutSessionApi";

const session = {
  id: 1,
  source: "personal" as const,
  planId: 7,
  dayIndex: 0,
  readinessLevel: null,
  status: "completed" as const,
  sessionRpe: null,
  title: "Treino A",
  startedAt: "2026-09-01T10:00:00.000Z",
  endedAt: "2026-09-01T11:00:00.000Z",
  performedAt: "2026-09-01T10:00:00.000Z",
  isRetroactive: false,
  setsDone: 3,
};

const getWorkoutSessionDetail = vi.fn();
vi.mock("../../../services/workoutSessionApi", () => ({
  listWorkoutSessionsPage: () => Promise.resolve({ sessions: [session], nextCursor: null }),
  getWorkoutSessionDetail: (id: number) => getWorkoutSessionDetail(id),
}));
vi.mock("../../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ loading: false, planName: "Free", features: [], hasFeature: () => false, refresh: vi.fn() }),
}));

import { WorkoutHistorySection } from "./WorkoutHistorySection";

function set(over: Partial<WorkoutSetLogRow>): WorkoutSetLogRow {
  return {
    exerciseId: "11111111-1111-4111-8111-111111111111",
    exerciseName: "Supino inclinado",
    orderIndex: 0,
    setIndex: 1,
    plannedReps: "10",
    repsDone: 10,
    loadDoneKg: 40,
    rpe: null,
    discomfort: null,
    status: "done",
    ...over,
  };
}

function mockDetail(sets: WorkoutSetLogRow[]) {
  getWorkoutSessionDetail.mockResolvedValue({ ...session, notes: null, sets } as WorkoutSessionDetail);
}

/** Abre a sessão para renderizar o detalhe por série. */
async function abrirDetalhe() {
  render(
    <MemoryRouter>
      <WorkoutHistorySection />
    </MemoryRouter>,
  );
  const linha = await screen.findByRole("button", { expanded: false });
  await userEvent.click(linha);
  await waitFor(() => expect(getWorkoutSessionDetail).toHaveBeenCalled());
}

beforeEach(() => vi.clearAllMocks());

describe("WorkoutHistorySection — origem do exercício", () => {
  it("substituição mostra o nome do exercício original", async () => {
    mockDetail([set({ executionSource: "replacement", substitutedFromName: "Supino reto" })]);
    await abrirDetalhe();
    expect(await screen.findByText("Substituiu Supino reto")).toBeInTheDocument();
  });

  it("substituição sem nome original não inventa nome", async () => {
    mockDetail([set({ executionSource: "replacement", substitutedFromName: null })]);
    await abrirDetalhe();
    expect(await screen.findByText("Substituiu outro exercício")).toBeInTheDocument();
  });

  it("exercício acrescentado durante o treino ganha selo próprio", async () => {
    mockDetail([set({ exerciseName: "Rosca direta", executionSource: "user_added" })]);
    await abrirDetalhe();
    expect(await screen.findByText("Adicionado durante o treino")).toBeInTheDocument();
  });

  it("prescrito (ou backend antigo, sem o campo) não ganha selo algum", async () => {
    mockDetail([set({ executionSource: "prescribed" }), set({ setIndex: 2, exerciseName: "Remada baixa" })]);
    await abrirDetalhe();
    await screen.findByText("Supino inclinado");
    expect(screen.queryByText(/Substituiu/)).not.toBeInTheDocument();
    expect(screen.queryByText("Adicionado durante o treino")).not.toBeInTheDocument();
  });

  it("o selo aparece uma vez por exercício, não por série", async () => {
    mockDetail([
      set({ executionSource: "replacement", substitutedFromName: "Supino reto" }),
      set({ setIndex: 2, executionSource: "replacement", substitutedFromName: "Supino reto" }),
    ]);
    await abrirDetalhe();
    expect(await screen.findAllByText("Substituiu Supino reto")).toHaveLength(1);
  });
});
