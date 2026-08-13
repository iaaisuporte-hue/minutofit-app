/**
 * Aba Performance do cockpit — contratos de UI (Spec 033, Onda P5).
 *
 * O que estes testes protegem: que o personal não consiga ESCREVER nada aqui,
 * que a recusa por consentimento seja dita com as palavras certas (e não como
 * "erro"), que fato e texto gerado continuem visualmente separados, e que o
 * aluno cujo exercício saiu do catálogo continue legível.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../services/personalPerformanceApi", async () => {
  const actual = await vi.importActual<typeof import("../../../services/personalPerformanceApi")>(
    "../../../services/personalPerformanceApi",
  );
  return {
    ...actual,
    fetchStudentPerformance: vi.fn(),
    requestPerformanceInsight: vi.fn(),
  };
});
vi.mock("../../../features/performance/performanceEvents", () => ({
  postPerformanceEvent: vi.fn(),
}));

import { CockpitTabPerformance } from "./CockpitTabPerformance";
import {
  PerformanceAccessError,
  fetchStudentPerformance,
  requestPerformanceInsight,
  type PerformanceSnapshot,
} from "../../../services/personalPerformanceApi";
import { postPerformanceEvent } from "../../../features/performance/performanceEvents";

const mockedFetch = vi.mocked(fetchStudentPerformance);
const mockedInsight = vi.mocked(requestPerformanceInsight);

const snapshot = (over: Record<string, unknown> = {}): PerformanceSnapshot =>
  ({
    generatedAt: "2026-08-13T12:00:00.000Z",
    studentId: 42,
    snapshotHash: "abc123",
    facts: {
      score: 78,
      scoreStatus: "ok",
      scoreTrend: "up",
      scoreFactors: [{ id: "progression.load", label: "Carga subiu", delta: 18 }],
      scoreFormulaVersion: 1,
      consistency: {
        pct: 80,
        activeDays28: 12,
        activeDaysThisWeek: 2,
        activeDaysLastWeek: 4,
        targetPerWeek: 3,
      },
      trainingLoad: { effortLoad7d: 320, band: "within", label: "Dentro do seu ritmo habitual" },
      recentPrs: [
        {
          exerciseName: "Supino reto",
          exerciseId: "11111111-1111-4111-8111-111111111111",
          kind: "max_load",
          value: 100,
          previousValue: 95,
          achievedAt: "2026-08-10T12:00:00.000Z",
        },
      ],
      progressionHighlights: { total: 4, improved: 3, regressed: 0 },
      goals: [
        {
          id: "1",
          kind: "exercise_load",
          status: "active",
          displayLabel: "Supino reto: carga de 100 kg",
          progress: 0.87,
        },
      ],
      streakDays: 5,
      sessions30d: 12,
      ...(over.facts as object),
    },
    signals: [
      {
        type: "CONSISTENCY_DOWN",
        severity: "attention",
        title: "Frequência caiu",
        description: "De 4 para 2 dias de treino de uma semana para a outra.",
        period: "semana",
        evidence: { current: 2, previous: 4, period: "week" },
      },
    ],
    ...over,
  }) as never;

beforeEach(() => vi.clearAllMocks());

describe("estados", () => {
  it("anuncia o carregamento", () => {
    mockedFetch.mockReturnValue(new Promise(() => {}) as never);
    const { container } = render(<CockpitTabPerformance studentId="42" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("consentimento revogado é explicado, não tratado como erro genérico", async () => {
    mockedFetch.mockRejectedValue(new PerformanceAccessError("consent_required", "consent_required"));
    render(<CockpitTabPerformance studentId="42" />);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/não compartilha os dados de treino/i);
    // Diz ONDE o aluno resolve — o personal não fica sem saber o que fazer.
    expect(alerta).toHaveTextContent(/Minha equipe/i);
  });

  it("aluno fora da carteira recebe mensagem própria", async () => {
    mockedFetch.mockRejectedValue(new PerformanceAccessError("ASSIGNMENT_REQUIRED", "x"));
    render(<CockpitTabPerformance studentId="42" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/não está na sua carteira/i);
  });

  it("falha desconhecida não vira tela em branco", async () => {
    mockedFetch.mockRejectedValue(new Error("boom"));
    render(<CockpitTabPerformance studentId="42" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível carregar/i);
  });

  it("aluno sem histórico recebe explicação, não zeros falsos", async () => {
    mockedFetch.mockResolvedValue(
      snapshot({
        facts: {
          score: null,
          scoreStatus: "onboarding",
          scoreTrend: null,
          scoreFactors: [],
          scoreFormulaVersion: null,
          consistency: { pct: null, activeDays28: 0, activeDaysThisWeek: 0, activeDaysLastWeek: 0, targetPerWeek: null },
          trainingLoad: { effortLoad7d: null, band: null, label: null },
          recentPrs: [],
          progressionHighlights: { total: 0, improved: 0, regressed: 0 },
          goals: [],
          streakDays: null,
          sessions30d: 0,
        },
        signals: [],
      }),
    );
    render(<CockpitTabPerformance studentId="42" />);

    expect(await screen.findByText(/Ainda sem histórico de treino/i)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});

describe("conteúdo", () => {
  beforeEach(() => mockedFetch.mockResolvedValue(snapshot()));

  it("mostra o estado geral com score, frequência e carga", async () => {
    render(<CockpitTabPerformance studentId="42" />);

    expect(await screen.findByText("78")).toBeInTheDocument();
    expect(screen.getByText(/em alta/)).toBeInTheDocument();
    expect(screen.getByText(/12 dias/)).toBeInTheDocument();
    expect(screen.getByText(/Dentro do seu ritmo habitual/)).toBeInTheDocument();
    expect(screen.getByText(/3 de 4 exercícios melhoraram/)).toBeInTheDocument();
  });

  it("preserva a versão da fórmula — histórico não se reinterpreta em silêncio", async () => {
    render(<CockpitTabPerformance studentId="42" />);
    expect(await screen.findByText(/fórmula v1/)).toBeInTheDocument();
  });

  it("cada sinal abre a evidência que o sustenta", async () => {
    render(<CockpitTabPerformance studentId="42" />);

    expect(await screen.findByText("Frequência caiu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver evidência" }));

    expect(screen.getByText("previous")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(postPerformanceEvent).toHaveBeenCalledWith(
      "personal.performance_insight_opened",
      expect.objectContaining({ type: "CONSISTENCY_DOWN" }),
    );
  });

  it("severidade é legível sem cor", async () => {
    render(<CockpitTabPerformance studentId="42" />);
    expect(await screen.findByText("Atenção")).toBeInTheDocument();
  });

  it("metas aparecem read-only: nenhum controle de escrita", async () => {
    render(<CockpitTabPerformance studentId="42" />);

    expect(await screen.findByText("Supino reto: carga de 100 kg")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText(/Quem define as metas é o aluno/)).toBeInTheDocument();

    for (const nome of [/abandonar/i, /criar meta/i, /editar/i, /excluir/i]) {
      expect(screen.queryByRole("button", { name: nome })).not.toBeInTheDocument();
    }
  });

  it("usa o rótulo canônico da meta vindo do backend", async () => {
    // Se a tela remontasse o texto, o personal leria uma frase diferente da que
    // o aluno vê no app dele.
    render(<CockpitTabPerformance studentId="42" />);
    expect(await screen.findByText("Supino reto: carga de 100 kg")).toBeInTheDocument();
  });

  it("mostra recordes com valor anterior e data", async () => {
    render(<CockpitTabPerformance studentId="42" />);
    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(screen.getByText(/carga máxima · 100 \(antes 95\)/)).toBeInTheDocument();
  });
});

describe("exercício removido do catálogo", () => {
  it("recorde órfão continua legível pelo nome histórico", async () => {
    mockedFetch.mockResolvedValue(
      snapshot({
        facts: {
          ...(snapshot().facts as object),
          recentPrs: [
            {
              exerciseName: "Remada que saiu do catálogo",
              exerciseId: null,
              kind: "max_load",
              value: 60,
              previousValue: null,
              achievedAt: "2026-08-09T12:00:00.000Z",
            },
          ],
          goals: [
            {
              id: "9",
              kind: "exercise_load",
              status: "active",
              displayLabel: "Remada que saiu do catálogo: carga de 80 kg",
              progress: 0.5,
            },
          ],
        },
      }),
    );
    render(<CockpitTabPerformance studentId="42" />);

    expect(await screen.findByText("Remada que saiu do catálogo")).toBeInTheDocument();
    expect(screen.getByText("Remada que saiu do catálogo: carga de 80 kg")).toBeInTheDocument();
  });
});

describe("síntese em texto", () => {
  beforeEach(() => mockedFetch.mockResolvedValue(snapshot()));

  it("não é pedida sozinha: a tela carrega inteira sem IA", async () => {
    render(<CockpitTabPerformance studentId="42" />);
    await screen.findByText("78");
    expect(mockedInsight).not.toHaveBeenCalled();
  });

  it("quando pedida, o texto aparece separado dos números", async () => {
    mockedInsight.mockResolvedValue({
      summary: "O aluno treinou menos esta semana.",
      highlights: ["3 de 4 exercícios melhoraram"],
      attentionPoints: [],
      disclaimer: "Não substitui sua avaliação profissional.",
      source: "ai",
    });
    render(<CockpitTabPerformance studentId="42" />);

    await userEvent.click(await screen.findByRole("button", { name: /Resumir em texto/i }));

    expect(await screen.findByText("O aluno treinou menos esta semana.")).toBeInTheDocument();
    expect(screen.getByText(/Não substitui sua avaliação profissional/)).toBeInTheDocument();
  });

  it("texto determinístico se anuncia como tal", async () => {
    mockedInsight.mockResolvedValue({
      summary: "Progress Score em 78.",
      highlights: [],
      attentionPoints: [],
      disclaimer: "x",
      source: "deterministic",
    });
    render(<CockpitTabPerformance studentId="42" />);

    await userEvent.click(await screen.findByRole("button", { name: /Resumir em texto/i }));
    expect(await screen.findByText(/sem IA/i)).toBeInTheDocument();
  });

  it("plano sem IA explica em vez de mostrar erro", async () => {
    mockedInsight.mockRejectedValue(new PerformanceAccessError("AI_NOT_ENABLED", "x"));
    render(<CockpitTabPerformance studentId="42" />);

    await userEvent.click(await screen.findByRole("button", { name: /Resumir em texto/i }));
    expect(await screen.findByText(/faz parte do plano Pro/i)).toBeInTheDocument();
  });

  it("falha da síntese não derruba os números da tela", async () => {
    mockedInsight.mockRejectedValue(new Error("timeout"));
    render(<CockpitTabPerformance studentId="42" />);

    await userEvent.click(await screen.findByRole("button", { name: /Resumir em texto/i }));
    await waitFor(() => expect(mockedInsight).toHaveBeenCalled());
    expect(screen.getByText("78")).toBeInTheDocument();
  });
});
