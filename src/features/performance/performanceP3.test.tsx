/**
 * Progress Score — contratos de UI da Onda P3 (Spec 033).
 *
 * O que estes testes protegem: que o número nunca apareça sem explicação, que
 * "ainda não dá para dizer" não vire zero, que a direção seja legível sem cor,
 * e que falha de rede não estrague a aba inteira.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./performanceApi", () => ({
  getPerformanceOverview: vi.fn(),
  getScoreHistory: vi.fn(),
}));
vi.mock("./performanceEvents", () => ({ postPerformanceEvent: vi.fn() }));
vi.mock("../../lib/platform", () => ({ isNativeApp: () => false }));

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  };
});

import { ProgressScoreSection } from "./ProgressScoreSection";
import { getPerformanceOverview, getScoreHistory } from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";

const mockedOverview = vi.mocked(getPerformanceOverview);
const mockedHistory = vi.mocked(getScoreHistory);

const overview = (over: Record<string, unknown> = {}) =>
  ({
    gated: false,
    freeSummary: { sessions30d: 12, activeDays28: 10, currentStreak: 3 },
    consistency: { pct: 80, activeDays28: 10, targetPerWeek: 3 },
    score: {
      value: 78,
      status: "ok",
      trend: "up",
      factors: [
        { id: "progression.load", label: "Carga subiu em 3 de 3 exercícios", delta: 18 },
        { id: "volume.trend", label: "Volume 13% acima do período anterior", delta: 4 },
        { id: "pr.recent", label: "Você bateu um recorde", delta: 6 },
      ],
      changes7d: [{ id: "pr.recent", label: "Você bateu um recorde", delta: 6 }],
      updatedAt: "2026-08-12",
      formulaVersion: 1,
    },
    load: { effortLoad7d: 320, ratioBand: "within", ratioLabel: "Dentro do seu ritmo habitual" },
    headline: "Destaque do período: carga subiu em 3 de 3 exercícios.",
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockedHistory.mockResolvedValue({ gated: false, points: [] } as never);
});

describe("ProgressScoreSection", () => {
  it("mostra o número com a tendência", async () => {
    mockedOverview.mockResolvedValue(overview());
    render(<ProgressScoreSection />);

    expect(await screen.findByText("78")).toBeInTheDocument();
    expect(screen.getByText(/em alta/)).toBeInTheDocument();
    expect(
      screen.getByText("Destaque do período: carga subiu em 3 de 3 exercícios."),
    ).toBeInTheDocument();
  });

  it("o número nunca fica sem explicação — o breakdown abre e lista os fatores", async () => {
    mockedOverview.mockResolvedValue(overview());
    render(<ProgressScoreSection />);

    const toggle = await screen.findByRole("button", { name: /o que compõe/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);

    expect(await screen.findByText("Carga subiu em 3 de 3 exercícios")).toBeInTheDocument();
    expect(screen.getByText("Volume 13% acima do período anterior")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(postPerformanceEvent).toHaveBeenCalledWith(
      "performance.score_component_opened",
      expect.anything(),
    );
  });

  it("direção é legível sem cor: seta e sinal acompanham cada fator", async () => {
    mockedOverview.mockResolvedValue(
      overview({
        score: {
          ...(overview() as unknown as { score: Record<string, unknown> }).score,
          trend: "down",
          factors: [{ id: "inactivity", label: "16 dias sem treino registrado", delta: -20 }],
          changes7d: [],
        },
      }),
    );
    render(<ProgressScoreSection />);

    await userEvent.click(await screen.findByRole("button", { name: /o que compõe/i }));
    const item = screen.getByText("16 dias sem treino registrado").closest("li")!;
    expect(item.textContent).toContain("↓");
    expect(item.textContent).toContain("−20");
    // A tendência do topo também traz texto, não só a seta.
    expect(screen.getByText(/em queda/)).toBeInTheDocument();
  });

  it("dados insuficientes viram 'Calibrando', nunca zero", async () => {
    mockedOverview.mockResolvedValue(
      overview({
        score: {
          value: null,
          status: "onboarding",
          trend: "stable",
          factors: [{ id: "onboarding.calibrating", label: "Calibrando", delta: 0 }],
          changes7d: [],
          updatedAt: "2026-08-12",
          formulaVersion: 1,
        },
        headline: "Continue registrando seus treinos para construirmos sua linha de evolução.",
      }),
    );
    render(<ProgressScoreSection />);

    expect(await screen.findByText("Calibrando")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(
      screen.getByText("Continue registrando seus treinos para construirmos sua linha de evolução."),
    ).toBeInTheDocument();
    // Em onboarding não há o que explicar: nada de breakdown vazio.
    expect(screen.queryByRole("button", { name: /o que compõe/i })).not.toBeInTheDocument();
  });

  it("estado de carregamento é anunciado", () => {
    mockedOverview.mockReturnValue(new Promise(() => {}) as never);
    const { container } = render(<ProgressScoreSection />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText(/Carregando sua leitura/)).toBeInTheDocument();
  });

  it("falha de rede não vira alerta — a seção some e a aba segue útil", async () => {
    mockedOverview.mockResolvedValue(null);
    const { container } = render(<ProgressScoreSection />);
    await waitFor(() => expect(container.textContent).toBe(""));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem Premium, o servidor manda gated e a UI convida — sem inventar número", async () => {
    mockedOverview.mockResolvedValue(
      overview({ gated: true, score: null, load: null, headline: "" }),
    );
    render(<ProgressScoreSection />);

    expect(await screen.findByText(/Disponível no Premium/i)).toBeInTheDocument();
    expect(screen.queryByText("78")).not.toBeInTheDocument();
  });

  it("o ritmo de carga aparece como faixa, nunca como razão crua", async () => {
    mockedOverview.mockResolvedValue(overview());
    render(<ProgressScoreSection />);

    expect(await screen.findByText(/dentro do seu ritmo habitual/i)).toBeInTheDocument();
    expect(screen.queryByText(/1[.,]\d/)).not.toBeInTheDocument();
  });

  it("o histórico só vira linha com pelo menos dois pontos", async () => {
    mockedOverview.mockResolvedValue(overview());
    mockedHistory.mockResolvedValue({
      gated: false,
      points: [{ date: "2026-08-11", score: 70 }],
    } as never);
    const { container } = render(<ProgressScoreSection />);

    await userEvent.click(await screen.findByRole("button", { name: /o que compõe/i }));
    await waitFor(() => expect(getScoreHistory).toHaveBeenCalled());
    expect(container.querySelector(".recharts-wrapper")).toBeNull();
  });

  it("com dois pontos ou mais, o gráfico entra", async () => {
    mockedOverview.mockResolvedValue(overview());
    mockedHistory.mockResolvedValue({
      gated: false,
      points: [
        { date: "2026-08-10", score: 62 },
        { date: "2026-08-11", score: 70 },
        { date: "2026-08-12", score: 78 },
      ],
    } as never);
    const { container } = render(<ProgressScoreSection />);

    await userEvent.click(await screen.findByRole("button", { name: /o que compõe/i }));
    await waitFor(() => expect(container.querySelector(".recharts-wrapper")).not.toBeNull());
  });

  it("analytics mede adoção sem carregar o dado do aluno", async () => {
    mockedOverview.mockResolvedValue(overview());
    render(<ProgressScoreSection />);
    await screen.findByText("78");

    const call = vi
      .mocked(postPerformanceEvent)
      .mock.calls.find(([name]) => name === "performance.score_viewed");
    expect(call).toBeDefined();
    expect(JSON.stringify(call![1])).not.toContain("78");
  });
});
