/**
 * PLAN_NUTRITION_QUICK_MACROS (P1A) — "Meta do plano" e "Estimativa própria"
 * precisam ser visualmente e textualmente distintas: o teste trava as duas
 * variantes para que uma regressão futura não as faça convergir.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NutritionTargetCard from "./NutritionTargetCard";

const getMyNutritionTarget = vi.fn();
const estimateNutritionTarget = vi.fn();
const saveMyNutritionTarget = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getMyNutritionTarget: (...args: unknown[]) => getMyNutritionTarget(...args),
    estimateNutritionTarget: (...args: unknown[]) => estimateNutritionTarget(...args),
    saveMyNutritionTarget: (...args: unknown[]) => saveMyNutritionTarget(...args),
  };
});

const PREVIEW = {
  energyKcal: 2100, proteinG: 150, carbohydrateG: 210, fatG: 70,
  mealsPerDay: 4, formulaVersion: 1, meals: [], weightKgUsed: 70,
};

beforeEach(() => {
  getMyNutritionTarget.mockReset();
  estimateNutritionTarget.mockReset().mockResolvedValue(PREVIEW);
  saveMyNutritionTarget.mockReset().mockResolvedValue({
    target: { energyKcal: 2100, proteinG: 150, carbohydrateG: 210, fatG: 70, mealsPerDay: 4, source: "self_estimate" },
  });
});

describe("NutritionTargetCard", () => {
  it("meta do plano: mostra badge de plano, nome do nutri, sem calculadora aberta", async () => {
    getMyNutritionTarget.mockResolvedValue({
      target: { energyKcal: 1800, proteinG: 140, carbohydrateG: 180, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      selfEstimateInputs: null,
      nutriName: "Dra. Ana",
    });

    render(<NutritionTargetCard />);

    expect(await screen.findByText("Meta do plano")).toBeInTheDocument();
    expect(screen.getByText(/Dra\. Ana/)).toBeInTheDocument();
    expect(screen.getByText(/1800/)).toBeInTheDocument();
    // Calculadora começa recolhida quando a meta é do plano.
    expect(screen.queryByRole("toolbar", { name: "Objetivo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver estimativa própria/ })).toBeInTheDocument();
  });

  it("estimativa própria: mostra badge neutro, calculadora aberta e valores com ≈", async () => {
    getMyNutritionTarget.mockResolvedValue({
      target: null,
      selfEstimateInputs: null,
      nutriName: null,
    });

    render(<NutritionTargetCard />);

    expect(await screen.findByText("Estimativa própria")).toBeInTheDocument();
    expect(screen.getByText(/orientativa/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/≈ Calorias/)).toBeInTheDocument());
    expect(screen.getByRole("toolbar", { name: "Objetivo" })).toBeInTheDocument();
  });

  it("clicar em 'Ver estimativa própria' abre a calculadora sem esconder o card do plano", async () => {
    getMyNutritionTarget.mockResolvedValue({
      target: { energyKcal: 1800, proteinG: 140, carbohydrateG: 180, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      selfEstimateInputs: null,
      nutriName: "Dra. Ana",
    });

    render(<NutritionTargetCard />);
    await screen.findByText("Meta do plano");

    await userEvent.click(screen.getByRole("button", { name: /Ver estimativa própria/ }));

    expect(screen.getByText("Meta do plano")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("toolbar", { name: "Objetivo" })).toBeInTheDocument());
  });

  it("salvar estimativa chama saveMyNutritionTarget e reflete o resultado", async () => {
    getMyNutritionTarget.mockResolvedValue({ target: null, selfEstimateInputs: null, nutriName: null });

    render(<NutritionTargetCard />);
    await screen.findByText("Estimativa própria");
    await waitFor(() => expect(screen.getByRole("button", { name: /Salvar minha estimativa/ })).not.toBeDisabled());

    await userEvent.click(screen.getByRole("button", { name: /Salvar minha estimativa/ }));

    await waitFor(() => expect(saveMyNutritionTarget).toHaveBeenCalledWith(
      expect.objectContaining({ objective: "maintenance", activity: "moderate", mealsPerDay: 4 })
    ));
  });

  it("sem plano nem estimativa e sem dado nenhum: não quebra (target null resolvido)", async () => {
    getMyNutritionTarget.mockResolvedValue({ target: null, selfEstimateInputs: null, nutriName: null });
    render(<NutritionTargetCard />);
    expect(await screen.findByText("Estimativa própria")).toBeInTheDocument();
  });
});
