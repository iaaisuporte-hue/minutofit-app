import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type UserWorkoutPlanItem = {
  exerciseId: string;
  name: string;
  sets: string;
  reps: string;
  rest: string;
  rpe?: string;
  cadence?: string;
  restPause?: boolean;
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
};

export async function fetchMyWorkoutPlans(limit = 20) {
  const response = await authFetch(`${API_URL}/personal/my/workout-plans?limit=${limit}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar suas fichas.");
  }
  return (data?.data || []) as UserWorkoutPlan[];
}
