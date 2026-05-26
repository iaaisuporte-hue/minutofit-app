import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';

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

export interface NutritionMeal {
  id: number;
  plan_id: number;
  name: string;
  orientation: string;
  order_index: number;
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

export interface PatientSummary {
  id: number;
  name: string;
  email: string;
  photo_url: string | null;
  academy_id: number | null;
  activePlan: { plan_id: number; title: string; started_at: string } | null;
  adherence7d: number;
  lastCheckinDate: string | null;
  riskFlag: boolean;
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
  const json = await parseJson(res);
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
  const json = await parseJson(res);
  return json.data ?? { active: null, history: [] };
}

export async function createNutritionPlan(
  patientId: number,
  data: {
    title: string;
    objective: NutriObjective;
    general_notes?: string;
    meals: Array<{ name: string; orientation: string; order_index: number }>;
  }
): Promise<NutritionPlan> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'Failed to create plan');
  return json.data;
}

export async function endNutritionPlan(patientId: number, planId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans/${planId}`, {
    method: 'DELETE',
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'Failed to end plan');
}

export async function updateNutritionPlan(
  patientId: number,
  planId: number,
  data: {
    title?: string;
    objective?: NutriObjective;
    general_notes?: string;
    meals?: Array<{ name: string; orientation: string; order_index: number }>;
  }
): Promise<NutritionPlan> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'Failed to update plan');
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
  const json = await parseJson(res);
  return json.data ?? { plan: null, checkins: [] };
}

// ---------------------------------------------------------------------------
// Nutri — context
// ---------------------------------------------------------------------------

export async function fetchPatientContext(patientId: number): Promise<{
  hasMetabolicConsent: boolean;
  hasDailyConsent: boolean;
  metabolism?: unknown;
  dailyCheckins?: unknown[];
}> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/context`);
  const json = await parseJson(res);
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
  const json = await parseJson(res);
  return { rows: json.data ?? [], total: json.meta?.total ?? 0 };
}

export async function createObservation(patientId: number, body: string): Promise<NutritionObservation> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'Failed to save observation');
  return json.data;
}

// ---------------------------------------------------------------------------
// User (aluno) — active plan + checkin
// ---------------------------------------------------------------------------

export async function fetchMyNutritionPlan(): Promise<NutritionPlan | null> {
  const res = await authFetch(`${API_URL}/user/nutrition-plan`);
  const json = await parseJson(res);
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
  const json = await parseJson(res);
  return json.data ?? [];
}

export async function recordNutritionCheckin(adherence: Adherence, note?: string): Promise<NutritionCheckin> {
  const res = await authFetch(`${API_URL}/user/nutrition-adherence-checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adherence, note }),
  });
  const json = await parseJson(res);
  if (!json.success) {
    const err = new Error(json.error ?? 'Failed to record checkin') as Error & { status?: number };
    if (res.status === 409) err.status = 409;
    throw err;
  }
  return json.data;
}
