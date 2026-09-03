/**
 * Aderência por exercício + Padrões de execução (Sprint P2B).
 *
 * Cobre: os 4 buckets renderizam com `addedCount` separado (D4 — nunca soma
 * ao total); empty state; card com selo de aprovação; "Ignorar" some da tela
 * sem chamar `action:'apply'` (fire-and-forget de `action:'dismiss'`).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdherenceSummary,
  ExerciseInsight,
  ExerciseInsightsSummary,
} from "../../../services/personalInsightsApi";

const getStudentAdherence = vi.fn();
const getExerciseInsights = vi.fn();
const reviewExerciseInsight = vi.fn();

vi.mock("../../../services/personalInsightsApi", async () => {
  const actual = await vi.importActual<typeof import("../../../services/personalInsightsApi")>(
    "../../../services/personalInsightsApi",
  );
  return {
    ...actual,
    getStudentAdherence: (...args: unknown[]) => getStudentAdherence(...args),
    getExerciseInsights: (...args: unknown[]) => getExerciseInsights(...args),
    reviewExerciseInsight: (...args: unknown[]) => reviewExerciseInsight(...args),
  };
});

const trackPersonalInsightsEvent = vi.fn();
vi.mock("./personalInsightsEvents", () => ({
  trackPersonalInsightsEvent: (...args: unknown[]) => trackPersonalInsightsEvent(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

import { CockpitAdherenceInsights } from "./CockpitAdherenceInsights";

function adherence(over: Partial<AdherenceSummary> = {}): AdherenceSummary {
  return {
    windowDays: 30,
    sessionsConsidered: 12,
    denominator: 34,
    buckets: {
      EXECUTADO_CONFORME_PRESCRITO: { count: 20, pct: 59 },
      SUBSTITUIDO: { count: 8, pct: 24 },
      PARCIAL: { count: 4, pct: 12 },
      NAO_EXECUTADO: { count: 2, pct: 5 },
    },
    addedCount: 3,
    items: [],
    added: [],
    ...over,
  };
}

function insight(over: Partial<ExerciseInsight> = {}): ExerciseInsight {
  return {
    type: "RECURRING_REPLACEMENT",
    originalExerciseId: "ex-original",
    originalExerciseName: "Supino Reto",
    windowSize: 5,
    occurrenceCount: 3,
    mostRecentAt: "2026-08-30T12:00:00.000Z",
    alternatives: [
      { exerciseId: "ex-alt", exerciseName: "Supino Halteres", count: 3, approvedByPersonal: true },
    ],
    predominantReason: { text: "Equipamento ocupado", count: 3 },
    auditSessionIds: [101, 98, 95],
    ...over,
  };
}

function insightsSummary(insights: ExerciseInsight[]): ExerciseInsightsSummary {
  return { recurrenceWindowDays: 180, sessionsConsidered: 40, insights };
}

beforeEach(() => vi.clearAllMocks());

describe("Aderência por exercício", () => {
  it("renderiza os 4 buckets com contagem e percentual, e o total de extras à parte", async () => {
    getStudentAdherence.mockResolvedValue(adherence());
    getExerciseInsights.mockResolvedValue(insightsSummary([]));

    render(<CockpitAdherenceInsights studentId="42" />);

    expect(await screen.findByText("Conforme prescrição")).toBeInTheDocument();
    expect(screen.getByText("20 · 59%")).toBeInTheDocument();
    expect(screen.getByText("Adaptado")).toBeInTheDocument();
    expect(screen.getByText("8 · 24%")).toBeInTheDocument();
    expect(screen.getByText("Parcial")).toBeInTheDocument();
    expect(screen.getByText("4 · 12%")).toBeInTheDocument();
    expect(screen.getByText("Não executado")).toBeInTheDocument();
    expect(screen.getByText("2 · 5%")).toBeInTheDocument();

    // D4 do harness: extras nunca somam ao denominador dos 4 buckets.
    expect(screen.getByText(/\+ 3 exercícios adicionados/)).toBeInTheDocument();
  });

  it("mostra o vazio sem inventar dado quando não há sessões na janela", async () => {
    getStudentAdherence.mockResolvedValue(adherence({ denominator: 0, sessionsConsidered: 0 }));
    getExerciseInsights.mockResolvedValue(insightsSummary([]));

    render(<CockpitAdherenceInsights studentId="42" />);

    expect(await screen.findByText(/Ainda não há padrões relevantes de execução/)).toBeInTheDocument();
  });
});

describe("Padrões de execução (insights)", () => {
  it("vazio quando não há substituição recorrente nem desconforto", async () => {
    getStudentAdherence.mockResolvedValue(adherence());
    getExerciseInsights.mockResolvedValue(insightsSummary([]));

    render(<CockpitAdherenceInsights studentId="42" />);

    expect(
      await screen.findByText(/Ainda não há padrões relevantes de substituição ou desconforto/),
    ).toBeInTheDocument();
  });

  it("mostra o selo de alternativa já aprovada pelo personal", async () => {
    getStudentAdherence.mockResolvedValue(adherence());
    getExerciseInsights.mockResolvedValue(insightsSummary([insight()]));

    render(<CockpitAdherenceInsights studentId="42" />);

    expect(await screen.findByText("Supino Reto")).toBeInTheDocument();
    expect(screen.getByText(/Alternativa já aprovada por você/)).toBeInTheDocument();
  });

  it("'Ignorar' remove o card na hora e chama dismiss, nunca apply", async () => {
    getStudentAdherence.mockResolvedValue(adherence());
    getExerciseInsights.mockResolvedValue(insightsSummary([insight()]));
    reviewExerciseInsight.mockResolvedValue({ applied: false, dismissed: true });

    const user = userEvent.setup();
    render(<CockpitAdherenceInsights studentId="42" />);

    await screen.findByText("Supino Reto");
    await user.click(screen.getByRole("button", { name: "Ignorar" }));

    expect(screen.queryByText("Supino Reto")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(reviewExerciseInsight).toHaveBeenCalledWith("42", "ex-original", { action: "dismiss" }),
    );
    expect(trackPersonalInsightsEvent).toHaveBeenCalledWith(
      "personal_plan_review_cancelled",
      expect.objectContaining({ source: "dismiss" }),
    );
  });

  it("dá destaque visual diferenciado ao desconforto, sem virar diagnóstico", async () => {
    getStudentAdherence.mockResolvedValue(adherence());
    getExerciseInsights.mockResolvedValue(
      insightsSummary([
        insight({
          type: "DISCOMFORT_PATTERN",
          originalExerciseName: "Agachamento",
          occurrenceCount: 2,
          windowSize: 5,
        }),
      ]),
    );

    render(<CockpitAdherenceInsights studentId="42" />);

    expect(await screen.findByText(/Desconforto foi informado em 2 das últimas 5/)).toBeInTheDocument();
    expect(screen.queryByText(/diagnóstico/i)).not.toBeInTheDocument();
    const card = screen.getByText("Agachamento").closest("article");
    expect(card?.className).toContain("is-discomfort");
  });
});
