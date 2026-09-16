/**
 * PLAN_NUTRITION_QUICK_MACROS — serviço próprio, separado de `nutriApi.ts`
 * (que já carrega funções mortas de fases anteriores). Mesmo padrão de erro
 * de `nutriApi.ts` (`readNutriJson`/`NutriApiError`), duplicado aqui em
 * miniatura para não criar dependência cruzada entre os dois arquivos.
 */
import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';

export class NutritionIntakeApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'NutritionIntakeApiError';
    this.status = status;
    this.code = code;
  }
}

async function readJson(res: Response): Promise<any> {
  const json = await parseJson(res);
  if (!res.ok || json?.success === false) {
    const code = typeof json?.error === 'string' ? json.error : `http_${res.status}`;
    throw new NutritionIntakeApiError(res.status, code);
  }
  return json;
}

export type NutritionObjective = 'weight_loss' | 'maintenance' | 'muscle_gain';
export type ActivityLevel = 'low' | 'moderate' | 'high';
export type NutritionTargetSource = 'plan_items' | 'self_estimate';

export interface MealSplit {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
}

export interface EstimatedTarget {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  mealsPerDay: number;
  formulaVersion: number;
  meals: MealSplit[];
  weightKgUsed: number;
}

export interface ResolvedNutritionTarget {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  mealsPerDay: number;
  source: NutritionTargetSource;
}

export interface NutritionTargetResponse {
  target: ResolvedNutritionTarget | null;
  selfEstimateInputs: { weightKg: number; objective: NutritionObjective; activity: ActivityLevel } | null;
  nutriName: string | null;
}

export interface EstimateTargetInput {
  weightKg?: number;
  objective: NutritionObjective;
  activity: ActivityLevel;
  mealsPerDay: number;
}

export async function estimateNutritionTarget(input: EstimateTargetInput): Promise<EstimatedTarget> {
  const res = await authFetch(`${API_URL}/user/nutrition-target/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJson(res);
  return json.data;
}

export async function getMyNutritionTarget(): Promise<NutritionTargetResponse> {
  const res = await authFetch(`${API_URL}/user/nutrition-target`);
  const json = await readJson(res);
  return json.data;
}

export async function saveMyNutritionTarget(input: EstimateTargetInput): Promise<{ target: ResolvedNutritionTarget | null }> {
  const res = await authFetch(`${API_URL}/user/nutrition-target`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJson(res);
  return json.data;
}

// ---------------------------------------------------------------------------
// P1B — Registro rápido de refeição
// ---------------------------------------------------------------------------

export type IntakeItemResolver = 'catalog' | 'measure' | 'manual' | 'plan';
export type IntakeConfidence = 'high' | 'low';

export interface IntakePreviewItem {
  resolved: boolean;
  rawText: string;
  foodQuery: string;
  foodId?: number;
  name?: string;
  grams?: number;
  measureId?: number | null;
  fallbackMeasureKey?: string | null;
  per100g?: { kcal: number; p: number; c: number; f: number };
  energyKcal?: number;
  proteinG?: number;
  carbohydrateG?: number;
  fatG?: number;
  resolver?: IntakeItemResolver;
  confidence?: IntakeConfidence;
  confirmed?: boolean;
}

export interface NutrientTotals {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  /** null quando nenhum item somado tinha fibra conhecida — nunca 0 fabricado (PLAN §11). */
  fiberG?: number | null;
  /** true quando ALGUM item somado não tinha fibra conhecida — `fiberG` é soma parcial. */
  fiberPartial?: boolean;
}

export interface ParsedPreview {
  items: IntakePreviewItem[];
  totals: NutrientTotals;
  needsConfirmation: boolean;
}

export async function parseIntakeText(text: string): Promise<ParsedPreview> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const json = await readJson(res);
  return json.data;
}

export type IntakeItemRequest =
  | {
      kind: 'food';
      foodId: number;
      quantity: number;
      unitType: 'grams' | 'measure';
      measureId?: number | null;
      fallbackMeasureKey?: string | null;
      rawText?: string | null;
      confirmed?: boolean;
    }
  | { kind: 'manual'; name: string; grams?: number | null; energyKcal: number; proteinG: number; carbohydrateG: number; fatG: number }
  | { kind: 'plan'; planMealItemId: number };

export interface PersistedIntakeItem {
  foodId?: number;
  name: string;
  grams: number | null;
  per100g?: { kcal: number; p: number; c: number; f: number };
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  resolver: IntakeItemResolver;
  confidence: IntakeConfidence;
  confirmed: boolean;
}

export interface IntakeLogRecord {
  id: number;
  dateKey: string;
  loggedAt: string;
  mealId: number | null;
  label: string;
  rawText: string | null;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  fiberPartial: boolean;
  items: PersistedIntakeItem[];
  confidenceScore: number;
  source: string;
  isFavorite: boolean;
}

export type IntakeSource = 'parse' | 'parse_ai' | 'manual' | 'repeat' | 'favorite' | 'plan';

export async function submitIntakeLog(input: {
  label: string;
  rawText?: string | null;
  mealId?: number | null;
  items: IntakeItemRequest[];
  source: IntakeSource;
}): Promise<IntakeLogRecord> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJson(res);
  return json.data;
}

export interface DayCoverage {
  loggedMeals: number;
  expectedMeals: number;
  coverageRatio: number;
  confidence: number;
  level: 'high' | 'partial' | 'low';
}

export interface PlannedMeal {
  mealId: number;
  name: string;
  orderIndex: number;
  energyKcal: number;
}

export interface DayIntakeResponse {
  date: string;
  logs: IntakeLogRecord[];
  totals: NutrientTotals;
  coverage: DayCoverage;
  target: ResolvedNutritionTarget | null;
  /** Só existe com plano ESTRUTURADO (itens de refeição) — nunca reconstruído da estimativa própria. */
  plannedMeals: PlannedMeal[];
}

export async function getDayIntake(date?: string): Promise<DayIntakeResponse> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await authFetch(`${API_URL}/user/nutrition-intake${qs}`);
  const json = await readJson(res);
  return json.data;
}

export async function deleteIntakeLog(id: number): Promise<void> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake/${id}`, { method: 'DELETE' });
  await readJson(res);
}

export async function setIntakeFavorite(id: number, favorite: boolean): Promise<void> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake/${id}/favorite`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorite }),
  });
  await readJson(res);
}

export interface IntakeShortcutMeal {
  label: string;
  items: PersistedIntakeItem[];
}
export interface IntakeFavoriteMeal extends IntakeShortcutMeal {
  id: number;
}
export interface IntakeYesterdayMeal extends IntakeShortcutMeal {
  logId: number;
  loggedAt: string;
}
/** Item de refeição do PLANO do nutri (SPEC 038) — shape distinto do log; `id` é `planMealItemId`. */
export interface PlanMealItemRef {
  id: number;
  foodName: string;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  grams: number;
}
export interface IntakePlanMeal {
  mealId: number;
  name: string;
  items: PlanMealItemRef[];
}

export interface IntakeShortcuts {
  recent: IntakeShortcutMeal[];
  favorites: IntakeFavoriteMeal[];
  yesterdayMeals: IntakeYesterdayMeal[];
  planMeals: IntakePlanMeal[];
}

export async function getIntakeShortcuts(): Promise<IntakeShortcuts> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake/shortcuts`);
  const json = await readJson(res);
  return json.data;
}

/** Converte itens já resolvidos (log de recentes/favoritos/ontem) em `IntakeItemRequest[]` para o POST. */
export function itemsToRequest(items: PersistedIntakeItem[]): IntakeItemRequest[] {
  return items.map((it) => {
    if ((it.resolver === 'catalog' || it.resolver === 'measure') && it.foodId != null && it.grams) {
      // Repetir só precisa do gramas já resolvido — nunca precisa rederivar a medida.
      return { kind: 'food', foodId: it.foodId, quantity: it.grams, unitType: 'grams' };
    }
    // manual e plan (o plano já é snapshot fixo; repetir um item plan de log
    // antigo não tem mais o planMealItemId original — vira manual com os
    // mesmos números, nunca um novo lookup no catálogo).
    return { kind: 'manual', name: it.name, grams: it.grams, energyKcal: it.energyKcal, proteinG: it.proteinG, carbohydrateG: it.carbohydrateG, fatG: it.fatG };
  });
}

/** Converte itens do PLANO (chip "Como no plano") em `IntakeItemRequest[]` para o POST. */
export function planItemsToRequest(items: PlanMealItemRef[]): IntakeItemRequest[] {
  return items.map((it) => ({ kind: 'plan', planMealItemId: it.id }));
}

export interface CatalogFoodSummary {
  id: number;
  name: string;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  referenceAmountG: number;
}

/** Busca no catálogo TACO — usado para resolver manualmente um item "?" que o parser não achou. */
export async function searchNutritionFoods(query: string): Promise<CatalogFoodSummary[]> {
  const res = await authFetch(`${API_URL}/user/nutrition-foods/search?q=${encodeURIComponent(query)}`);
  const json = await readJson(res);
  return json.data;
}
