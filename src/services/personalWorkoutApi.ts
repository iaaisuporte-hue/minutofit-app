import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type WorkoutPlanItem = {
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

export type WorkoutPlanDay = {
  index: number;
  name: string;
  focus: string | null;
  items: WorkoutPlanItem[];
};

export type PersonalWorkoutPlanRow = {
  id: number;
  personal_id: number;
  student_id: number;
  title: string;
  week_preset: string;
  selected_group: string | null;
  /** @deprecated kept for legacy reads; use `days` instead */
  payload_json: WorkoutPlanItem[];
  days: WorkoutPlanDay[];
  created_at: string;
  updated_at: string;
};

export async function fetchPersonalWorkoutPlans(studentId: string, limit = 50) {
  const response = await authFetch(`${API_URL}/personal/students/${studentId}/workout-plans?limit=${limit}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar as fichas.");
  }
  return (data?.data || []) as PersonalWorkoutPlanRow[];
}

export type CreateWorkoutPlanBody =
  | {
      title: string;
      weekPreset: string;
      days: Array<{ name: string; focus?: string | null; items: WorkoutPlanItem[] }>;
    }
  | {
      title: string;
      weekPreset: string;
      selectedGroup: string | null;
      items: WorkoutPlanItem[];
    };

export async function createPersonalWorkoutPlan(
  studentId: string,
  body: CreateWorkoutPlanBody
) {
  const response = await authFetch(`${API_URL}/personal/students/${studentId}/workout-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel salvar a ficha.");
  }
  return data?.data as PersonalWorkoutPlanRow;
}
