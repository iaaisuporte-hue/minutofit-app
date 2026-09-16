/**
 * PLAN_NUTRITION_QUICK_MACROS (P1B, adendo "Seu dia nutricional") — contratos
 * do §21: sem meta nunca inventa percentual, fibra parcial nunca aparece como
 * dado definitivo, selo "Meta do seu plano" vs "Estimativa diária" nunca se
 * confunde, e um refreshToken novo refaz a busca (atualização sem F5).
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NutritionDaySummary } from "./NutritionDaySummary";

const getDayIntake = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getDayIntake: (...args: unknown[]) => getDayIntake(...args),
  };
});

const BASE_LOG = {
  id: 1, dateKey: "2026-09-17", loggedAt: "2026-09-17T12:00:00Z", mealId: null,
  label: "Almoço", rawText: null, energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15,
  fiberG: 5, fiberPartial: false, items: [], confidenceScore: 1, source: "manual", isFavorite: false,
};

beforeEach(() => {
  getDayIntake.mockReset();
});

describe("NutritionDaySummary", () => {
  it("sem meta: mostra só valores absolutos, nunca percentual/barra inventados", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 3, coverageRatio: 0.33, confidence: 1, level: "low" },
      target: null,
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("500 kcal")).toBeInTheDocument();
    expect(screen.getByText("Registrado hoje")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText("Meta do seu plano")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimativa diária")).not.toBeInTheDocument();
  });

  it("meta do plano: selo 'Meta do seu plano', percentual real, gráfico com refeições do plano", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 3, coverageRatio: 0.33, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [
        { mealId: 1, name: "Café da manhã", orderIndex: 0, energyKcal: 400 },
        { mealId: 2, name: "Almoço", orderIndex: 1, energyKcal: 600 },
      ],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("Meta do seu plano")).toBeInTheDocument();
    expect(screen.getByText("500 / 2000 kcal")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    // Distribuição orientativa NUNCA aparece quando existe plano estruturado real.
    expect(screen.queryByText(/Distribuição orientativa/)).not.toBeInTheDocument();
  });

  it("estimativa própria: selo 'Estimativa diária', kcal com ≈, gráfico rotulado como orientativo", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "self_estimate" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("Estimativa diária")).toBeInTheDocument();
    expect(screen.getByText(/≈ 500 \/ 2000 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/Distribuição orientativa/)).toBeInTheDocument();
  });

  it("fibra parcial: mostra o valor com aviso 'dados parciais', nunca como dado definitivo", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 8, fiberPartial: true },
      coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText(/dados parciais/)).toBeInTheDocument();
  });

  it("sem fibra conhecida em nenhum item: indicador de fibra não aparece", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    await screen.findByText("Meta do seu plano");
    expect(screen.queryByText("Fibra")).not.toBeInTheDocument();
  });

  it("zero registros com meta: mostra estado leve no lugar do gráfico, sem quebrar", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 0, expectedMeals: 4, coverageRatio: 0, confidence: 0, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("Nenhuma refeição registrada ainda.")).toBeInTheDocument();
    expect(screen.getByText("0 / 2000 kcal")).toBeInTheDocument();
  });

  it("mudar refreshToken refaz a busca (atualização sem F5)", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 0, expectedMeals: 3, coverageRatio: 0, confidence: 0, level: "low" },
      target: null,
      plannedMeals: [],
    });
    const { rerender } = render(<NutritionDaySummary refreshToken={0} />);
    await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(1));

    rerender(<NutritionDaySummary refreshToken={1} />);
    await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(2));
  });

  it("erro na busca mostra estado compacto com retry", async () => {
    getDayIntake.mockRejectedValue(new Error("network"));
    render(<NutritionDaySummary />);
    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
