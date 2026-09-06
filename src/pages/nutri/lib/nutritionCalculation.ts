/**
 * SPEC 038 (P3A) / §33: espelho do backend (`services/nutritionCalculation.ts`)
 * — usado SÓ para preview otimista no builder. O backend recalcula e é a
 * única fonte de verdade na persistência; se algum dia divergir, o servidor
 * vence sempre.
 */

export interface NutrientsPer100g {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  sodiumMg: number | null;
}

export interface CalculatedNutrients {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  sodiumMg: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveGrams(quantity: number, unitType: "grams" | "measure", measureGrams?: number | null): number {
  if (quantity <= 0) return 0;
  if (unitType === "grams") return round2(quantity);
  if (!measureGrams || measureGrams <= 0) return 0;
  return round2(quantity * measureGrams);
}

export function calculateNutrition(per100g: NutrientsPer100g, grams: number): CalculatedNutrients {
  if (grams <= 0) {
    return { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, sodiumMg: null };
  }
  const factor = grams / 100;
  return {
    energyKcal: round2(per100g.energyKcal * factor),
    proteinG: round2(per100g.proteinG * factor),
    carbohydrateG: round2(per100g.carbohydrateG * factor),
    fatG: round2(per100g.fatG * factor),
    fiberG: per100g.fiberG == null ? null : round2(per100g.fiberG * factor),
    sodiumMg: per100g.sodiumMg == null ? null : round2(per100g.sodiumMg * factor),
  };
}

export interface NutrientTotalsPreview {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  fiberPartial: boolean;
}

export function sumNutrients(items: CalculatedNutrients[]): NutrientTotalsPreview {
  let energyKcal = 0, proteinG = 0, carbohydrateG = 0, fatG = 0, fiberG = 0;
  let hasFiber = false, fiberPartial = false;
  for (const it of items) {
    energyKcal += it.energyKcal;
    proteinG += it.proteinG;
    carbohydrateG += it.carbohydrateG;
    fatG += it.fatG;
    if (it.fiberG != null) { fiberG += it.fiberG; hasFiber = true; } else { fiberPartial = true; }
  }
  return {
    energyKcal: round2(energyKcal),
    proteinG: round2(proteinG),
    carbohydrateG: round2(carbohydrateG),
    fatG: round2(fatG),
    fiberG: hasFiber ? round2(fiberG) : null,
    fiberPartial: hasFiber && fiberPartial,
  };
}
