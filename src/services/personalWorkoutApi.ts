import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import type { TechniqueConfig } from "../features/training/techniques/technique.types";

export type WorkoutPlanItem = {
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
  source_protocol_id: number | null;
  /** @deprecated kept for legacy reads; use `days` instead */
  payload_json: WorkoutPlanItem[];
  days: WorkoutPlanDay[];
  created_at: string;
  updated_at: string;
  /** Preenchido quando o aluno abandonou — personal vê com badge "Abandonada" e pode reativar. */
  abandoned_at?: string | null;
};

export interface StudentTrainingSummary {
  adherencePct: number | null;
  last7d: number;
  total: number;
  sessions: {
    id: number;
    /** Data real do treino (retro usa performed_at). */
    date: string;
    /** Quando o registro foi feito no sistema — desambigua o retroativo (Spec 024). */
    createdAt?: string;
    /** true quando o aluno registrou após o dia do treino — NÃO é tempo real. */
    isRetroactive?: boolean;
    status: string;
    source: string;
    readinessLevel: string | null;
    setsDone: number;
    prescribedSets: number;
    /** Movimentos em que o aluno relatou desconforto/dor nesta sessão (P1-3). */
    discomfortExercises: string[];
  }[];
}

/** Resumo de execução do aluno p/ o cockpit (Spec 010). null se sem acesso/erro. */
export async function fetchStudentTrainingSummary(studentId: string): Promise<StudentTrainingSummary | null> {
  try {
    const response = await authFetch(`${API_URL}/personal/students/${studentId}/training-summary`);
    if (!response.ok) return null;
    const data = await parseJson(response);
    return (data?.data as StudentTrainingSummary) ?? null;
  } catch {
    return null;
  }
}

export async function fetchPersonalWorkoutPlans(studentId: string, limit = 50) {
  const response = await authFetch(`${API_URL}/personal/students/${studentId}/workout-plans?limit=${limit}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar as fichas.");
  }
  return (data?.data || []) as PersonalWorkoutPlanRow[];
}

/**
 * Personal reativa uma ficha que o aluno tinha abandonado — ela volta a
 * aparecer na listagem do aluno.
 */
export async function reactivateWorkoutPlan(studentId: string | number, planId: number): Promise<void> {
  const response = await authFetch(
    `${API_URL}/personal/students/${studentId}/workout-plans/${planId}/reactivate`,
    { method: "POST" }
  );
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel reativar a ficha.");
  }
}

export type CreateWorkoutPlanBody =
  | {
      title: string;
      weekPreset: string;
      days: Array<{ name: string; focus?: string | null; items: WorkoutPlanItem[] }>;
      sourceProtocolId?: number | null;
    }
  | {
      title: string;
      weekPreset: string;
      selectedGroup: string | null;
      items: WorkoutPlanItem[];
      sourceProtocolId?: number | null;
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

export type UpdateWorkoutPlanBody = {
  title: string;
  weekPreset: string;
  days: Array<{ name: string; focus?: string | null; items: WorkoutPlanItem[] }>;
};

export async function updatePersonalWorkoutPlan(
  studentId: string,
  planId: number,
  body: UpdateWorkoutPlanBody
) {
  const response = await authFetch(
    `${API_URL}/personal/students/${studentId}/workout-plans/${planId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel atualizar a ficha.");
  }
  return data?.data as PersonalWorkoutPlanRow;
}
