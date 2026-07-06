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
  /**
   * Registro retroativo (Spec 024): data real do treino, 'YYYY-MM-DD'. Presença
   * ativa o modo retro no backend (source vira 'user_retroactive'). Exige
   * `confirmedHonesty: true` quando a data é anterior a hoje.
   */
  performedAt?: string;
  confirmedHonesty?: boolean;
  retroactiveReason?: string;
}

export interface CreateWorkoutSessionResult {
  id: number;
  startedAt: string;
  /** Data real do treino (= startedAt no retro). */
  performedAt?: string;
  isRetroactive?: boolean;
  /** true quando o registro contou para o streak (hoje ou D-1). */
  countedForStreak?: boolean;
  setCount: number;
  /** Preenchidos só quando awardGamification=true e contou streak; senão null. */
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

export type WorkoutSessionStatus = "started" | "completed" | "partial" | "abandoned";
export type WorkoutSessionSource = "personal" | "suggested" | "academy" | "free" | "movement_lab" | "user_retroactive";
export type ReadinessLevel = "green" | "yellow" | "red";

export interface WorkoutSessionListItem {
  id: number;
  source: WorkoutSessionSource;
  planId: number | null;
  dayIndex: number | null;
  readinessLevel: ReadinessLevel | null;
  status: WorkoutSessionStatus;
  sessionRpe: number | null;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Data real do treino (retro usa performed_at). Fallback = startedAt. */
  performedAt: string;
  isRetroactive: boolean;
  setsDone: number;
}

export interface WorkoutSetLogRow {
  exerciseName: string;
  orderIndex: number;
  setIndex: number;
  plannedReps: string | null;
  repsDone: number | null;
  loadDoneKg: number | null;
  rpe: number | null;
  discomfort: string | null;
  status: "done" | "skipped";
}

export interface WorkoutSessionDetail extends WorkoutSessionListItem {
  notes: string | null;
  sets: WorkoutSetLogRow[];
}

// pg devolve NUMERIC como string; coagimos com tolerância.
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapListItem(r: Record<string, unknown>): WorkoutSessionListItem {
  return {
    id: Number(r.id),
    source: r.source as WorkoutSessionSource,
    planId: r.plan_id == null ? null : Number(r.plan_id),
    dayIndex: r.day_index == null ? null : Number(r.day_index),
    readinessLevel: (r.readiness_level as ReadinessLevel | null) ?? null,
    status: r.status as WorkoutSessionStatus,
    sessionRpe: num(r.session_rpe),
    title: (r.title as string | null) ?? null,
    startedAt: String(r.started_at),
    endedAt: r.ended_at == null ? null : String(r.ended_at),
    performedAt: String(r.performed_at ?? r.started_at),
    isRetroactive: r.is_retroactive === true,
    setsDone: Number(r.sets_done ?? 0),
  };
}

export async function listWorkoutSessions(limit = 30): Promise<WorkoutSessionListItem[]> {
  if (!getAccessToken()) return [];
  try {
    const res = await authFetch(`${API_URL}/training/sessions?limit=${limit}`);
    if (!res.ok) return [];
    const data = await parseJson(res);
    const rows = (data?.data as Record<string, unknown>[]) ?? [];
    return rows.map(mapListItem);
  } catch {
    return [];
  }
}

export async function getWorkoutSessionDetail(id: number): Promise<WorkoutSessionDetail | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/training/sessions/${id}`);
    if (!res.ok) return null;
    const data = await parseJson(res);
    const d = data?.data as Record<string, unknown> | null;
    if (!d) return null;
    const setsRaw = (d.sets as Record<string, unknown>[]) ?? [];
    return {
      ...mapListItem(d),
      notes: (d.notes as string | null) ?? null,
      sets: setsRaw.map((s) => ({
        exerciseName: String(s.exercise_name ?? "—"),
        orderIndex: Number(s.order_index ?? 0),
        setIndex: Number(s.set_index ?? 1),
        plannedReps: (s.planned_reps as string | null) ?? null,
        repsDone: num(s.reps_done),
        loadDoneKg: num(s.load_done_kg),
        rpe: num(s.rpe),
        discomfort: (s.discomfort as string | null) ?? null,
        status: s.status === "skipped" ? "skipped" : "done",
      })),
    };
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

export type CreateSessionOutcome =
  | { ok: true; data: CreateWorkoutSessionResult }
  | { ok: false; errorCode: string; status: number };

/**
 * Variante do createWorkoutSession que PRESERVA o código de erro do backend —
 * o registro retroativo (Spec 024) precisa distinguir janela excedida, limite de
 * frequência (429) e feature desligada (403) para dar a mensagem certa ao aluno.
 * A createWorkoutSession original (que devolve null) segue intacta para o fluxo ao vivo.
 */
export async function createWorkoutSessionWithError(
  payload: CreateWorkoutSessionPayload,
): Promise<CreateSessionOutcome> {
  if (!getAccessToken()) return { ok: false, errorCode: "unauthenticated", status: 401 };
  try {
    const res = await authFetch(`${API_URL}/training/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJson(res).catch(() => null);
    if (!res.ok) {
      // `code` (feature gate) tem precedência sobre `error` (que pode ser mensagem livre).
      const errorCode = (data?.code as string) || (data?.error as string) || "request_failed";
      return { ok: false, errorCode, status: res.status };
    }
    const result = (data?.data as CreateWorkoutSessionResult) ?? null;
    if (!result) return { ok: false, errorCode: "empty_response", status: res.status };
    return { ok: true, data: result };
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "retro_workout", reason: "network" } });
    return { ok: false, errorCode: "network_error", status: 0 };
  }
}
