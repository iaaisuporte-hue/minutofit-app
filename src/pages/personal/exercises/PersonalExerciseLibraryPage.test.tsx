/**
 * Tela de gestão "Meus Exercícios" — empty state, arquivar (com o texto
 * exato da spec) e o 409 de restaurar virando mensagem específica.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExerciseSummary } from "../../../services/exercisesApi";

const listMyExercises = vi.fn();
const archiveMyExercise = vi.fn();
const restoreMyExercise = vi.fn();

const { FakeDuplicateExerciseNameError } = vi.hoisted(() => {
  class FakeDuplicateExerciseNameError extends Error {
    constructor() {
      super("DUPLICATE_NAME");
      this.name = "DuplicateExerciseNameError";
    }
  }
  return { FakeDuplicateExerciseNameError };
});

vi.mock("../../../services/personalExercisesApi", () => ({
  listMyExercises: (...args: unknown[]) => listMyExercises(...args),
  archiveMyExercise: (...args: unknown[]) => archiveMyExercise(...args),
  restoreMyExercise: (...args: unknown[]) => restoreMyExercise(...args),
  DuplicateExerciseNameError: FakeDuplicateExerciseNameError,
}));

vi.mock("./personalExerciseEvents", () => ({ trackPersonalExerciseEvent: vi.fn() }));

// O formulário tem cobertura própria (`PersonalExerciseFormModal.test.tsx`) —
// aqui só interessa que a lista abre e fecha o modal certo.
vi.mock("./PersonalExerciseFormModal", () => ({
  PersonalExerciseFormModal: ({ exerciseId }: { exerciseId: string | null }) => (
    <div data-testid="form-modal">{exerciseId ?? "novo"}</div>
  ),
}));

import PersonalExerciseLibraryPage from "./PersonalExerciseLibraryPage";

function exercise(over: Partial<ExerciseSummary> = {}): ExerciseSummary {
  return {
    id: "ex-1",
    externalId: null,
    source: "personal",
    name: "Supino inclinado",
    normalizedName: "supino inclinado",
    bodyPart: "peito",
    targetMuscle: "",
    secondaryMuscles: [],
    equipment: "Barra",
    tags: [],
    primaryMediaUrl: null,
    primaryMediaType: null,
    movementLabExerciseId: null,
    ownerPersonalId: "7",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PersonalExerciseLibraryPage", () => {
  it("empty state com o texto exato da spec e CTA de criar", async () => {
    listMyExercises.mockResolvedValue([]);
    render(<PersonalExerciseLibraryPage />);

    expect(
      await screen.findByText(
        "Crie exercícios específicos da sua metodologia e utilize-os nas fichas dos seus alunos.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Você ainda não criou exercícios personalizados")).toBeInTheDocument();
  });

  it("lista os exercícios carregados", async () => {
    listMyExercises.mockResolvedValue([exercise()]);
    render(<PersonalExerciseLibraryPage />);

    expect(await screen.findByText("Supino inclinado")).toBeInTheDocument();
  });

  it("arquivar pede confirmação com o texto exato da spec e chama a API só após confirmar", async () => {
    const user = userEvent.setup();
    listMyExercises.mockResolvedValue([exercise()]);
    archiveMyExercise.mockResolvedValue(exercise({ status: "archived" }));
    render(<PersonalExerciseLibraryPage />);

    await user.click(await screen.findByRole("button", { name: "Arquivar" }));

    expect(
      screen.getByText(
        "Este exercício deixará de aparecer para novas fichas. Treinos e históricos existentes não serão alterados.",
      ),
    ).toBeInTheDocument();
    expect(archiveMyExercise).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Arquivar" })[1]);

    await waitFor(() => expect(archiveMyExercise).toHaveBeenCalledWith("ex-1"));
  });

  it("restaurar com 409 mostra mensagem específica, não erro genérico", async () => {
    const user = userEvent.setup();
    listMyExercises.mockResolvedValue([exercise({ status: "archived" })]);
    restoreMyExercise.mockRejectedValue(new FakeDuplicateExerciseNameError());
    render(<PersonalExerciseLibraryPage />);

    await user.click(await screen.findByRole("button", { name: "Restaurar" }));

    expect(
      await screen.findByText(/Já existe um exercício ativo chamado "Supino inclinado"/),
    ).toBeInTheDocument();
  });

  it("abre o formulário de criação ao clicar em 'Criar exercício'", async () => {
    const user = userEvent.setup();
    // Lista com 1 item: evita o segundo botão "Criar exercício" do empty state.
    listMyExercises.mockResolvedValue([exercise()]);
    render(<PersonalExerciseLibraryPage />);

    await user.click(await screen.findByRole("button", { name: "Criar exercício" }));

    expect(screen.getByTestId("form-modal")).toHaveTextContent("novo");
  });
});
