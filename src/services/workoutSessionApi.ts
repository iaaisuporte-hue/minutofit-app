import * as Sentry from "@sentry/react";
import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

// Execução real do treino (Spec 010). Best-effort: NUNCA quebra a conclusão do
// treino — se falhar, registra no Sentry e segue. O streak/XP continua no
// fluxo de gamificação; esta chamada é aditiva (histórico estruturado).

export interface PrescribedItem {
  exerciseId?: string | null;
  name: string;
  sets?: string;
  reps?: string;
  rest?: string;
  loadKg?: number | null;
}

export interface CreateWorkoutSessionPayload {
  source: "personal" | "suggested" | "academy" | "free";
  status: "started" | "completed" | "partial" | "abandoned";
  title?: string;
  planId?: number | null;
  dayIndex?: number | null;
  sessionRpe?: number | null;
  notes?: string | null;
  prescribed?: PrescribedItem[];
  sets?: unknown[];
  /**
   * Quando true (status completed/partial), o SERVIDOR grava o log raso + XP/
   * streak na mesma transação (P0-1). Substitui a 2ª chamada a
   * /gamification/checkins — não combinar com persistGamificationCheckin no
   * mesmo evento, sob pena de dupla contagem.
   */
  awardGamification?: boolean;
  muscleGroups?: string[];
}

export interface CreateWorkoutSessionResult {
  id: number;
  startedAt: string;
  setCount: number;
  /** Preenchidos só quando awardGamification=true; senão null. */
  streak: number | null;
  xp: number | null;
}

export interface ExerciseProgression {
  exerciseId: string;
  name: string;
  firstLoadKg: number;
  lastLoadKg: number;
  deltaKg: number;
  points: { date: string; maxLoadKg: number }[];
}

export interface WorkoutStats {
  totalSessions: number;
  thisWeek: number;
  last30Days: number;
  exerciseProgression: ExerciseProgression[];
}

export async function getWorkoutStats(): Promise<WorkoutStats | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/training/stats`);
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as WorkoutStats) ?? null;
  } catch {
    return null;
  }
}

export async function createWorkoutSession(
  payload: CreateWorkoutSessionPayload,
): Promise<CreateWorkoutSessionResult | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/training/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      Sentry.captureMessage("workout_session.failed.http", {
        level: "warning",
        tags: { feature: "workout_session", source: payload.source, status: String(res.status) },
      });
      return null;
    }
    const data = await parseJson(res);
    return (data?.data as CreateWorkoutSessionResult) ?? null;
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "workout_session", reason: "network" } });
    return null;
  }
}
