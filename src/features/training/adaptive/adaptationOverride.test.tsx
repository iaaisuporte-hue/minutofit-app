/**
 * Override do treino adaptado — contrato de UI (Spec 033, Onda P6).
 *
 * O ajuste do dia é uma sugestão, não uma tutela. Estes testes travam três
 * coisas: que o aluno consiga voltar à prescrição original, que ele veja o que
 * mudou antes de escolher, e que a escolha seja reversível — nenhuma delas
 * existia antes desta onda, embora o `originalPlanDay` já chegasse do servidor.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../services/trainingAdaptiveApi", () => ({
  trackAdaptationBannerViewed: vi.fn(),
  postTrainingEvent: vi.fn(),
}));

import { AdaptationBanner } from "./AdaptationBanner";

const CHANGES = [
  {
    exerciseId: "ex-1",
    field: "sets",
    original: "4",
    adapted: "3",
    reason: "Estado amarelo — carga reduzida",
  },
  {
    exerciseId: "ex-1",
    field: "rest",
    original: "90",
    adapted: "103s",
    reason: "Recuperação priorizada",
  },
];

const NOMES = { "ex-1": "Supino reto" };

beforeEach(() => vi.clearAllMocks());

describe("banner de adaptação", () => {
  it("sem mudanças e sem sugestão, não ocupa espaço na tela", () => {
    const { container } = render(
      <AdaptationBanner changes={[]} recoverySuggestion={null} exerciseNames={{}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o que mudou, com valor original e adaptado", async () => {
    render(
      <AdaptationBanner changes={CHANGES as never} recoverySuggestion={null} exerciseNames={NOMES} />,
    );
    // O diff fica atrás de um toque para não competir com o treino em si.
    const expandir = screen.getByRole("button");
    await userEvent.click(expandir);

    expect(screen.getByText("Supino reto")).toBeInTheDocument();
    // O diff aparece campo a campo: o valor prescrito e o de hoje, lado a lado.
    // `/3/` casaria também com "103s"; a asserção precisa ser do texto exato.
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("103s")).toBeInTheDocument();
  });
});

describe("override do aluno", () => {
  it("não aparece quando a tela não oferece a escolha", () => {
    render(
      <AdaptationBanner changes={CHANGES as never} recoverySuggestion={null} exerciseNames={NOMES} />,
    );
    expect(screen.queryByRole("button", { name: /treino original/i })).not.toBeInTheDocument();
  });

  it("oferece seguir o original e informa a escolha", async () => {
    const onToggle = vi.fn();
    render(
      <AdaptationBanner
        changes={CHANGES as never}
        recoverySuggestion={null}
        exerciseNames={NOMES}
        usingOriginal={false}
        onToggleOriginal={onToggle}
      />,
    );

    const botao = screen.getByRole("button", { name: /Prefiro seguir o treino original/i });
    expect(botao).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(botao);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("com o original ativo, o caminho de volta é explícito", async () => {
    const onToggle = vi.fn();
    render(
      <AdaptationBanner
        changes={CHANGES as never}
        recoverySuggestion={null}
        exerciseNames={NOMES}
        usingOriginal
        onToggleOriginal={onToggle}
      />,
    );

    const botao = screen.getByRole("button", { name: /Voltar ao treino ajustado de hoje/i });
    expect(botao).toHaveAttribute("aria-pressed", "true");

    // Reversível: a escolha do aluno não o tranca fora do ajuste.
    await userEvent.click(botao);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("o estado é dito por texto e por aria-pressed, não só por cor", () => {
    const { rerender } = render(
      <AdaptationBanner
        changes={CHANGES as never}
        recoverySuggestion={null}
        exerciseNames={NOMES}
        usingOriginal={false}
        onToggleOriginal={vi.fn()}
      />,
    );
    expect(screen.getByText(/Prefiro seguir o treino original/i)).toBeInTheDocument();

    rerender(
      <AdaptationBanner
        changes={CHANGES as never}
        recoverySuggestion={null}
        exerciseNames={NOMES}
        usingOriginal
        onToggleOriginal={vi.fn()}
      />,
    );
    expect(screen.getByText(/Voltar ao treino ajustado/i)).toBeInTheDocument();
  });

  it("a sugestão de recuperação continua visível junto da escolha", async () => {
    render(
      <AdaptationBanner
        changes={CHANGES as never}
        recoverySuggestion={{ kind: "mobility", microcopy: "10–15 min de mobilidade ao final." } as never}
        exerciseNames={NOMES}
        usingOriginal={false}
        onToggleOriginal={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByRole("button")[0]);

    expect(screen.getByText(/mobilidade ao final/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /treino original/i })).toBeInTheDocument();
  });
});
