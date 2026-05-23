import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import type { TechniqueConfig } from "../features/training/techniques/technique.types";

export type UserWorkoutPlanItem = {
  exerciseId: string;
  name: string;
  sets: string;
  reps: string;
  rest: string;
  rpe?: string;
  cadence?: string;
  restPause?: boolean;
  technique?: TechniqueConfig;
  notes?: string;
};

export type UserWorkoutPlanDay = {
  index: number;
  name: string;
  focus: string | null;
  items: UserWorkoutPlanItem[];
};

export type UserWorkoutPlan = {
  id: number;
  personal_id: number;
  student_id: number;
  title: string;
  week_preset: string;
  selected_group: string | null;
  /** @deprecated legacy; use `days` instead */
  payload_json: UserWorkoutPlanItem[];
  days: UserWorkoutPlanDay[];
  created_at: string;
  updated_at: string;
  /** Quando preenchido, o aluno abandonou a ficha. Só o personal pode reativar/excluir. */
  abandoned_at?: string | null;
};

export async function fetchMyWorkoutPlans(limit = 20) {
  const response = await authFetch(`${API_URL}/personal/my/workout-plans?limit=${limit}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar suas fichas.");
  }
  return (data?.data || []) as UserWorkoutPlan[];
}

/**
 * Aluno abandona uma ficha. Some da listagem dele mas continua existindo
 * (só o personal pode excluir ou reativar).
 */
export async function abandonMyWorkoutPlan(planId: number): Promise<void> {
  const response = await authFetch(`${API_URL}/user/workout-plans/${planId}/abandon`, {
    method: "POST",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel abandonar a ficha.");
  }
}
