/**
 * Montagem do treino livre — o que sobrevive a fechar a tela.
 *
 * A seleção só existia em memória: F5 (ou o Android matando a aba do PWA)
 * apagava os exercícios escolhidos um a um. O par que importa é este: o que foi
 * escolhido volta ao abrir, e o que virou treino em execução NÃO volta como
 * montagem — senão a mesma lista existiria duas vezes, em dois estados.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/exercisesApi", () => ({
  searchExercises: vi.fn().mockResolvedValue([]),
}));

const { cancelarLembretesTreino } = vi.hoisted(() => ({ cancelarLembretesTreino: vi.fn() }));
vi.mock("../workoutSession/pendingWorkoutReminder", () => ({
  cancelarLembretesTreino: () => {
    cancelarLembretesTreino();
    return Promise.resolve();
  },
}));

import FreeWorkoutSetupPage from "./FreeWorkoutSetupPage";
import { loadFreeSetupDraft, saveFreeSetupDraft } from "./freeSetupDraft";
import { loadFreeDraft, saveFreeDraft } from "../workoutSession/sessionDraft";
import type { FreeWorkoutItem } from "./freeSessionOps";

const item = (id: string, name: string, bodyPart: string): FreeWorkoutItem => ({
  exerciseId: id,
  name,
  bodyPart,
  sets: 3,
  reps: "10",
  restS: 60,
});

function abrirTela() {
  return render(
    <MemoryRouter>
      <FreeWorkoutSetupPage />
    </MemoryRouter>,
  );
}

describe("FreeWorkoutSetupPage — persistência da montagem", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reabre a tela com a seleção que estava montada", () => {
    saveFreeSetupDraft([item("ex-1", "Supino reto", "peito"), item("ex-2", "Crucifixo", "peito")]);
    abrirTela();
    expect(screen.getByText("Supino reto")).toBeInTheDocument();
    expect(screen.getByText("Crucifixo")).toBeInTheDocument();
    expect(screen.getByText(/2 exercícios/)).toBeInTheDocument();
  });

  it("montagem restaurada não é treino em andamento", () => {
    saveFreeSetupDraft([item("ex-1", "Supino reto", "peito")]);
    abrirTela();
    expect(screen.queryByText("Treino livre em andamento")).toBeNull();
    expect(screen.getByRole("button", { name: "Começar treino" })).toBeEnabled();
  });

  it("remover o último exercício limpa a montagem guardada", async () => {
    const user = userEvent.setup();
    saveFreeSetupDraft([item("ex-1", "Supino reto", "peito")]);
    abrirTela();
    await user.click(screen.getByRole("button", { name: "Remover Supino reto do treino" }));
    expect(screen.getByText(/Nenhum exercício escolhido ainda/)).toBeInTheDocument();
    expect(loadFreeSetupDraft()).toEqual([]);
  });

  it("começar o treino move a lista para o rascunho de sessão e limpa a montagem", async () => {
    const user = userEvent.setup();
    saveFreeSetupDraft([item("ex-1", "Supino reto", "peito")]);
    abrirTela();
    await user.click(screen.getByRole("button", { name: "Começar treino" }));
    expect(loadFreeSetupDraft()).toEqual([]);
    expect(loadFreeDraft()?.exercises.map((e) => e.name)).toEqual(["Supino reto"]);
  });
});

/**
 * Descartar aqui é uma SAÍDA do treino que não passa pela tela de sessão — e
 * por isso escapou quando o lembrete foi ligado. Sem o cancelamento, a
 * notificação tocava horas depois apontando para um treino que já não existia.
 */
describe("FreeWorkoutSetupPage — descarte cancela o lembrete", () => {
  beforeEach(() => {
    localStorage.clear();
    cancelarLembretesTreino.mockClear();
  });

  it("descartar o treino aberto cancela os lembretes pendentes", async () => {
    saveFreeDraft({
      version: 1,
      mode: "free",
      startedAt: Date.now() - 60 * 60 * 1000,
      currentIndex: 0,
      exercises: [
        {
          exerciseId: "ex-1",
          name: "Supino",
          biSetGroupId: null,
          sets: [
            {
              setIndex: 1, plannedReps: "10", plannedRestS: 60,
              loadKg: "40", reps: "10", done: true,
              restDoneS: null, completedAt: Date.now() - 60 * 60 * 1000,
            },
          ],
        },
      ],
      restEndsAt: null,
      restForKey: null,
      clientKey: "k",
    });
    abrirTela();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Descartar e começar novo" }));
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    expect(cancelarLembretesTreino).toHaveBeenCalled();
    expect(loadFreeDraft()).toBeNull();
  });
});
