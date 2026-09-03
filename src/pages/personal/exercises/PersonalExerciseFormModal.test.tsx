/**
 * Formulário de criar/editar exercício personalizado.
 *
 * Cobre: validação de campo obrigatório, submit feliz (create/edit), o 409
 * de nome duplicado virando mensagem específica (não genérica), e o aviso
 * não-bloqueante de nome parecido (D11).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Exercise, ExerciseSummary } from "../../../services/exercisesApi";

const getExerciseById = vi.fn();
const searchExercises = vi.fn();
vi.mock("../../../services/exercisesApi", () => ({
  getExerciseById: (...args: unknown[]) => getExerciseById(...args),
  searchExercises: (...args: unknown[]) => searchExercises(...args),
}));

const createMyExercise = vi.fn();
const updateMyExercise = vi.fn();
const uploadPersonalExerciseMedia = vi.fn();
const registerYoutubeLink = vi.fn();

// `vi.mock` é hoisted para o topo do módulo — a classe usada dentro da
// factory precisa ser declarada via `vi.hoisted` para não ser referenciada
// antes da própria inicialização.
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
  createMyExercise: (...args: unknown[]) => createMyExercise(...args),
  updateMyExercise: (...args: unknown[]) => updateMyExercise(...args),
  uploadPersonalExerciseMedia: (...args: unknown[]) => uploadPersonalExerciseMedia(...args),
  registerYoutubeLink: (...args: unknown[]) => registerYoutubeLink(...args),
  DuplicateExerciseNameError: FakeDuplicateExerciseNameError,
}));

const trackPersonalExerciseEvent = vi.fn();
vi.mock("./personalExerciseEvents", () => ({
  trackPersonalExerciseEvent: (...args: unknown[]) => trackPersonalExerciseEvent(...args),
}));

import { PersonalExerciseFormModal } from "./PersonalExerciseFormModal";

function baseExercise(over: Partial<Exercise> = {}): Exercise {
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
    movementLabExerciseId: null,
    ownerPersonalId: "7",
    status: "active",
    instructions: ["Deite no banco inclinado", "Empurre a barra"],
    tips: ["Mantenha os ombros retraídos"],
    media: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function summaryFrom(ex: Exercise): ExerciseSummary {
  const { instructions: _instructions, tips: _tips, media: _media, ...rest } = ex;
  return { ...rest, primaryMediaUrl: null, primaryMediaType: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchExercises.mockResolvedValue([]);
});

describe("PersonalExerciseFormModal — criar", () => {
  it("bloqueia o submit sem nome, sem chamar a API", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<PersonalExerciseFormModal exerciseId={null} onClose={() => {}} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: "Criar exercício" }));

    expect(createMyExercise).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await screen.findByText("Informe o nome do exercício.")).toBeInTheDocument();
  });

  it("cria com os campos preenchidos e fecha o formulário", async () => {
    const user = userEvent.setup();
    createMyExercise.mockResolvedValue(baseExercise());
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<PersonalExerciseFormModal exerciseId={null} onClose={onClose} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Nome"), "Supino inclinado com halteres");
    await user.selectOptions(screen.getByLabelText("Grupo muscular principal"), "peito");
    await user.type(screen.getByLabelText("Execução (opcional)"), "Passo 1\nPasso 2");

    await user.click(screen.getByRole("button", { name: "Criar exercício" }));

    await waitFor(() => expect(createMyExercise).toHaveBeenCalledTimes(1));
    expect(createMyExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Supino inclinado com halteres",
        bodyPart: "peito",
        secondaryMuscles: [],
        instructions: ["Passo 1", "Passo 2"],
        tips: [],
      }),
    );
    expect(trackPersonalExerciseEvent).toHaveBeenCalledWith("personal_custom_exercise_created");
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("dispara o evento de início assim que o formulário de criação abre", () => {
    render(<PersonalExerciseFormModal exerciseId={null} onClose={() => {}} onSaved={() => {}} />);
    expect(trackPersonalExerciseEvent).toHaveBeenCalledWith("personal_custom_exercise_create_started");
  });

  it("409 DUPLICATE_NAME vira mensagem específica, sem fechar o formulário", async () => {
    const user = userEvent.setup();
    createMyExercise.mockRejectedValue(new FakeDuplicateExerciseNameError());
    const onClose = vi.fn();
    render(<PersonalExerciseFormModal exerciseId={null} onClose={onClose} onSaved={() => {}} />);

    await user.type(screen.getByLabelText("Nome"), "Supino Reto");
    await user.click(screen.getByRole("button", { name: "Criar exercício" }));

    expect(
      await screen.findByText(/Você já tem um exercício ativo com esse nome na sua biblioteca/),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("D11 — nome parecido com o catálogo global vira aviso não-bloqueante", async () => {
    const user = userEvent.setup();
    searchExercises.mockResolvedValue([
      summaryFrom(baseExercise({ id: "global-1", ownerPersonalId: null, name: "Supino Reto com Barra" })),
    ]);
    render(<PersonalExerciseFormModal exerciseId={null} onClose={() => {}} onSaved={() => {}} />);

    await user.type(screen.getByLabelText("Nome"), "Supino Reto");

    expect(
      await screen.findByText(/Já existe um exercício semelhante no catálogo S2CORE/),
    ).toBeInTheDocument();
  });

  it("QA sprint P1: nome digitado MAIOR que já contém um nome do catálogo dispara o aviso (caso canônico da spec D11)", async () => {
    const user = userEvent.setup();
    searchExercises.mockResolvedValue([
      summaryFrom(baseExercise({ id: "global-1", ownerPersonalId: null, name: "Supino Reto" })),
    ]);
    render(<PersonalExerciseFormModal exerciseId={null} onClose={() => {}} onSaved={() => {}} />);

    await user.type(screen.getByLabelText("Nome"), "Supino Reto Personalizado");

    // A causa raiz era mandar o texto inteiro como `q` — o backend só acha
    // candidato quando o nome do CATÁLOGO contém o termo buscado.
    await waitFor(() => expect(searchExercises).toHaveBeenCalledWith({ q: "Supino", limit: 5 }));
    expect(
      await screen.findByText(/Já existe um exercício semelhante no catálogo S2CORE/),
    ).toBeInTheDocument();
  });

  it("exercício parecido, mas da PRÓPRIA biblioteca, não dispara o aviso (é o 409 quem cuida disso)", async () => {
    const user = userEvent.setup();
    searchExercises.mockResolvedValue([
      summaryFrom(baseExercise({ id: "mine-1", ownerPersonalId: "7", name: "Supino Reto com Barra" })),
    ]);
    render(<PersonalExerciseFormModal exerciseId={null} onClose={() => {}} onSaved={() => {}} />);

    await user.type(screen.getByLabelText("Nome"), "Supino Reto");

    await waitFor(() => expect(searchExercises).toHaveBeenCalled());
    expect(screen.queryByText(/Já existe um exercício semelhante/)).not.toBeInTheDocument();
  });
});

describe("PersonalExerciseFormModal — editar", () => {
  it("carrega os dados existentes e envia o PATCH ao salvar", async () => {
    const user = userEvent.setup();
    getExerciseById.mockResolvedValue(baseExercise());
    updateMyExercise.mockResolvedValue(baseExercise({ name: "Supino inclinado (ajustado)" }));
    const onSaved = vi.fn();
    render(<PersonalExerciseFormModal exerciseId="ex-1" onClose={() => {}} onSaved={onSaved} />);

    expect(await screen.findByDisplayValue("Supino inclinado")).toBeInTheDocument();
    // Mídia só existe em modo edição — a mensagem de "salve primeiro" não aparece aqui.
    expect(screen.queryByText(/Salve o exercício para depois/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(updateMyExercise).toHaveBeenCalledWith("ex-1", expect.objectContaining({ name: "Supino inclinado" })));
    expect(trackPersonalExerciseEvent).toHaveBeenCalledWith("personal_custom_exercise_edited");
    expect(onSaved).toHaveBeenCalled();
  });

  it("exercício inexistente mostra erro em vez de formulário vazio", async () => {
    getExerciseById.mockResolvedValue(null);
    render(<PersonalExerciseFormModal exerciseId="ghost" onClose={() => {}} onSaved={() => {}} />);

    expect(await screen.findByText("Exercício não encontrado.")).toBeInTheDocument();
  });
});
