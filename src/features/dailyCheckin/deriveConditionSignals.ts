import type { DailyCondition } from "./useDailyCondition";

export function deriveConditionSignals(condition: DailyCondition | null): string[] {
  if (!condition?.details) return [];
  const d = condition.details;
  const signals: string[] = [];
  if (!d.sleptWell) signals.push("Sono curto");
  if (d.inPain) signals.push("Dor relatada");
  if (d.stressed) signals.push("Estresse");
  if (d.hydrationOk === false) signals.push("Pouca hidratação");
  if (d.nutritionLevel === "poor") signals.push("Alimentação fraca");
  if (d.mentalLoadLevel === "high") signals.push("Carga mental alta");
  return signals;
}
