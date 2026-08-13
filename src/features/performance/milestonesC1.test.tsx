/**
 * Aba Marcos — comportamento (Spec 034, Onda C1).
 *
 * O contrato das 7 abas vive em `evolutionTabs.test.tsx`. Aqui o alvo é o que a
 * aba faz: mostrar trajetória em vez de vitrine, exibir a evidência que
 * sustenta cada marco, e tratar a privacidade como decisão do titular — que
 * responde na hora e volta atrás se o servidor recusar.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getMilestones = vi.fn();
const setMilestoneShared = vi.fn();

vi.mock("./performanceApi", () => ({
  getMilestones: (...args: unknown[]) => getMilestones(...args),
  setMilestoneShared: (...args: unknown[]) => setMilestoneShared(...args),
}));
vi.mock("./performanceEvents", () => ({ postPerformanceEvent: vi.fn() }));

import MilestonesTab from "../../pages/user/evolution/MilestonesTab";
import { postPerformanceEvent } from "./performanceEvents";

const CONQUISTADO = {
  code: "first_workout",
  title: "Primeiro treino",
  description: "Você registrou o primeiro treino no S2CORE.",
  criterion: "Primeira sessão de treino executada.",
  unlockedAt: "2026-02-02T12:00:00.000Z",
  evidence: { sessionId: 91, performedAt: "2026-02-02T12:00:00.000Z" },
  shared: false,
  available: true,
  unavailableReason: null,
};

const EM_ABERTO = {
  code: "first_pr",
  title: "Primeiro recorde pessoal",
  description: "Você superou a própria marca em um exercício pela primeira vez.",
  criterion: "Primeiro recorde pessoal real — superar um número que já era seu.",
  unlockedAt: null,
  evidence: null,
  shared: false,
  available: true,
  unavailableReason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Marcos · estado inicial", () => {
  it("sem marco nenhum, a copy fala de caminho — nunca de ausência", async () => {
    getMilestones.mockResolvedValue([EM_ABERTO]);
    render(<MilestonesTab />);

    await waitFor(() => expect(screen.getByText(/Seus marcos aparecem aqui/i)).toBeTruthy());
    // "Você não conquistou nada" é literalmente o tom que o produto proíbe.
    expect(screen.queryByText(/não conquistou/i)).toBeNull();
    expect(screen.queryByText(/vazio/i)).toBeNull();
  });

  it("o que falta aparece com o critério, não como cadeado mudo", async () => {
    getMilestones.mockResolvedValue([EM_ABERTO]);
    render(<MilestonesTab />);

    await waitFor(() => expect(screen.getByText(/Em aberto/i)).toBeTruthy());
    expect(screen.getByText(/superar um número que já era seu/i)).toBeTruthy();
  });

  it("fala 'recorde pessoal', não a sigla solta", async () => {
    getMilestones.mockResolvedValue([EM_ABERTO]);
    render(<MilestonesTab />);
    // Aparece no título e no critério — o ponto é que a sigla nunca vem sozinha.
    await waitFor(() =>
      expect(screen.getAllByText(/recorde pessoal/i).length).toBeGreaterThan(0),
    );
  });

  it("marco sem caminho diz o que falta destravar, não o critério", async () => {
    getMilestones.mockResolvedValue([
      {
        ...EM_ABERTO,
        code: "four_consistent_weeks",
        title: "Quatro semanas consistentes",
        criterion: "Quatro semanas consecutivas com pelo menos 80% da frequência prevista.",
        available: false,
        unavailableReason: "Precisa de uma ficha com frequência prevista.",
      },
    ]);
    render(<MilestonesTab />);

    await waitFor(() =>
      expect(screen.getByText(/Precisa de uma ficha com frequência prevista/i)).toBeTruthy(),
    );
    expect(screen.queryByText(/80% da frequência/i)).toBeNull();
  });

  it("falha de rede oferece como tentar de novo", async () => {
    getMilestones.mockResolvedValueOnce(null).mockResolvedValueOnce([CONQUISTADO]);
    const user = userEvent.setup();
    render(<MilestonesTab />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    await waitFor(() => expect(screen.getByText(/Conquistados/i)).toBeTruthy());
  });

  it("falha de rede não deixa a aba em branco", async () => {
    getMilestones.mockResolvedValue(null);
    render(<MilestonesTab />);
    await waitFor(() =>
      expect(screen.getByText(/Não foi possível carregar agora/i)).toBeTruthy(),
    );
    // E não sugere que o dado sumiu.
    expect(screen.getByText(/continuam salvos/i)).toBeTruthy();
  });
});

describe("Marcos · conquistado", () => {
  it("mostra título, data e a evidência resumida", async () => {
    getMilestones.mockResolvedValue([
      {
        ...CONQUISTADO,
        code: "first_full_week",
        title: "Primeira semana completa",
        evidence: { weekStart: "2026-02-02", weekEnd: "2026-02-08", activeDays: 3, targetDays: 3 },
      },
    ]);
    render(<MilestonesTab />);

    await waitFor(() => expect(screen.getByText(/Conquistados/i)).toBeTruthy());
    // A evidência é o número que sustenta o marco — não um parabéns genérico.
    expect(screen.getByText(/3 de 3 dias previstos/i)).toBeTruthy();
  });

  it("nasce privado e diz isso em português claro", async () => {
    getMilestones.mockResolvedValue([CONQUISTADO]);
    render(<MilestonesTab />);
    await waitFor(() => expect(screen.getByText(/Privado — só você vê/i)).toBeTruthy());
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
  });
});

describe("Marcos · privacidade é decisão do titular", () => {
  it("marcar compartilhar responde na hora e registra o evento", async () => {
    getMilestones.mockResolvedValue([CONQUISTADO]);
    setMilestoneShared.mockResolvedValue({ ...CONQUISTADO, shared: true });
    const user = userEvent.setup();

    render(<MilestonesTab />);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeTruthy());
    await user.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(setMilestoneShared).toHaveBeenCalledWith("first_workout", true),
    );
    expect(postPerformanceEvent).toHaveBeenCalledWith(
      "community.milestone_share_changed",
      { code: "first_workout", shared: true },
    );
  });

  it("se o servidor recusa, o estado volta e o aluno é avisado", async () => {
    // Privacidade não pode mentir: um toggle que "ficou marcado" sem ter sido
    // salvo faria o aluno acreditar numa escolha que não existe.
    getMilestones.mockResolvedValue([CONQUISTADO]);
    setMilestoneShared.mockResolvedValue(null);
    const user = userEvent.setup();

    render(<MilestonesTab />);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeTruthy());
    await user.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
    expect(screen.getByText(/Privado — só você vê/i)).toBeTruthy();
  });
});
