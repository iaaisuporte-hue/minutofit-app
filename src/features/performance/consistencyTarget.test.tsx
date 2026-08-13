/**
 * A copy da consistência precisa dizer a verdade sobre o denominador
 * (hardening pré-C2).
 *
 * O alvo passou a poder vir de duas fontes: a ficha do personal ou a meta que o
 * próprio aluno declarou. Chamar as duas de "sua ficha" mentiria para todo
 * aluno B2C — que é justamente quem nunca teve ficha e por isso nunca via
 * consistência nenhuma.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getPerformanceOverview = vi.fn();
const getTrainingCalendar = vi.fn();

vi.mock("./performanceApi", () => ({
  getPerformanceOverview: (...a: unknown[]) => getPerformanceOverview(...a),
  getTrainingCalendar: (...a: unknown[]) => getTrainingCalendar(...a),
}));

import { ConsistencyTab } from "./ConsistencyTab";

function overview(consistency: Record<string, unknown>) {
  return {
    gated: false,
    freeSummary: { sessions30d: 6, activeDays28: 6, currentStreak: 2 },
    consistency,
    score: null,
    load: null,
    headline: "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTrainingCalendar.mockResolvedValue([]);
});

describe("Consistência · de onde vem o alvo", () => {
  it("com meta própria, não diz 'sua ficha'", async () => {
    getPerformanceOverview.mockResolvedValue(
      overview({ pct: 50, activeDays28: 6, targetPerWeek: 3, targetSource: "goal" }),
    );
    render(<ConsistencyTab />);

    await waitFor(() => expect(screen.getByText(/Sua meta é de/i)).toBeTruthy());
    expect(screen.queryByText(/Sua ficha prescreve/i)).toBeNull();
  });

  it("com ficha do personal, mantém a copy de prescrição", async () => {
    getPerformanceOverview.mockResolvedValue(
      overview({ pct: 50, activeDays28: 8, targetPerWeek: 4, targetSource: "plan" }),
    );
    render(<ConsistencyTab />);

    await waitFor(() => expect(screen.getByText(/Sua ficha prescreve/i)).toBeTruthy());
    expect(screen.queryByText(/Sua meta é de/i)).toBeNull();
  });

  it("sem alvo nenhum, mostra o caminho — nunca um número inventado", async () => {
    getPerformanceOverview.mockResolvedValue(
      overview({ pct: null, activeDays28: 5, targetPerWeek: null, targetSource: null }),
    );
    render(<ConsistencyTab />);

    await waitFor(() =>
      expect(screen.getByText(/Defina uma meta de frequência semanal/i)).toBeTruthy(),
    );
    // 3x e 4x por semana são os chutes mais tentadores do mercado. Nenhum aparece.
    expect(screen.queryByText(/3 treinos por semana/i)).toBeNull();
    expect(screen.queryByText(/4 treinos por semana/i)).toBeNull();
  });
});
