/**
 * Progressão e Recordes — contratos de UI da Onda P2 (Spec 033).
 *
 * O que estes testes protegem, além da renderização: que a tela distinga
 * FALHA de VAZIO, que o recorde de exercício removido continue visível, e que
 * o convite ao Premium apareça quando o servidor diz `gated` — nunca por
 * decisão do cliente.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./performanceApi", () => ({
  getProgression: vi.fn(),
  getPrRecords: vi.fn(),
}));
vi.mock("./performanceEvents", () => ({ postPerformanceEvent: vi.fn() }));
vi.mock("../../lib/platform", () => ({ isNativeApp: () => false }));

// recharts precisa de largura real; o jsdom devolve 0 e o gráfico não pinta.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 220 }}>{children}</div>
    ),
  };
});

import { ProgressionPanel } from "./ProgressionPanel";
import { RecordsPanel } from "./RecordsPanel";
import { getPrRecords, getProgression } from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";

const mockedProgression = vi.mocked(getProgression);
const mockedPrs = vi.mocked(getPrRecords);

const pr = (over: Partial<Parameters<typeof Object>[0]> = {}) => ({
  exerciseId: "11111111-1111-4111-8111-111111111111",
  exerciseName: "Supino",
  kind: "max_load" as const,
  value: 80,
  reps: 5,
  loadKg: 80,
  previousValue: 70,
  isFirst: false,
  achievedAt: "2026-08-01T12:00:00.000Z",
  sessionId: 1,
  exerciseInCatalog: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Progressão", () => {
  it("mostra estado de carregamento antes da resposta", () => {
    mockedProgression.mockReturnValue(new Promise(() => {}));
    render(<ProgressionPanel />);
    expect(screen.getByText(/Carregando sua evolução/i)).toBeTruthy();
  });

  it("distingue FALHA de vazio: erro pede nova tentativa", async () => {
    mockedProgression.mockResolvedValue(null);
    render(<ProgressionPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toMatch(/não foi possível/i);
  });

  it("vazio explica o que fazer, sem parecer erro", async () => {
    mockedProgression.mockResolvedValue({ gated: false, windowDays: 90, exercises: [] });
    render(<ProgressionPanel />);
    await waitFor(() => expect(screen.getByText(/pelo menos dois\s+dias/i)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gated mostra o convite ao Premium", async () => {
    mockedProgression.mockResolvedValue({ gated: true, windowDays: 90, exercises: [] });
    render(<ProgressionPanel />);
    await waitFor(() => expect(screen.getByText(/Disponível no Premium/i)).toBeTruthy());
  });

  it("com dados, desenha o gráfico e o seletor de exercício", async () => {
    mockedProgression.mockResolvedValue({
      gated: false,
      windowDays: 90,
      exercises: [
        {
          exerciseId: "a", name: "Supino", pointCount: 2, deltaKg: 10,
          firstLoadKg: 60, lastLoadKg: 70, firstE1rm: 80, lastE1rm: 93.5, e1rmDeltaKg: 13.5,
          points: [
            { date: "2026-07-01", maxLoadKg: 60, bestE1rm: 80, tonnageKg: 600, topSetReps: 10 },
            { date: "2026-07-08", maxLoadKg: 70, bestE1rm: 93.5, tonnageKg: 700, topSetReps: 10 },
          ],
        },
      ],
    });
    render(<ProgressionPanel />);
    await waitFor(() => expect(screen.getByLabelText(/Exercício/i)).toBeTruthy());
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByText(/2 dias com registro/i)).toBeTruthy();
    // a unidade tem que estar visível — gráfico sem unidade não informa
    expect(screen.getByRole("group", { name: /Métrica exibida/i })).toBeTruthy();
  });

  it("avisa quando há um único ponto — foto, não curva", async () => {
    mockedProgression.mockResolvedValue({
      gated: false, windowDays: 90,
      exercises: [{
        exerciseId: "a", name: "Agacho", pointCount: 1, deltaKg: 0,
        firstLoadKg: 60, lastLoadKg: 60, firstE1rm: null, lastE1rm: null, e1rmDeltaKg: null,
        points: [{ date: "2026-07-01", maxLoadKg: 60, bestE1rm: null, tonnageKg: 600, topSetReps: 10 }],
      }],
    });
    render(<ProgressionPanel />);
    await waitFor(() => expect(screen.getByText(/ainda é uma foto, não uma curva/i)).toBeTruthy());
  });

  it("trocar de exercício emite o evento de seleção", async () => {
    const user = userEvent.setup();
    mockedProgression.mockResolvedValue({
      gated: false, windowDays: 90,
      exercises: [
        { exerciseId: "a", name: "Supino", pointCount: 1, deltaKg: 0, firstLoadKg: 60, lastLoadKg: 60, firstE1rm: null, lastE1rm: null, e1rmDeltaKg: null, points: [{ date: "2026-07-01", maxLoadKg: 60, bestE1rm: null, tonnageKg: null, topSetReps: null }] },
        { exerciseId: "b", name: "Agacho", pointCount: 1, deltaKg: 0, firstLoadKg: 90, lastLoadKg: 90, firstE1rm: null, lastE1rm: null, e1rmDeltaKg: null, points: [{ date: "2026-07-01", maxLoadKg: 90, bestE1rm: null, tonnageKg: null, topSetReps: null }] },
      ],
    });
    render(<ProgressionPanel />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
    await user.selectOptions(screen.getByRole("combobox"), "b");
    expect(postPerformanceEvent).toHaveBeenCalledWith("performance.exercise_selected", { exerciseId: "b" });
  });

  it("emite o evento de visualização com a contagem", async () => {
    mockedProgression.mockResolvedValue({ gated: false, windowDays: 90, exercises: [] });
    render(<ProgressionPanel />);
    await waitFor(() =>
      expect(postPerformanceEvent).toHaveBeenCalledWith(
        "performance.progression_viewed",
        expect.objectContaining({ exerciseCount: 0, gated: false }),
      ),
    );
  });
});

describe("Recordes", () => {
  it("carrega, depois lista os recordes agrupados por exercício", async () => {
    mockedPrs.mockResolvedValue({
      gated: false,
      records: [pr(), pr({ kind: "best_e1rm", value: 93.5 })],
      events: [pr()],
    });
    const { container } = render(<RecordsPanel />);
    // O nome aparece no card E na linha do tempo — busca no card para não
    // depender de qual vem primeiro.
    await waitFor(() =>
      expect(container.querySelector(".perf-record-name")?.textContent).toBe("Supino"));
    // as duas categorias do mesmo exercício ficam no MESMO card
    const card = container.querySelector(".perf-record-card")!;
    expect(container.querySelectorAll(".perf-record-card")).toHaveLength(1);
    const rotulos = Array.from(card.querySelectorAll("dt")).map((el) => el.textContent);
    expect(rotulos).toEqual(["Maior carga", "1RM estimado"]);
  });

  it("erro é distinto de vazio", async () => {
    mockedPrs.mockResolvedValue(null);
    render(<RecordsPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });

  it("vazio convida a registrar, sem parecer falha", async () => {
    mockedPrs.mockResolvedValue({ gated: false, records: [], events: [] });
    render(<RecordsPanel />);
    await waitFor(() => expect(screen.getByText(/aparecem aqui assim que/i)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gated mostra o convite ao Premium", async () => {
    mockedPrs.mockResolvedValue({ gated: true, records: [], events: [] });
    render(<RecordsPanel />);
    await waitFor(() => expect(screen.getByText(/Disponível no Premium/i)).toBeTruthy());
  });

  it("recorde de exercício REMOVIDO continua visível e sinalizado", async () => {
    mockedPrs.mockResolvedValue({
      gated: false,
      records: [pr({ exerciseId: null, exerciseName: "Exercício Removido", exerciseInCatalog: false })],
      events: [],
    });
    render(<RecordsPanel />);
    await waitFor(() => expect(screen.getByText("Exercício Removido")).toBeTruthy());
    expect(screen.getByText(/fora do catálogo/i)).toBeTruthy();
    expect(screen.getByText(/80/)).toBeTruthy();
  });

  it("dois exercícios removidos não colapsam num bloco só", async () => {
    mockedPrs.mockResolvedValue({
      gated: false,
      records: [
        pr({ exerciseId: null, exerciseName: "Removido A", exerciseInCatalog: false }),
        pr({ exerciseId: null, exerciseName: "Removido B", exerciseInCatalog: false }),
      ],
      events: [],
    });
    render(<RecordsPanel />);
    await waitFor(() => expect(screen.getByText("Removido A")).toBeTruthy());
    expect(screen.getByText("Removido B")).toBeTruthy();
  });

  it("a linha do tempo mostra só superações, nunca estreias", async () => {
    mockedPrs.mockResolvedValue({
      gated: false,
      records: [pr()],
      events: [
        pr({ exerciseName: "Superado", isFirst: false }),
        pr({ exerciseName: "Estreia Qualquer", isFirst: true, previousValue: null }),
      ],
    });
    render(<RecordsPanel />);
    await waitFor(() => expect(screen.getByText(/Quando você superou/i)).toBeTruthy());
    expect(screen.getByText("Superado")).toBeTruthy();
    expect(screen.queryByText("Estreia Qualquer")).toBeNull();
  });
});
