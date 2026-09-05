import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';
import type { MetabolicEvolutionPayload } from '../features/metabolicCheckin';

// ---------------------------------------------------------------------------
// SPEC 035 / NUTRI-11 — tratamento de erro único para todo o módulo
// ---------------------------------------------------------------------------
//
// Antes, 26 das 27 funções deste arquivo faziam `json.data ?? fallback` sem
// checar `res.ok` — um 403 (consentimento revogado) ou um 500 real virava
// silenciosamente "sem dado", e a tela renderizava o mesmo estado vazio de um
// paciente que nunca teve plano. `readNutriJson` é o único ponto de leitura
// de resposta: toda função passa por aqui, então nenhuma pode mais engolir
// erro. `NutriApiError.consentRevoked` deixa a tela distinguir "revogado"
// de "vazio de verdade" sem cada componente reimplementar a checagem.

export class NutriApiError extends Error {
  status: number;
  code: string;
  consentRevoked: boolean;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'NutriApiError';
    this.status = status;
    this.code = code;
    this.consentRevoked = status === 403 && /consent/i.test(code);
  }
}

async function readNutriJson(res: Response): Promise<any> {
  const json = await parseJson(res);
  if (!res.ok || json?.success === false) {
    const code = typeof json?.error === 'string' ? json.error : `http_${res.status}`;
    throw new NutriApiError(res.status, code);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NutriObjective =
  | 'weight_loss'
  | 'muscle_gain'
  | 'metabolic_health'
  | 'performance'
  | 'maintenance';

export const OBJECTIVE_LABELS: Record<NutriObjective, string> = {
  weight_loss:      'Emagrecimento',
  muscle_gain:      'Ganho de massa',
  metabolic_health: 'Saúde metabólica',
  performance:      'Performance',
  maintenance:      'Manutenção',
};

export type Adherence = 'full' | 'partial' | 'skipped';

export const ADHERENCE_LABELS: Record<Adherence, string> = {
  full:    'Segui o plano',
  partial: 'Segui parcialmente',
  skipped: 'Não segui',
};

export type MealCheckinStatus = 'done' | 'partial' | 'skipped' | 'substituted' | 'delayed';

export type MealStatus = 'upcoming' | 'due_now' | 'done' | 'partial' | 'skipped' | 'substituted' | 'delayed' | 'missed_window' | 'no_time';

export type MetabolicGoal = 'energy' | 'recovery' | 'satiety' | 'sleep_light';
export type WorkoutRelation = 'pre' | 'post' | 'none';

export const METABOLIC_GOAL_LABELS: Record<MetabolicGoal, string> = {
  energy:      'Energia inicial',
  recovery:    'Recuperação pós-treino',
  satiety:     'Saciedade duradoura',
  sleep_light: 'Leveza para o sono',
};

export const WORKOUT_RELATION_LABELS: Record<WorkoutRelation, string> = {
  pre:  'Pré-treino',
  post: 'Pós-treino',
  none: 'Sem relação com treino',
};

export interface MealAlternative {
  id: number;
  meal_id: number;
  description: string;
  order_index: number;
}

export interface NutritionMeal {
  id: number;
  plan_id: number;
  name: string;
  orientation: string;
  order_index: number;
  meal_time: string | null;
  tolerance_minutes: number | null;
  reminder_minutes: number | null;
  metabolic_goal: MetabolicGoal | null;
  workout_relation: WorkoutRelation | null;
  hydration_note: string | null;
  supplement_note: string | null;
  alternatives: MealAlternative[];
}

export interface MealTimelineEntry extends NutritionMeal {
  status: MealStatus;
  checkin: MealCheckinRecord | null;
}

export interface MealCheckinRecord {
  id: string;
  patient_id: number;
  plan_id: number;
  meal_id: number;
  check_date: string;
  status: MealCheckinStatus;
  recorded_at: string;
  satiety: number | null;
  hunger: number | null;
  energy: number | null;
  note: string | null;
}

export interface NutritionPlan {
  id: number;
  nutri_id: number;
  patient_id: number;
  academy_id: number | null;
  title: string;
  objective: NutriObjective;
  general_notes: string | null;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  nutri_name?: string;
  nutri_email?: string;
  patient_name?: string;
  meals: NutritionMeal[];
  todayCheckin?: NutritionCheckin | null;
}

export interface NutritionCheckin {
  id: number;
  patient_id: number;
  plan_id: number;
  check_date: string;
  adherence: Adherence;
  note: string | null;
  created_at: string;
}

export type AdherenceState = 'calibrating' | 'ready';
export type AdherenceTrend = 'up' | 'down' | 'stable';

export interface PatientSummary {
  id: number;
  name: string | null;
  email: string | null;
  photo_url: string | null;
  academy_id: number | null;
  activePlan: { plan_id: number; title: string; started_at: string } | null;
  /** @deprecated proxy legado (dias com check-in ÷ janela) — usar mealAdherence*Pct. */
  adherence7d: number;
  /** @deprecated ver adherence7d. */
  adherence30d: number;
  /** Aderência REAL por refeição (SPEC 035), proporcional ao tempo de vida do plano. */
  mealAdherence7dPct: number | null;
  mealAdherence30dPct: number | null;
  lastCheckinDate: string | null;
  riskFlag: boolean;
  adherenceDropFlag: boolean;
  /** SPEC 035 — fonte única de verdade; usar em vez de recalcular no cliente. */
  adherenceState: AdherenceState | null;
  streakDays: number;
  trend: AdherenceTrend | null;
  /** true quando o paciente revogou consentimento — campos acima vêm nulos/zerados por redação, não por ausência de dado. */
  consentRevoked: boolean;
}

export interface NutritionObservation {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Nutri — patients
// ---------------------------------------------------------------------------

export async function fetchPatients(): Promise<PatientSummary[]> {
  const res = await authFetch(`${API_URL}/nutri/patients`);
  const json = await readNutriJson(res);
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Nutri — plans
// ---------------------------------------------------------------------------

export async function fetchPatientPlans(patientId: number): Promise<{
  active: NutritionPlan | null;
  history: Array<{ id: number; title: string; objective: NutriObjective; started_at: string; ended_at: string | null }>;
}> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans`);
  const json = await readNutriJson(res);
  return json.data ?? { active: null, history: [] };
}

export type MealPayload = {
  /**
   * Identidade da refeição já existente no plano (SPEC 035 / P1A.1).
   * OBRIGATÓRIO ecoar de volta ao editar — sem ele o backend trata a
   * refeição como nova e a antiga como removida, e todo histórico de
   * check-in daquela refeição vira órfão (a informação sobrevive, mas some
   * da visão ativa). Ausente apenas para refeição realmente nova.
   */
  id?: number;
  name: string;
  orientation: string;
  order_index: number;
  meal_time?: string | null;
  tolerance_minutes?: number | null;
  reminder_minutes?: number | null;
  metabolic_goal?: MetabolicGoal | null;
  workout_relation?: WorkoutRelation | null;
  hydration_note?: string | null;
  supplement_note?: string | null;
  alternatives?: Array<{ id?: number; description: string; order_index: number }>;
};

export async function createNutritionPlan(
  patientId: number,
  data: {
    title: string;
    objective: NutriObjective;
    general_notes?: string;
    meals: MealPayload[];
  }
): Promise<NutritionPlan> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await readNutriJson(res);
  return json.data;
}

export async function endNutritionPlan(patientId: number, planId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans/${planId}`, {
    method: 'DELETE',
  });
  await readNutriJson(res);
}

export async function updateNutritionPlan(
  patientId: number,
  planId: number,
  data: {
    title?: string;
    objective?: NutriObjective;
    general_notes?: string;
    meals?: MealPayload[];
  }
): Promise<NutritionPlan> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await readNutriJson(res);
  return json.data;
}

// ---------------------------------------------------------------------------
// Nutri — adherence
// ---------------------------------------------------------------------------

export async function fetchAdherence(patientId: number, days = 7): Promise<{
  plan: { id: number; title: string } | null;
  checkins: Array<{ check_date: string; adherence: Adherence; note: string | null }>;
}> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/adherence?days=${days}`);
  const json = await readNutriJson(res);
  return json.data ?? { plan: null, checkins: [] };
}

// ---------------------------------------------------------------------------
// Nutri — context
// ---------------------------------------------------------------------------

export interface PatientMetabolism {
  score: number;
  status: 'low' | 'moderate' | 'high';
  trend: 'up' | 'down' | 'stable';
  trend7d?: { delta: number; direction: 'up' | 'down' | 'stable' };
  factors?: Array<{ name: string; impact: number }>;
  interpretation?: { hint: string; action: string } | null;
}

export interface PatientDailyCheckin {
  check_date: string;
  feeling?: 'energized' | 'neutral' | 'tired' | null;
  slept_well?: boolean | null;
  in_pain?: boolean | null;
  stressed?: boolean | null;
  notes?: string | null;
}

export async function fetchPatientContext(patientId: number): Promise<{
  hasMetabolicConsent: boolean;
  hasDailyConsent: boolean;
  metabolism?: PatientMetabolism | null;
  dailyCheckins?: PatientDailyCheckin[];
}> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/context`);
  const json = await readNutriJson(res);
  return json.data ?? { hasMetabolicConsent: false, hasDailyConsent: false };
}

// ---------------------------------------------------------------------------
// Nutri — observations
// ---------------------------------------------------------------------------

export async function fetchObservations(
  patientId: number,
  limit = 10,
  offset = 0
): Promise<{ rows: NutritionObservation[]; total: number }> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/observations?limit=${limit}&offset=${offset}`);
  const json = await readNutriJson(res);
  return { rows: json.data ?? [], total: json.meta?.total ?? 0 };
}

export async function createObservation(patientId: number, body: string): Promise<NutritionObservation> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  const json = await readNutriJson(res);
  return json.data;
}

// ---------------------------------------------------------------------------
// User (aluno) — active plan + checkin
// ---------------------------------------------------------------------------

export async function fetchMyNutritionPlan(): Promise<NutritionPlan | null> {
  const res = await authFetch(`${API_URL}/user/nutrition-plan`);
  const json = await readNutriJson(res);
  return json.data ?? null;
}

export async function fetchMyAdherenceHistory(days = 30): Promise<Array<{
  check_date: string;
  adherence: Adherence;
  note: string | null;
  plan_title: string;
  created_at: string;
}>> {
  const res = await authFetch(`${API_URL}/user/nutrition-adherence-checkins?days=${days}`);
  const json = await readNutriJson(res);
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// User (aluno) — meal timeline + per-meal check-in  (Onda A)
// ---------------------------------------------------------------------------

export interface MealTimeline {
  plan_id: number;
  title: string;
  objective: NutriObjective;
  general_notes: string | null;
  nutri_name: string;
  today: string;
  meals: MealTimelineEntry[];
  workoutToday: { title: string; muscleGroups: string[] } | null;
  streak: number;
}

export async function fetchMealTimeline(): Promise<MealTimeline | null> {
  const res = await authFetch(`${API_URL}/user/meals/today`);
  const json = await readNutriJson(res);
  return json.data ?? null;
}

export async function recordMealCheckin(
  mealId: number,
  data: {
    status: MealCheckinStatus;
    satiety?: number | null;
    hunger?: number | null;
    energy?: number | null;
    note?: string | null;
    substitutedAlternativeId?: number | null;
  }
): Promise<MealCheckinRecord> {
  const res = await authFetch(`${API_URL}/user/meals/${mealId}/checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await readNutriJson(res);
  return json.data;
}

// ---------------------------------------------------------------------------
// Nutri — meal heatmap  (Onda A)
// ---------------------------------------------------------------------------

export interface CanonicalAdherence {
  adherencePct: number | null;
  adherenceWindowDays: number;
  adherenceEffectiveDays: number;
  adherenceState: AdherenceState;
  streakDays: number;
  trend: AdherenceTrend | null;
}

export interface MealHeatmapData {
  plan: { id: number; title: string } | null;
  meals: Array<{ id: number; name: string; meal_time: string | null; order_index: number }>;
  checkins: Array<{ meal_id: number; check_date: string; status: MealCheckinStatus }>;
  /**
   * SPEC 035 — bloco canônico de verdade (o mesmo que alimenta a carteira).
   * `null` só quando não há plano ativo. A tela deve consumir ESTES campos
   * para o percentual/streak/tendência do cabeçalho — nunca recalcular a
   * partir de `checkins`, que é só o grid visual (pode vir em janela menor
   * no mobile sem afetar o número de verdade).
   */
  adherence: CanonicalAdherence | null;
}

export async function fetchMealHeatmap(patientId: number, days = 14): Promise<MealHeatmapData> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/meal-heatmap?days=${days}`);
  const json = await readNutriJson(res);
  return json.data ?? { plan: null, meals: [], checkins: [], adherence: null };
}

// ---------------------------------------------------------------------------
// Voice Notes (Spec 005)
// ---------------------------------------------------------------------------

export interface VoiceNote {
  id: string;
  nutriId: number;
  patientId: number;
  body: string;
  /** SPEC 035: id de `nutrition_plan_meals` (integer) — era uuid, tipo incompatível. */
  anchorMealId: number | null;
  publishedAt: string;
  readAt: string | null;
}

export interface NutriInsight {
  type: 'adherence_drop' | 'late_hunger' | 'ghost_meal' | 'silent_absence';
  label: string;
  detail: string;
}

export async function publishVoiceNote(
  patientId: number,
  body: string,
  anchorMealId?: number,
): Promise<VoiceNote> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/voice-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, anchorMealId }),
  });
  const json = await readNutriJson(res);
  return json.data as VoiceNote;
}

export async function listVoiceNotes(patientId: number): Promise<VoiceNote[]> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/voice-notes`);
  const json = await readNutriJson(res);
  return (json.data ?? []) as VoiceNote[];
}

export async function fetchPatientInsights(patientId: number): Promise<NutriInsight[]> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/insights`);
  const json = await readNutriJson(res);
  return (json.data ?? []) as NutriInsight[];
}

// Evolução metabólica do paciente (Spec 014) — read-only, consent-gated no backend.
export async function fetchPatientEvolution(patientId: number): Promise<MetabolicEvolutionPayload | null> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/evolution`);
  if (res.status === 401) return null;
  const json = await readNutriJson(res);
  return (json.data ?? null) as MetabolicEvolutionPayload | null;
}

// ---------------------------------------------------------------------------
// Perfil Clínico-Nutricional (Spec 019)
// ---------------------------------------------------------------------------

export type DietaryKind =
  | 'allergy'
  | 'intolerance'
  | 'restriction'
  | 'preference'
  | 'clinical_condition'
  | 'medication';

export type Severity = 'mild' | 'moderate' | 'severe';
export type PreferenceKind = 'like' | 'avoid';
export type AlertLevel = 'strong' | 'moderate' | 'info' | 'suggestion';

export const DIETARY_KIND_LABELS: Record<DietaryKind, string> = {
  allergy:            'Alergias',
  intolerance:        'Intolerâncias',
  restriction:        'Restrições alimentares',
  preference:         'Preferências e aversões',
  clinical_condition: 'Condições clínicas',
  medication:         'Medicamentos',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  mild:     'Leve',
  moderate: 'Moderada',
  severe:   'Grave',
};

export const PREFERENCE_LABELS: Record<PreferenceKind, string> = {
  like:  'Gosta',
  avoid: 'Evita',
};

export interface CatalogEntry {
  id: number;
  kind: DietaryKind;
  code: string;
  name: string;
  description: string | null;
}

export interface ProfileItem {
  id: number;
  kind: DietaryKind;
  label: string;
  catalogId: number | null;
  customLabel: string | null;
  severity: Severity | null;
  preferenceKind: PreferenceKind | null;
  notes: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface DietAlert {
  mealIndex: number;
  level: AlertLevel;
  kind: DietaryKind;
  label: string;
  matchedTerm: string;
}

export interface ProfileItemPayload {
  kind: DietaryKind;
  catalogId?: number | null;
  customLabel?: string | null;
  severity?: Severity | null;
  preferenceKind?: PreferenceKind | null;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export async function fetchDietaryCatalog(kind?: DietaryKind): Promise<CatalogEntry[]> {
  const qs = kind ? `?kind=${kind}` : '';
  const res = await authFetch(`${API_URL}/nutri/dietary-catalog${qs}`);
  const json = await readNutriJson(res);
  return json.data?.catalog ?? [];
}

export async function fetchClinicalProfile(patientId: number): Promise<{
  items: ProfileItem[];
  hasSevereAllergy: boolean;
}> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/clinical-profile`);
  const json = await readNutriJson(res);
  return json.data ?? { items: [], hasSevereAllergy: false };
}

export async function addClinicalProfileItem(
  patientId: number,
  payload: ProfileItemPayload,
): Promise<ProfileItem> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/clinical-profile/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await readNutriJson(res);
  return json.data.item;
}

export async function updateClinicalProfileItem(
  patientId: number,
  itemId: number,
  payload: ProfileItemPayload,
): Promise<ProfileItem> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/clinical-profile/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await readNutriJson(res);
  return json.data.item;
}

export async function deleteClinicalProfileItem(patientId: number, itemId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/clinical-profile/items/${itemId}`, {
    method: 'DELETE',
  });
  await readNutriJson(res);
}

export async function checkDietAgainstProfile(
  patientId: number,
  meals: Array<{ name?: string; orientation?: string; alternatives?: string[] }>,
): Promise<DietAlert[]> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/clinical-profile/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meals }),
  });
  const json = await readNutriJson(res);
  return json.data?.alerts ?? [];
}

export interface SubstitutionSuggestion {
  hasConflict: boolean;
  conflicts: Array<{ level: AlertLevel; kind: DietaryKind; label: string; matchedTerm: string }>;
  alternatives: Array<{ description: string; safe: boolean; conflictLabels: string[] }>;
  swapHints: string[];
}

// Fase 2 — motor de substituição assistida para uma refeição.
export async function suggestSubstitution(
  patientId: number,
  meal: { name?: string; orientation?: string; alternatives?: string[] },
): Promise<SubstitutionSuggestion> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/clinical-profile/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meal }),
  });
  const json = await readNutriJson(res);
  return json.data ?? { hasConflict: false, conflicts: [], alternatives: [], swapHints: [] };
}

// User (aluno) — Perfil Alimentar read-only
export async function fetchMyDietaryProfile(): Promise<{
  items: ProfileItem[];
  hasSevereAllergy: boolean;
}> {
  const res = await authFetch(`${API_URL}/user/dietary-profile`);
  const json = await readNutriJson(res);
  return json.data ?? { items: [], hasSevereAllergy: false };
}

export async function recordNutritionCheckin(adherence: Adherence, note?: string): Promise<NutritionCheckin> {
  const res = await authFetch(`${API_URL}/user/nutrition-adherence-checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adherence, note }),
  });
  const json = await readNutriJson(res);
  return json.data;
}
