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
}

export async function createWorkoutSession(payload: CreateWorkoutSessionPayload) {
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
    return data?.data ?? null;
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "workout_session", reason: "network" } });
    return null;
  }
}
