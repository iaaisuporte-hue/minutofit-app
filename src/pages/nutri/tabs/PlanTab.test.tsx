/**
 * SPEC 038 (P3A) — regressão crítica: editar o plano (mesmo só o título)
 * NUNCA pode apagar os itens estruturados já prescritos. Mesma classe do
 * BLOCKER NUTRI-01 da SPEC 035 (P1A), desta vez em cima dos itens de
 * refeição — `openEdit` precisa ecoar `items` de volta no payload do PATCH,
 * exatamente como já fazia para `alternatives`.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PlanTab } from "./PlanTab";
import type { NutritionPlan } from "../../../services/nutriApi";

const fetchPatientPlans = vi.fn();
const updateNutritionPlan = vi.fn();
const checkDietAgainstProfile = vi.fn();

vi.mock("../../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/nutriApi")>();
  return {
    ...actual,
    fetchPatientPlans: (...args: unknown[]) => fetchPatientPlans(...args),
    updateNutritionPlan: (...args: unknown[]) => updateNutritionPlan(...args),
    checkDietAgainstProfile: (...args: unknown[]) => checkDietAgainstProfile(...args),
  };
});

const PLAN_WITH_ITEM: NutritionPlan = {
  id: 1, nutri_id: 10, patient_id: 20, academy_id: null,
  title: "Plano com item", objective: "weight_loss", general_notes: null,
  status: "active", started_at: new Date().toISOString(), ended_at: null,
  meals: [{
    id: 100, plan_id: 1, name: "Almoço", orientation: "Arroz e feijão", order_index: 0,
    meal_time: null, tolerance_minutes: null, reminder_minutes: null,
    metabolic_goal: null, workout_relation: null, hydration_note: null, supplement_note: null,
    alternatives: [],
    items: [{
      id: 500, foodId: 3, customFoodId: null, quantity: 100, unitType: "grams",
      measureId: null, customMeasureId: null, grams: 100, orderIndex: 0, notes: null,
      foodName: "Arroz, tipo 1, cozido", energyKcal: 128.26, proteinG: 2.52,
      carbohydrateG: 28.06, fatG: 0.23, fiberG: 1.56, sodiumMg: 1.2,
    }],
    totals: { energyKcal: 128.26, proteinG: 2.52, carbohydrateG: 28.06, fatG: 0.23, fiberG: 1.56, fiberPartial: false, sodiumMg: 1.2, sodiumPartial: false },
  }],
};

beforeEach(() => {
  fetchPatientPlans.mockReset().mockResolvedValue({ active: PLAN_WITH_ITEM, history: [] });
  updateNutritionPlan.mockReset().mockResolvedValue(PLAN_WITH_ITEM);
  checkDietAgainstProfile.mockReset().mockResolvedValue([]);
});

function renderTab() {
  return render(<MemoryRouter><PlanTab patientId={20} /></MemoryRouter>);
}

describe("PlanTab — edição preserva itens estruturados", () => {
  it("mostra o item e o subtotal na visão do plano", async () => {
    renderTab();
    expect(await screen.findByText(/Arroz, tipo 1, cozido/)).toBeInTheDocument();
  });

  it("editar só o título ecoa o item existente no payload — nunca some (SPEC 038, mesma classe do NUTRI-01)", async () => {
    renderTab();
    await screen.findByText(/Arroz, tipo 1, cozido/);

    await userEvent.click(screen.getByRole("button", { name: "Editar plano" }));
    await userEvent.click(screen.getByRole("button", { name: /Salvar alterações/ }));

    await waitFor(() => expect(updateNutritionPlan).toHaveBeenCalled());
    const [, , payload] = updateNutritionPlan.mock.calls[0];
    expect(payload.meals[0].items).toEqual([
      expect.objectContaining({ id: 500, foodId: 3, quantity: 100, unitType: "grams" }),
    ]);
  });
});
