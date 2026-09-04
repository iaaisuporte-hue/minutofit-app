/**
 * Fiação do lembrete de treino não finalizado NA TELA de sessão.
 *
 * A regra de tempo já é coberta por `pendingWorkoutReminder.test.ts`. O que
 * este arquivo protege é outra coisa, e é o que quebra em silêncio: se um dos
 * pontos de atividade deixar de chamar o reagendamento, o lembrete toca no meio
 * do treino; se a finalização deixar de cancelar, um treino já salvo cobra que
 * seja finalizado. Nenhum dos dois aparece em revisão de código nem em teste
 * unitário do módulo — depende de a tela chamar o módulo nos lugares certos.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { agendarLembretesTreino, cancelarLembretesTreino } = vi.hoisted(() => ({
  agendarLembretesTreino: vi.fn(),
  cancelarLembretesTreino: vi.fn(),
}));

const fetchMyWorkoutPlans = vi.fn();
const getExercisesBatch = vi.fn();
const searchExercises = vi.fn();
const getWorkoutStats = vi.fn();
const createWorkoutSession = vi.fn();
const fetchReplacementSuggestions = vi.fn();

vi.mock("./pendingWorkoutReminder", async (original) => ({
  // Só o agendamento e o cancelamento são dublês: chave, ids e link continuam
  // sendo os de verdade.
  ...(await original<Record<string, unknown>>()),
  agendarLembretesTreino: (...a: unknown[]) => {
    agendarLembretesTreino(...a);
    return Promise.resolve(2);
  },
  cancelarLembretesTreino: (...a: unknown[]) => {
    cancelarLembretesTreino(...a);
    return Promise.resolve();
  },
}));
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
    loading: false, planName: "Free", features: {},
    hasFeature: () => false, refresh: async () => {},
  }),
}));

import WorkoutSessionPage from "../WorkoutSessionPage";
import { saveDraft, type DraftExercise, type SessionDraft } from "./sessionDraft";
import { chaveSessao } from "./pendingWorkoutReminder";
import type { UserWorkoutPlan, UserWorkoutPlanItem } from "../../../services/userWorkoutPlansApi";

const PLAN_ID = 7;
const DAY_INDEX = 0;
const ITENS: UserWorkoutPlanItem[] = [
  { exerciseId: "ex-1", name: "Supino reto", sets: "2", reps: "10", rest: "60s" },
  { exerciseId: "ex-2", name: "Crucifixo", sets: "1", reps: "12", rest: "60s" },
];

function plano(): UserWorkoutPlan {
  return {
    id: PLAN_ID, personal_id: 1, student_id: 2, title: "Ficha A", week_preset: "3x",
    selected_group: null, payload_json: ITENS,
    days: [{ index: DAY_INDEX, name: "Dia 1", focus: "Peito", items: ITENS }],
    created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
  };
}

function exercicio(exerciseId: string, name: string, done: boolean, completedAt = Date.now()): DraftExercise {
  return {
    exerciseId, name, biSetGroupId: null,
    sets: [{
      setIndex: 1, plannedReps: "10", plannedRestS: 0,
      loadKg: done ? "40" : "", reps: done ? "10" : "",
      done, restDoneS: null, completedAt: done ? completedAt : null,
    }],
  };
}

function semear(exercises: DraftExercise[], startedAt = Date.now() - 5 * 60 * 1000) {
  const draft: SessionDraft = {
    version: 1, planId: PLAN_ID, dayIndex: DAY_INDEX, startedAt,
    currentIndex: 0, exercises, restEndsAt: null, restForKey: null,
  };
  saveDraft(draft);
}

function renderSessao() {
  return render(
    <MemoryRouter initialEntries={[`/app/user/treino/${PLAN_ID}/${DAY_INDEX}`]}>
      <Routes>
        <Route path="/app/user/treino/:planId/:dayIndex" element={<WorkoutSessionPage />} />
        <Route path="/app/user/ficha" element={<div>Ficha</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A sessão para a qual os lembretes foram agendados na última chamada. */
function ultimaSessaoAgendada() {
  return agendarLembretesTreino.mock.calls.at(-1)?.[0];
}
/** O instante de referência ("última atividade") da última chamada. */
function ultimaReferencia(): number {
  return agendarLembretesTreino.mock.calls.at(-1)?.[1] as number;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fetchMyWorkoutPlans.mockResolvedValue([plano()]);
  getWorkoutStats.mockResolvedValue(null);
  getExercisesBatch.mockResolvedValue([]);
  searchExercises.mockResolvedValue([]);
  fetchReplacementSuggestions.mockResolvedValue(null);
  createWorkoutSession.mockResolvedValue({ streak: 1, prEvents: [], celebrate: false });
});

describe("agendamento ao entrar na sessão", () => {
  it("agenda para a sessão certa assim que o treino entra em execução", async () => {
    renderSessao();
    await screen.findByText("Supino reto");
    await waitFor(() => expect(agendarLembretesTreino).toHaveBeenCalled());
    expect(chaveSessao(ultimaSessaoAgendada())).toBe(`${PLAN_ID}:${DAY_INDEX}`);
  });

  it("na retomada, parte da última série marcada — não do início do treino", async () => {
    // Treino aberto há 2 h, com a última série marcada há 30 min. Partir do
    // início agendaria o primeiro lembrete para um instante já passado, e ele
    // nunca tocaria.
    const inicio = Date.now() - 2 * 60 * 60 * 1000;
    const ultimaSerie = Date.now() - 30 * 60 * 1000;
    semear([exercicio("ex-1", "Supino reto", true, ultimaSerie), exercicio("ex-2", "Crucifixo", false)], inicio);
    renderSessao();
    await screen.findByText("Supino reto");
    await waitFor(() => expect(agendarLembretesTreino).toHaveBeenCalled());
    expect(ultimaReferencia()).toBe(ultimaSerie);
    expect(ultimaReferencia()).toBeGreaterThan(inicio);
  });
});

describe("reagendamento por atividade real", () => {
  it("concluir uma série adia os lembretes", async () => {
    renderSessao();
    await screen.findByText("Supino reto");
    await waitFor(() => expect(agendarLembretesTreino).toHaveBeenCalled());
    const antes = ultimaReferencia();

    // O afunilamento de 1 min existe para não chamar o nativo a cada tecla; um
    // relógio adiantado é como o teste atravessa a janela sem esperar de verdade.
    const real = Date.now;
    vi.spyOn(Date, "now").mockImplementation(() => real() + 5 * 60 * 1000);
    // O ✓ existe na linha da série e na barra de ação do rodapé — os dois
    // levam ao mesmo `toggleDone`; o primeiro basta.
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Concluir série 1" })[0]);

    await waitFor(() => expect(ultimaReferencia()).toBeGreaterThan(antes));
    vi.mocked(Date.now).mockRestore();
  });

  it("avançar de exercício conta como atividade", async () => {
    renderSessao();
    await screen.findByText("Supino reto");
    await waitFor(() => expect(agendarLembretesTreino).toHaveBeenCalled());
    const chamadas = agendarLembretesTreino.mock.calls.length;

    const real = Date.now;
    vi.spyOn(Date, "now").mockImplementation(() => real() + 5 * 60 * 1000);
    await userEvent.setup().click(await screen.findByRole("button", { name: /Próximo/i }));

    await waitFor(() =>
      expect(agendarLembretesTreino.mock.calls.length).toBeGreaterThan(chamadas),
    );
    vi.mocked(Date.now).mockRestore();
  });
});

describe("fim do treino", () => {
  it("finalizar cancela os lembretes e NÃO reagenda depois", async () => {
    semear([exercicio("ex-1", "Supino reto", true), exercicio("ex-2", "Crucifixo", true)]);
    renderSessao();
    const user = userEvent.setup();
    await screen.findByText("Supino reto");
    await waitFor(() => expect(agendarLembretesTreino).toHaveBeenCalled());

    await user.click(await screen.findByRole("button", { name: "Finalizar treino" }));
    await user.click(await screen.findByRole("button", { name: "Concluir e salvar" }));

    await waitFor(() => expect(createWorkoutSession).toHaveBeenCalled());
    await waitFor(() => expect(cancelarLembretesTreino).toHaveBeenCalled());
    // Cancelamento é a ÚLTIMA palavra: nada pode reagendar depois de salvo.
    const depoisDeSalvar = agendarLembretesTreino.mock.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(agendarLembretesTreino.mock.calls.length).toBe(depoisDeSalvar);
  });

  it("descartar o treino também cancela", async () => {
    semear([exercicio("ex-1", "Supino reto", true), exercicio("ex-2", "Crucifixo", false)]);
    renderSessao();
    const user = userEvent.setup();
    await screen.findByText("Supino reto");

    await user.click(await screen.findByRole("button", { name: /Sair/i }));
    await user.click(await screen.findByRole("button", { name: /Descartar/i }));

    await waitFor(() => expect(cancelarLembretesTreino).toHaveBeenCalled());
  });

  it("sair guardando o progresso NÃO cancela — é exatamente o caso do lembrete", async () => {
    semear([exercicio("ex-1", "Supino reto", true), exercicio("ex-2", "Crucifixo", false)]);
    renderSessao();
    const user = userEvent.setup();
    await screen.findByText("Supino reto");

    await user.click(await screen.findByRole("button", { name: /Sair/i }));
    await user.click(await screen.findByRole("button", { name: "Sair (salvar progresso)" }));

    await screen.findByText("Ficha");
    expect(cancelarLembretesTreino).not.toHaveBeenCalled();
  });
});
