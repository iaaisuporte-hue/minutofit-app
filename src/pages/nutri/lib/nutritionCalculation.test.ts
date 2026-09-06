import { describe, it, expect } from "vitest";
import { resolveGrams, calculateNutrition, sumNutrients } from "./nutritionCalculation";

describe("nutritionCalculation (preview do frontend — espelho do backend)", () => {
  it("resolveGrams: medida caseira multiplica quantidade × gramas", () => {
    expect(resolveGrams(2, "measure", 25)).toBe(50);
    expect(resolveGrams(150, "grams")).toBe(150);
  });

  it("calculateNutrition escala proporcionalmente e preserva null de fibra/sódio", () => {
    const per100g = { energyKcal: 200, proteinG: 20, carbohydrateG: 10, fatG: 8, fiberG: null, sodiumMg: null };
    const r = calculateNutrition(per100g, 150);
    expect(r).toEqual({ energyKcal: 300, proteinG: 30, carbohydrateG: 15, fatG: 12, fiberG: null, sodiumMg: null });
  });

  it("sumNutrients marca fiberPartial quando nem todo item tem fibra", () => {
    const a = calculateNutrition({ energyKcal: 100, proteinG: 5, carbohydrateG: 10, fatG: 2, fiberG: 3, sodiumMg: null }, 100);
    const b = calculateNutrition({ energyKcal: 100, proteinG: 5, carbohydrateG: 10, fatG: 2, fiberG: null, sodiumMg: null }, 100);
    const total = sumNutrients([a, b]);
    expect(total.fiberG).toBe(3);
    expect(total.fiberPartial).toBe(true);
  });
});
