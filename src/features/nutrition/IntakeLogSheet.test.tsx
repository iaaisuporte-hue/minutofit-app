/**
 * PLAN_NUTRITION_QUICK_MACROS (P1B) — trava o "3 toques" do caminho rápido
 * (chip → confirmar) e a regra "Confirmar desabilitado enquanto houver item
 * não resolvido ou de baixa confiança sem aceite".
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IntakeLogSheet } from "./IntakeLogSheet";

const getIntakeShortcuts = vi.fn();
const parseIntakeText = vi.fn();
const submitIntakeLog = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getIntakeShortcuts: (...args: unknown[]) => getIntakeShortcuts(...args),
    parseIntakeText: (...args: unknown[]) => parseIntakeText(...args),
    submitIntakeLog: (...args: unknown[]) => submitIntakeLog(...args),
  };
});

const EMPTY_SHORTCUTS = { recent: [], favorites: [], yesterdayMeals: [], planMeals: [] };

beforeEach(() => {
  getIntakeShortcuts.mockReset().mockResolvedValue(EMPTY_SHORTCUTS);
  parseIntakeText.mockReset();
  submitIntakeLog.mockReset().mockResolvedValue({ id: 1, dateKey: "2026-09-16", energyKcal: 128 });
});

describe("IntakeLogSheet", () => {
  it("chip do plano → confirmar é o caminho de 3 toques (abrir já contado, chip, confirmar)", async () => {
    getIntakeShortcuts.mockResolvedValue({
      ...EMPTY_SHORTCUTS,
      planMeals: [{ mealId: 10, name: "Almoço", items: [{ id: 500, foodName: "Arroz", energyKcal: 128, proteinG: 2.5, carbohydrateG: 28, fatG: 0.2, grams: 100 }] }],
    });
    const onSaved = vi.fn();
    render(<IntakeLogSheet open onClose={() => {}} onSaved={onSaved} />);

    const chip = await screen.findByRole("button", { name: /Como no plano: Almoço/ });
    await userEvent.click(chip); // toque 2

    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmBtn).not.toBeDisabled();
    await userEvent.click(confirmBtn); // toque 3

    await waitFor(() => expect(submitIntakeLog).toHaveBeenCalled());
    const [call] = submitIntakeLog.mock.calls[0];
    expect(call.items).toEqual([{ kind: "plan", planMealItemId: 500 }]);
    expect(call.source).toBe("plan");
    expect(onSaved).toHaveBeenCalled();
  });

  it("texto → Estimar → item resolvido de alta confiança → Confirmar habilitado", async () => {
    parseIntakeText.mockResolvedValue({
      items: [
        {
          resolved: true, rawText: "200g de frango", foodQuery: "frango", foodId: 7, name: "Frango, peito, grelhado",
          grams: 200, per100g: { kcal: 100, p: 20, c: 0, f: 2 }, energyKcal: 200, proteinG: 40, carbohydrateG: 0, fatG: 4,
          resolver: "catalog", confidence: "high", confirmed: true,
        },
      ],
      totals: { energyKcal: 200, proteinG: 40, carbohydrateG: 0, fatG: 4 },
      needsConfirmation: false,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "200g de frango");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/Frango, peito, grelhado/);
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeDisabled();
  });

  it("item de baixa confiança mantém Confirmar desabilitado até o toque de aceite", async () => {
    parseIntakeText.mockResolvedValue({
      items: [
        {
          resolved: true, rawText: "um pouco de comida", foodQuery: "comida", foodId: 9, name: "Comida qualquer",
          grams: 100, per100g: { kcal: 100, p: 10, c: 10, f: 5 }, energyKcal: 100, proteinG: 10, carbohydrateG: 10, fatG: 5,
          resolver: "catalog", confidence: "low", confirmed: false,
        },
      ],
      totals: { energyKcal: 100, proteinG: 10, carbohydrateG: 10, fatG: 5 },
      needsConfirmation: true,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "um pouco de comida");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/Comida qualquer/);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Confirme" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeDisabled();
  });

  it("item não resolvido mantém Confirmar desabilitado", async () => {
    parseIntakeText.mockResolvedValue({
      items: [{ resolved: false, rawText: "xyz123", foodQuery: "xyz123" }],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 },
      needsConfirmation: true,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "xyz123");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/"xyz123"/);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("Cancelar fecha sem chamar submitIntakeLog", async () => {
    const onClose = vi.fn();
    render(<IntakeLogSheet open onClose={onClose} onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(submitIntakeLog).not.toHaveBeenCalled();
  });
});
