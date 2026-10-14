/**
 * Conversões do editor de refeição (PLAN_NUTRITION_QUICK_MACROS) compartilhadas entre a folha (`IntakeLogSheet`)
 * e o espaço de trabalho incremental (`useMealWorkspace`) — um só caminho para transformar item de prévia/salvo/
 * plano no pedido que o servidor entende.
 */
import type {
  IntakeItemRequest,
  IntakePreviewItem,
  PersistedIntakeItem,
  PlanMealItemRef,
} from "../../services/nutritionIntakeApi";

export type WorkingItem = IntakePreviewItem & { planMealItemId?: number; clientKey?: string };

export function persistedToWorking(items: PersistedIntakeItem[]): WorkingItem[] {
  return items.map((it) => ({
    resolved: true,
    rawText: it.name,
    foodQuery: it.name,
    foodId: it.foodId,
    name: it.name,
    grams: it.grams ?? undefined,
    per100g: it.per100g,
    energyKcal: it.energyKcal,
    proteinG: it.proteinG,
    carbohydrateG: it.carbohydrateG,
    fatG: it.fatG,
    resolver: it.resolver,
    confidence: "high",
    confirmed: true,
    quantity: it.quantity ?? undefined,
    unitLabel: it.unitLabel ?? undefined,
    canonicalFood: it.canonicalFood ?? undefined,
  }));
}

export function planToWorking(items: PlanMealItemRef[]): WorkingItem[] {
  return items.map((it) => ({
    resolved: true,
    rawText: it.foodName,
    foodQuery: it.foodName,
    name: it.foodName,
    grams: it.grams,
    energyKcal: it.energyKcal,
    proteinG: it.proteinG,
    carbohydrateG: it.carbohydrateG,
    fatG: it.fatG,
    resolver: "plan",
    confidence: "high",
    confirmed: true,
    planMealItemId: it.id,
  }));
}

export function previewToRequest(item: WorkingItem): IntakeItemRequest {
  if (item.resolver === "plan" && item.planMealItemId != null) {
    return { kind: "plan", planMealItemId: item.planMealItemId };
  }
  // Sem correspondência confiável no catálogo (ex.: whey — PLAN P1B
  // corrective §21) — o usuário informou os macros diretamente; nunca
  // inventados pelo servidor, mesmo item `manual` já validado no backend.
  if (item.resolver === "manual" || item.resolver === "history") {
    // "history" (P1B.1 — reaproveitado do próprio histórico do usuário, ex.:
    // whey na 2ª vez) persiste como `manual`: o backend já recalculou os
    // macros a partir do histórico no preview; não há um `foodId` de
    // catálogo para referenciar de volta.
    return {
      kind: "manual",
      name: item.name || item.rawText,
      grams: item.grams ?? null,
      energyKcal: item.energyKcal ?? 0,
      proteinG: item.proteinG ?? 0,
      carbohydrateG: item.carbohydrateG ?? 0,
      fatG: item.fatG ?? 0,
      displayQuantity: item.quantity ?? null,
      displayUnitLabel: item.unitLabel ?? null,
    };
  }
  return {
    kind: "food",
    foodId: item.foodId!,
    quantity: item.grams ?? 0,
    unitType: "grams",
    rawText: item.rawText || undefined,
    confirmed: item.confirmed,
    displayQuantity: item.quantity ?? null,
    displayUnitLabel: item.unitLabel ?? null,
  };
}

/**
 * O aluno tem plano do nutri com estrutura (refeições com itens) neste dia? Só então "fora do plano" faz sentido: sem plano
 * não há "fora de quê" — o registro livre é simplesmente o diário, sem etiqueta.
 */
export function dayHasPlan(day: { plannedMeals?: unknown[] | null; target?: { source?: string } | null }): boolean {
  return (day.plannedMeals?.length ?? 0) > 0 || day.target?.source === "plan_items";
}

export function sumTotals(items: WorkingItem[]) {
  return items
    .filter((i) => i.resolved)
    .reduce(
      (acc, i) => ({
        energyKcal: acc.energyKcal + (i.energyKcal ?? 0),
        proteinG: acc.proteinG + (i.proteinG ?? 0),
        carbohydrateG: acc.carbohydrateG + (i.carbohydrateG ?? 0),
        fatG: acc.fatG + (i.fatG ?? 0),
      }),
      { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 }
    );
}

