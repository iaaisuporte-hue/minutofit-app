/**
 * Metas — contratos de UI da Onda P4 (Spec 033).
 *
 * O que estes testes protegem: que a barra só apareça quando há o que medir,
 * que a meta de exercício removido continue legível, que o erro do servidor
 * chegue ao aluno como orientação, e que o convite ao Premium venha do servidor
 * — nunca de uma decisão do cliente.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./performanceApi", () => ({
  getGoals: vi.fn(),
  createGoal: vi.fn(),
  abandonGoal: vi.fn(),
}));
vi.mock("./performanceEvents", () => ({ postPerformanceEvent: vi.fn() }));
vi.mock("../../lib/platform", () => ({ isNativeApp: () => false }));
vi.mock("../../services/exercisesApi", () => ({ searchExercises: vi.fn() }));

import GoalsTab from "../../pages/user/evolution/GoalsTab";
import { GoalCard } from "./GoalCard";
import { abandonGoal, createGoal, getGoals, type Goal } from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";
import { searchExercises } from "../../services/exercisesApi";

const mockedGetGoals = vi.mocked(getGoals);
const mockedCreate = vi.mocked(createGoal);
const mockedAbandon = vi.mocked(abandonGoal);
const mockedSearch = vi.mocked(searchExercises);

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "1",
  kind: "exercise_load",
  status: "active",
  exerciseId: "11111111-1111-4111-8111-111111111111",
  exerciseName: "Supino reto",
  targetValue: 100,
  targetReps: null,
  unit: "kg",
  progressUnit: "kg",
  baselineValue: 70,
  currentValue: 85,
  progress: 0.5,
  remaining: 15,
  startsOn: "2026-08-01",
  dueOn: null,
  achievedAt: null,
  metricVersion: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  monotonic: true,
  ...over,
});

const resposta = (goals: Goal[], over = {}) => ({
  gated: false,
  goals,
  activeCount: goals.filter((g) => g.status === "active").length,
  maxActive: 5,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedSearch.mockResolvedValue([]);
});

describe("GoalCard", () => {
  it("responde às quatro perguntas: qual meta, onde estou, quanto falta, avançando", () => {
    render(<GoalCard goal={goal()} />);

    expect(screen.getByText("Supino reto: Carga de 100 kg")).toBeInTheDocument();
    expect(screen.getByText("85 kg")).toBeInTheDocument();
    expect(screen.getByText(/faltam 15 kg/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("a barra some quando não há o que medir — vazia diria 'zero de progresso'", () => {
    render(<GoalCard goal={goal({ progress: null, currentValue: null, remaining: null })} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/Registre um treino deste exercício/)).toBeInTheDocument();
  });

  it("estado vem por texto, não só por cor", () => {
    render(<GoalCard goal={goal({ status: "achieved", achievedAt: "2026-08-10T12:00:00.000Z" })} />);
    expect(screen.getByText("Concluída")).toBeInTheDocument();
  });

  it("meta de exercício removido continua legível pelo nome histórico", () => {
    render(<GoalCard goal={goal({ exerciseId: null, exerciseName: "Remada que saiu do catálogo" })} />);
    expect(screen.getByText(/Remada que saiu do catálogo/)).toBeInTheDocument();
  });

  it('"30 kg × 12 reps" é escrita com os dois alvos, e mede em repetições', () => {
    render(
      <GoalCard
        goal={goal({
          kind: "exercise_reps_at_load",
          exerciseName: "Rosca direta",
          targetValue: 30,
          targetReps: 12,
          progressUnit: "reps",
          currentValue: 8,
          baselineValue: 6,
          progress: 0.333,
          remaining: 4,
        })}
      />,
    );
    expect(screen.getByText("Rosca direta: 30 kg × 12 reps")).toBeInTheDocument();
    expect(screen.getByText("8 reps")).toBeInTheDocument();
    expect(screen.getByText(/faltam 4 reps/)).toBeInTheDocument();
  });

  it("abandonar pede confirmação antes de agir", async () => {
    const onAbandon = vi.fn();
    render(<GoalCard goal={goal()} onAbandon={onAbandon} />);

    await userEvent.click(screen.getByRole("button", { name: "Abandonar meta" }));
    expect(onAbandon).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Abandonar" }));
    expect(onAbandon).toHaveBeenCalledTimes(1);
  });
});

describe("GoalsTab", () => {
  it("mostra carregando antes dos dados", () => {
    mockedGetGoals.mockReturnValue(new Promise(() => {}) as never);
    const { container } = render(<GoalsTab />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("estado vazio explica o recurso e oferece o CTA", async () => {
    mockedGetGoals.mockResolvedValue(resposta([]) as never);
    render(<GoalsTab />);

    expect(await screen.findByText("Nenhuma meta por enquanto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar meta" })).toBeEnabled();
  });

  it("separa em andamento de histórico", async () => {
    mockedGetGoals.mockResolvedValue(
      resposta([
        goal({ id: "1" }),
        goal({ id: "2", status: "achieved", achievedAt: "2026-08-10T12:00:00.000Z" }),
        goal({ id: "3", status: "abandoned" }),
      ]) as never,
    );
    render(<GoalsTab />);

    expect(await screen.findByText("Em andamento")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText("Abandonada")).toBeInTheDocument();
  });

  it("falha de rede é dita, não silenciada — o aluno esperava a lista dele", async () => {
    mockedGetGoals.mockResolvedValue(null);
    render(<GoalsTab />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não conseguimos carregar/);
  });

  it("sem Premium, o servidor manda gated e a UI convida", async () => {
    mockedGetGoals.mockResolvedValue({ gated: true, goals: [], activeCount: 0, maxActive: 5 } as never);
    render(<GoalsTab />);

    expect(await screen.findByText(/Disponível no Premium/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar meta" })).not.toBeInTheDocument();
  });

  it("no limite de metas ativas, o botão desabilita e explica", async () => {
    const cinco = [1, 2, 3, 4, 5].map((i) => goal({ id: String(i), targetValue: 90 + i }));
    mockedGetGoals.mockResolvedValue(resposta(cinco) as never);
    render(<GoalsTab />);

    await screen.findByText("Em andamento");
    expect(screen.getByRole("button", { name: "Criar meta" })).toBeDisabled();
    expect(screen.getByText(/Conclua ou abandone uma para criar outra/)).toBeInTheDocument();
  });

  it("abandonar recarrega a lista e registra o evento", async () => {
    mockedGetGoals.mockResolvedValue(resposta([goal()]) as never);
    mockedAbandon.mockResolvedValue(goal({ status: "abandoned" }));
    render(<GoalsTab />);

    await screen.findByText("Em andamento");
    await userEvent.click(screen.getByRole("button", { name: "Abandonar meta" }));
    await userEvent.click(screen.getByRole("button", { name: "Abandonar" }));

    await waitFor(() => expect(mockedAbandon).toHaveBeenCalledWith("1"));
    expect(mockedGetGoals).toHaveBeenCalledTimes(2);
    expect(postPerformanceEvent).toHaveBeenCalledWith(
      "performance.goal_cancelled",
      expect.objectContaining({ kind: "exercise_load" }),
    );
  });
});

describe("criação de meta", () => {
  async function abrirFormulario() {
    mockedGetGoals.mockResolvedValue(resposta([]) as never);
    render(<GoalsTab />);
    await screen.findByText("Nenhuma meta por enquanto");
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }));
  }

  it("não pede valor atual: o ponto de partida é medido pelo servidor", async () => {
    await abrirFormulario();
    expect(screen.queryByLabelText(/atual/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de meta")).toBeInTheDocument();
  });

  it("cria uma meta de frequência sem exigir exercício", async () => {
    await abrirFormulario();
    mockedCreate.mockResolvedValue(goal({ kind: "weekly_frequency" }));

    await userEvent.selectOptions(screen.getByLabelText("Tipo de meta"), "weekly_frequency");
    expect(screen.queryByLabelText("Exercício")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Treinos por semana"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "weekly_frequency", targetValue: 4, exerciseId: null }),
      ),
    );
    expect(postPerformanceEvent).toHaveBeenCalledWith(
      "performance.goal_created",
      expect.objectContaining({ kind: "weekly_frequency" }),
    );
  });

  it("meta de exercício exige o exercício antes de enviar", async () => {
    await abrirFormulario();
    await userEvent.type(screen.getByLabelText("Carga alvo (kg)"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha o exercício da meta.");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("escolher o exercício pela busca envia o id, não o texto digitado", async () => {
    await abrirFormulario();
    mockedSearch.mockResolvedValue([
      { id: "22222222-2222-4222-8222-222222222222", name: "Supino reto" } as never,
    ]);
    mockedCreate.mockResolvedValue(goal());

    await userEvent.type(screen.getByLabelText("Exercício"), "supino");
    const opcao = await screen.findByRole("button", { name: "Supino reto" });
    await userEvent.click(opcao);

    await userEvent.type(screen.getByLabelText("Carga alvo (kg)"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ exerciseId: "22222222-2222-4222-8222-222222222222" }),
      ),
    );
  });

  it("o motivo da recusa vem do servidor e é mostrado literal — é orientação", async () => {
    await abrirFormulario();
    mockedCreate.mockRejectedValue(
      new Error("Você já está nesse patamar. Escolha um alvo acima do seu melhor atual."),
    );

    await userEvent.selectOptions(screen.getByLabelText("Tipo de meta"), "streak");
    await userEvent.type(screen.getByLabelText("Dias seguidos"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/já está nesse patamar/);
  });

  it("o campo de repetições só existe no tipo de dois alvos", async () => {
    await abrirFormulario();
    expect(screen.queryByLabelText("Repetições")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Tipo de meta"), "exercise_reps_at_load");
    expect(screen.getByLabelText("Repetições")).toBeInTheDocument();
  });

  it("todo controle do formulário tem rótulo associado", async () => {
    await abrirFormulario();
    const form = screen.getByLabelText("Tipo de meta").closest("form")!;
    for (const control of within(form).getAllByRole("textbox").concat(
      within(form).getAllByRole("combobox"),
      within(form).getAllByRole("spinbutton"),
    )) {
      expect(control).toHaveAccessibleName();
    }
  });
});
