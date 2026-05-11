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

export type PersonalWorkoutPlanRow = {
  id: number;
  personal_id: number;
  student_id: number;
  title: string;
  week_preset: string;
  selected_group: string | null;
  payload_json: WorkoutPlanItem[];
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

export async function createPersonalWorkoutPlan(
  studentId: string,
  body: {
    title: string;
    weekPreset: string;
    selectedGroup: string | null;
    items: WorkoutPlanItem[];
  }
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
