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
