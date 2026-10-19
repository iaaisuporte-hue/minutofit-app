/**
 * Spec 039 — metas diárias do paciente. Uma linha no banco
 * (`nutrition_patient_goals`) lida pelo aluno (`/user/nutrition-goals`) e
 * lida/gravada pelo nutri (`/nutri/patients/:id/nutrition-goals`). Nenhum
 * estado local é fonte: após salvar, a tela usa o que o servidor devolveu.
 */
import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';
import { NutriApiError, type NutriObjective } from './nutriApi';

export interface NutritionGoalsInput {
  energyKcal: number | null;
  proteinMinG: number | null;
  proteinMaxG: number | null;
  fiberMinG: number | null;
  fiberMaxG: number | null;
  /** Mililitros — a UI converte de/para litros. */
  waterMinMl: number | null;
  waterMaxMl: number | null;
  objectives: NutriObjective[];
  patientNote: string | null;
}

export interface NutritionGoals extends NutritionGoalsInput {
  updatedAt: string;
  updatedByName: string | null;
}

/** 400 do backend nomeia o campo — o editor destaca exatamente ele. */
export class NutritionGoalsApiError extends NutriApiError {
  field: string | null;

  constructor(status: number, code: string, field: string | null) {
    super(status, code);
    this.name = 'NutritionGoalsApiError';
    this.field = field;
  }
}

type GoalsEnvelope = { success?: boolean; error?: unknown; field?: unknown; data?: { goals?: NutritionGoals | null } };

async function readGoalsJson(res: Response): Promise<GoalsEnvelope> {
  const json = (await parseJson(res)) as GoalsEnvelope | null;
  if (!res.ok || json?.success === false) {
    const code = typeof json?.error === 'string' ? json.error : `http_${res.status}`;
    throw new NutritionGoalsApiError(res.status, code, typeof json?.field === 'string' ? json.field : null);
  }
  return json ?? {};
}

export async function getMyNutritionGoals(): Promise<NutritionGoals | null> {
  const res = await authFetch(`${API_URL}/user/nutrition-goals`);
  const json = await readGoalsJson(res);
  return json.data?.goals ?? null;
}

export async function fetchPatientNutritionGoals(patientId: number): Promise<NutritionGoals | null> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-goals`);
  const json = await readGoalsJson(res);
  return json.data?.goals ?? null;
}

export async function savePatientNutritionGoals(patientId: number, input: NutritionGoalsInput): Promise<NutritionGoals> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/nutrition-goals`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readGoalsJson(res);
  if (!json.data?.goals) throw new NutritionGoalsApiError(res.status, 'empty_response', null);
  return json.data.goals;
}
