/**
 * Corrigir ontem usa o MESMO espaço de trabalho: salvar um item NÃO fecha a folha (senão o que está em
 * "Falta confirmar" some e a correção é interrompida a cada gravação).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { YesterdayMealsSheet } from "./YesterdayMealsSheet";

const getDayIntake = vi.fn();
const updateIntakeLog = vi.fn();
const getIntakeShortcuts = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getDayIntake: (...a: unknown[]) => getDayIntake(...a),
    updateIntakeLog: (...a: unknown[]) => updateIntakeLog(...a),
    getIntakeShortcuts: (...a: unknown[]) => getIntakeShortcuts(...a),
  };
});

const ITEM = {
  foodId: 7, name: "Arroz", grams: 100, energyKcal: 130, proteinG: 3, carbohydrateG: 28, fatG: 0.5, fiberG: null,
  resolver: "catalog" as const, confidence: "high" as const, confirmed: true,
};
const LOG = {
  id: 4, dateKey: "2026-10-13", loggedAt: "2026-10-13T22:00:00Z", mealId: null, label: "Jantar", rawText: null,
  energyKcal: 130, proteinG: 3, carbohydrateG: 28, fatG: 0.5, fiberG: null, fiberPartial: false, items: [ITEM],
  confidenceScore: 1, source: "manual", isFavorite: false, updatedAt: null,
};
const MEAL = {
  groupKey: "log:4", mealId: null, label: "Jantar", loggedAt: LOG.loggedAt, isExtra: true, items: [ITEM], energyKcal: 130,
  proteinG: 3, carbohydrateG: 28, fatG: 0.5, fiberG: null, fiberPartial: false, confidenceScore: 1, sourceLogIds: [4],
  dateKey: "2026-10-13", updatedAt: null,
};

beforeEach(() => {
  getDayIntake.mockReset().mockResolvedValue({ date: "2026-10-13", logs: [LOG], meals: [MEAL], totals: {}, coverage: {}, target: null, plannedMeals: [] });
  updateIntakeLog.mockReset().mockResolvedValue({ ...LOG, energyKcal: 150, updatedAt: "2026-10-14T09:00:00Z" });
  getIntakeShortcuts.mockReset().mockResolvedValue({ recent: [], favorites: [], yesterdayMeals: [], planMeals: [] });
});

describe("YesterdayMealsSheet", () => {
  it("salvar um item editado mantém a folha de edição aberta e envia baseUpdatedAt da refeição", async () => {
    render(<YesterdayMealsSheet open onClose={() => {}} />);

    await userEvent.click(await screen.findByRole("button", { name: /Jantar/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar refeição" });
    await userEvent.click(screen.getByRole("button", { name: "Editar Arroz" }));
    const qty = screen.getByLabelText("Quantidade (g)");
    await userEvent.clear(qty);
    await userEvent.type(qty, "150");
    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    await waitFor(() => expect(updateIntakeLog).toHaveBeenCalled());
    expect(updateIntakeLog.mock.calls[0][1].items).toEqual([{ kind: "existing", index: 0, quantity: 150 }]);
    expect(updateIntakeLog.mock.calls[0][1].baseUpdatedAt).toBeNull(); // conflito checado já na 1ª edição
    await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(2)); // lista de ontem relida…
    expect(dialog).toBeInTheDocument(); // …sem fechar a folha
    expect(screen.getByRole("dialog", { name: "Editar refeição" })).toBeInTheDocument();
  });
});
