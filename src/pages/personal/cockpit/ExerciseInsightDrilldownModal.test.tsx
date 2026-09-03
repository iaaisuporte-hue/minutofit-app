/**
 * Drill-down de um exercício (Sprint P2B) — as <= 5 ocorrências usadas no
 * cálculo, para o Personal auditar "por que este insight apareceu".
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseInsightDetail } from "../../../services/personalInsightsApi";

const getExerciseInsightDrillDown = vi.fn();
vi.mock("../../../services/personalInsightsApi", async () => {
  const actual = await vi.importActual<typeof import("../../../services/personalInsightsApi")>(
    "../../../services/personalInsightsApi",
  );
  return {
    ...actual,
    getExerciseInsightDrillDown: (...args: unknown[]) => getExerciseInsightDrillDown(...args),
  };
});

import { ExerciseInsightDrilldownModal } from "./ExerciseInsightDrilldownModal";

function detail(over: Partial<ExerciseInsightDetail> = {}): ExerciseInsightDetail {
  return {
    originalExerciseId: "ex-original",
    originalExerciseName: "Supino Reto",
    windowSize: 2,
    occurrences: [
      {
        sessionId: 101,
        performedAt: "2026-08-30T12:00:00.000Z",
        exerciseId: "ex-original",
        exerciseName: "Supino Reto",
        category: "SUBSTITUIDO",
        prescribedSets: 3,
        doneSets: 3,
        substitutedToExerciseId: "ex-alt",
        substitutedToExerciseName: "Supino Halteres",
        substitutionReason: "Equipamento ocupado",
      },
      {
        sessionId: 95,
        performedAt: "2026-08-23T12:00:00.000Z",
        exerciseId: "ex-original",
        exerciseName: "Supino Reto",
        category: "EXECUTADO_CONFORME_PRESCRITO",
        prescribedSets: 3,
        doneSets: 3,
        substitutedToExerciseId: null,
        substitutedToExerciseName: null,
        substitutionReason: null,
      },
    ],
    recurringReplacement: null,
    discomfortPattern: null,
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("ExerciseInsightDrilldownModal", () => {
  it("lista as ocorrências com categoria e motivo", async () => {
    getExerciseInsightDrillDown.mockResolvedValue(detail());
    render(
      <ExerciseInsightDrilldownModal
        studentId="42"
        exerciseId="ex-original"
        exerciseName="Supino Reto"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Adaptado")).toBeInTheDocument();
    expect(screen.getByText(/trocado por Supino Halteres/)).toBeInTheDocument();
    expect(screen.getByText(/motivo: Equipamento ocupado/)).toBeInTheDocument();
    expect(screen.getByText("Conforme prescrição")).toBeInTheDocument();
  });

  it("degrada com mensagem clara quando a busca falha", async () => {
    getExerciseInsightDrillDown.mockRejectedValue(new Error("network"));
    render(
      <ExerciseInsightDrilldownModal
        studentId="42"
        exerciseId="ex-original"
        exerciseName="Supino Reto"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Não foi possível carregar o histórico/)).toBeInTheDocument();
  });
});
