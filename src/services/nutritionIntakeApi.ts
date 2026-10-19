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
/** Fonte da KCAL (Spec 039: a meta do nutri vence por nutriente sobre plano e estimativa). */
export type NutritionTargetSource = 'nutri_goal' | 'plan_items' | 'self_estimate';

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
  /** `null` só quando nenhuma fonte tem o nutriente — nunca "meta 0". */
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  mealsPerDay: number;
  source: NutritionTargetSource;
  /** Presente quando a proteína veio da meta do nutri; `proteinG` é o mínimo. Opcional por compat. de deploy. */
  proteinRange?: { minG: number; maxG: number | null } | null;
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

export type IntakeItemResolver = 'catalog' | 'measure' | 'manual' | 'plan' | 'history';
/** `medium` = fuzzy match plausível mas não certo — UI "Você quis dizer?" (PLAN P1B corrective). */
export type IntakeConfidence = 'high' | 'medium' | 'low';

/**
 * Identidade de DOMÍNIO do alimento (PLAN CANONICAL_FOOD_MODEL_SPIKE §6) —
 * nome natural para exibição ("Peito de frango" · "Grelhado"), nunca a
 * string bruta da fonte de dados ("Frango, peito, sem pele, grelhado").
 * `name`/`foodId` continuam a identidade do registro de composição (TACO/
 * USDA/etc.) — a fonte nunca aparece nesta estrutura, só no dado interno.
 */
export interface CanonicalFood {
  baseFood: string;
  variant: string | null;
  preparation: string | null;
}

export interface IntakePreviewItem {
  resolved: boolean;
  rawText: string;
  foodQuery: string;
  foodId?: number;
  name?: string;
  canonicalFood?: CanonicalFood;
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
  /**
   * Quantidade/unidade EXATAMENTE como o usuário disse (P1B.1 "Smart Food
   * Logging" — nunca reescrever "200 ml" como "200 g"), preenchido mesmo
   * quando `resolved:false`. `grams` continua a base de cálculo.
   */
  quantity?: number;
  unitLabel?: string;
  /**
   * Candidatos alternativos quando a confiança NÃO é `high` (§10/§20) —
   * nunca populado no caminho feliz. Alimenta a UI de chips "qual destes?"
   * sem round-trip nova — já é o top-3 que o Resolver calcula hoje.
   */
  candidates?: Array<{
    foodId: number;
    canonicalFood: CanonicalFood;
    per100g: { kcal: number; p: number; c: number; f: number };
  }>;
  /** Mistura de ingredientes sem composição no catálogo ("café com leite"): nunca vem com sugestão; a UI orienta a registrar cada ingrediente. */
  composite?: boolean;
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
  /** `true` quando a IA (não o parser determinístico) interpretou o texto — usado só para escolher `source:'parse_ai'` no POST. */
  aiUsed: boolean;
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
      displayQuantity?: number | null;
      displayUnitLabel?: string | null;
      /** UUID gerado no cliente — um reenvio com a mesma chave nunca duplica o item (registro incremental). */
      clientKey?: string | null;
    }
  | {
      kind: 'manual';
      name: string;
      grams?: number | null;
      energyKcal: number;
      proteinG: number;
      carbohydrateG: number;
      fatG: number;
      displayQuantity?: number | null;
      displayUnitLabel?: string | null;
      clientKey?: string | null;
    }
  | { kind: 'plan'; planMealItemId: number; clientKey?: string | null }
  /**
   * SÓ no PATCH: mantém um item já salvo sem re-resolver (snapshot intacto, inclusive item `plan`, que não tem
   * `foodId`). `index` = posição do item na refeição (a ordem de `NutritionIntakeMeal.items`).
   */
  | {
      kind: 'existing';
      index: number;
      /** Nova quantidade na MESMA unidade do item — o servidor reescala os gramas e recalcula os nutrientes. */
      quantity?: number;
    };

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
  /** Quantidade/unidade ORIGINAIS tal como o usuário disse — exibição apenas (P1B.1); `grams` continua a base de cálculo. */
  quantity?: number | null;
  unitLabel?: string | null;
  /** Identidade de domínio (PLAN CANONICAL_FOOD_MODEL_SPIKE §6) — nome natural, snapshot do momento do registro. */
  canonicalFood?: CanonicalFood | null;
  /** Chave de idempotência do cliente (itens adicionados pelo espaço de trabalho) — usada para reconhecer o item após cada resposta. */
  clientKey?: string;
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
  /** null enquanto a linha nunca foi editada — vai de volta como `baseUpdatedAt` (409 se outro aparelho editou antes). */
  updatedAt: string | null;
}

export type IntakeSource = 'parse' | 'parse_ai' | 'manual' | 'repeat' | 'favorite' | 'plan';

export async function submitIntakeLog(input: {
  label: string;
  rawText?: string | null;
  mealId?: number | null;
  /** Anexa a uma refeição já iniciada (registro incremental) em vez de criar outra. */
  logId?: number | null;
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

/**
 * P0 "Feito → diário" — "Sim, registrar conforme o plano". Registra os itens
 * prescritos da refeição pelo MESMO POST do registro (itens `plan`, que o
 * servidor copia do plano — o cliente não envia macros). Chave fixa por item
 * (`plan-item:<id>`): repetir no mesmo dia é idempotente; `onlyIfMealEmpty`
 * faz o servidor recusar (409) se a refeição já tem outro consumo hoje, e a
 * resposta traz a linha existente para a tela mostrar "já registrado".
 */
export async function registerPlanMealAsPlanned(meal: {
  id: number;
  name: string;
  itemIds: number[];
}): Promise<{ log: IntakeLogRecord; alreadyLogged: boolean }> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: meal.name,
      mealId: meal.id,
      source: 'plan',
      onlyIfMealEmpty: true,
      items: meal.itemIds.map((id) => ({ kind: 'plan', planMealItemId: id, clientKey: `plan-item:${id}` })),
    }),
  });
  if (res.status === 409) {
    const json = await parseJson(res);
    if (json?.error === 'meal_already_logged' && json?.data) return { log: json.data, alreadyLogged: true };
  }
  const json = await readJson(res);
  return { log: json.data, alreadyLogged: false };
}

/**
 * PLAN P1B corrective ("Consulta + Edição de Refeição Registrada") — edita
 * o CONTEÚDO de um log já persistido. Nunca envia `dateKey`/`loggedAt`
 * (preservados pelo servidor); o servidor sempre recalcula kcal/macros a
 * partir dos itens, nunca aceita totais do cliente.
 */
export async function updateIntakeLog(
  id: number,
  input: { label: string; rawText?: string | null; items: IntakeItemRequest[]; source: IntakeSource; baseUpdatedAt?: string | null }
): Promise<IntakeLogRecord> {
  const res = await authFetch(`${API_URL}/user/nutrition-intake/${id}`, {
    method: 'PATCH',
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

/**
 * PLAN P1B corrective ("Agrupamento por Refeição") — unidade visual do
 * aluno. Agrupa por associação PERSISTIDA (`mealId` do plano), nunca por
 * horário/rótulo parecido. `sourceLogIds` são as linhas físicas de
 * `user_nutrition_intake_logs` por trás do card — normalmente 1.
 */
export interface NutritionIntakeMeal {
  groupKey: string;
  mealId: number | null;
  label: string;
  loggedAt: string;
  /** `true` = refeição extra, fora do plano do Nutri (§7/§11) — realidade alimentar, não "erro". */
  isExtra: boolean;
  items: PersistedIntakeItem[];
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  fiberPartial: boolean;
  confidenceScore: number;
  sourceLogIds: number[];
  /** Dia da refeição (`YYYY-MM-DD`) e `updated_at` da 1ª linha — o editor relê o dia certo e checa conflito. Opcionais por compatibilidade. */
  dateKey?: string;
  updatedAt?: string | null;
}

export interface DayIntakeResponse {
  date: string;
  logs: IntakeLogRecord[];
  meals: NutritionIntakeMeal[];
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
