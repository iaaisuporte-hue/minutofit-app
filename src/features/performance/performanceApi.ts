import * as Sentry from "@sentry/react";
import { API_URL, parseJson } from "../../services/apiBase";
import { authFetch } from "../../services/apiClient";
import { getAccessToken } from "../../services/authTokens";

// Módulo Performance (Spec 033). Segue o padrão dos demais *Api.ts: devolve
// null/[] em falha e reporta ao Sentry — a Evolução nunca quebra por causa de
// uma seção que não carregou.

export type ActiveDaySource = "session" | "log" | "personal";

export interface ActiveDay {
  /** 'YYYY-MM-DD' no fuso do aluno. */
  date: string;
  active: boolean;
  sources: ActiveDaySource[];
  setsDone: number | null;
  tonnageKg: number | null;
}

export interface ConsistencySummary {
  /** null = sem ficha ativa, portanto sem denominador. Nunca 0. */
  pct: number | null;
  activeDays28: number;
  targetPerWeek: number | null;
}

/**
 * Progress Score. A FORMA é a que a spec fixou; os VALORES chegam na P3.
 * Declarado agora para que a P3 seja aditiva — tipar como o literal `null`
 * faria todo `if (score)` compilar contra um `never`.
 */
export interface ScoreFactor {
  id: string;
  label: string;
  delta: number;
}

export interface ProgressScoreBlock {
  /** `null` em onboarding — sem histórico não se afirma número. */
  value: number | null;
  status: "onboarding" | "ok";
  trend: "up" | "stable" | "down";
  /** Breakdown: nunca vazio quando há `value`. */
  factors: ScoreFactor[];
  /** O que mudou vs. 7 dias atrás. Vazio quando não há comparação. */
  changes7d: ScoreFactor[];
  updatedAt: string;
  formulaVersion: number;
}

export interface TrainingLoadBlock {
  effortLoad7d: number | null;
  /** Faixa qualitativa, nunca a razão crua — não é métrica clínica. */
  ratioBand: "below" | "within" | "above" | "spike" | null;
  ratioLabel: string | null;
}

export interface PerformanceOverview {
  gated: boolean;
  freeSummary: { sessions30d: number; activeDays28: number; currentStreak: number };
  consistency: ConsistencySummary;
  score: ProgressScoreBlock | null;
  load: TrainingLoadBlock | null;
  /** Frase observacional do período. Nunca atribui causa. */
  headline: string;
}

export interface ScoreHistoryResponse {
  gated: boolean;
  points: { date: string; score: number }[];
}

/** Série do Progress Score. Só pontos reais — dia sem snapshot não vira zero. */
export async function getScoreHistory(
  days = 90,
  signal?: AbortSignal,
): Promise<ScoreHistoryResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/score/history?days=${days}`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as ScoreHistoryResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "score_history" } });
    return null;
  }
}

export async function getPerformanceOverview(signal?: AbortSignal): Promise<PerformanceOverview | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/overview`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as PerformanceOverview) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "overview" } });
    return null;
  }
}

// ── Recordes e progressão (P2) ─────────────────────────────────────────────

export type PrKind = "max_load" | "best_e1rm" | "session_volume" | "max_reps";

export interface PrRecord {
  /** `null` quando o exercício saiu do catálogo — o recorde continua valendo. */
  exerciseId: string | null;
  exerciseName: string;
  kind: PrKind;
  value: number;
  reps: number | null;
  loadKg: number | null;
  previousValue: number | null;
  /** Estreia da categoria: linha de base, não conquista. */
  isFirst: boolean;
  achievedAt: string;
  sessionId: number | null;
  exerciseInCatalog: boolean;
}

export interface PrRecordsResponse {
  gated: boolean;
  records: PrRecord[];
  events: PrRecord[];
}

export interface ProgressionPoint {
  date: string;
  maxLoadKg: number | null;
  bestE1rm: number | null;
  tonnageKg: number | null;
  topSetReps: number | null;
}

export interface ProgressionExercise {
  exerciseId: string;
  name: string;
  points: ProgressionPoint[];
  firstLoadKg: number | null;
  lastLoadKg: number | null;
  deltaKg: number | null;
  firstE1rm: number | null;
  lastE1rm: number | null;
  e1rmDeltaKg: number | null;
  pointCount: number;
}

export interface ProgressionResponse {
  gated: boolean;
  windowDays: number;
  exercises: ProgressionExercise[];
}

/** `null` distingue FALHA de "sem dados" — a UI mostra erro, não vazio. */
export async function getPrRecords(signal?: AbortSignal): Promise<PrRecordsResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/prs`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as PrRecordsResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "prs" } });
    return null;
  }
}

export async function getProgression(
  windowDays = 90,
  signal?: AbortSignal,
): Promise<ProgressionResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/progression?windowDays=${windowDays}`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as ProgressionResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "progression" } });
    return null;
  }
}

export async function getTrainingCalendar(
  month: string,
  signal?: AbortSignal,
): Promise<ActiveDay[]> {
  if (!getAccessToken()) return [];
  try {
    const res = await authFetch(`${API_URL}/performance/calendar?month=${encodeURIComponent(month)}`, { signal });
    if (!res.ok) return [];
    const data = await parseJson(res);
    return ((data?.data as { days?: ActiveDay[] })?.days) ?? [];
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return [];
    Sentry.captureException(err, { tags: { feature: "performance", reason: "calendar" } });
    return [];
  }
}


// ── Metas (Onda P4) ────────────────────────────────────────────────────────

export type GoalKind =
  | "exercise_load"
  | "exercise_e1rm"
  | "exercise_reps_at_load"
  | "weekly_frequency"
  | "monthly_frequency"
  | "streak";

export type GoalStatus = "active" | "achieved" | "abandoned" | "expired";

export interface Goal {
  id: string;
  kind: GoalKind;
  status: GoalStatus;
  /** Rótulo canônico, derivado no backend. Aluno e personal leem o mesmo texto. */
  displayLabel: string;
  exerciseId: string | null;
  /** Nome histórico: sobrevive à remoção do exercício do catálogo. */
  exerciseName: string | null;
  targetValue: number;
  targetReps: number | null;
  unit: string;
  progressUnit: string;
  baselineValue: number | null;
  currentValue: number | null;
  /** 0..1, ou `null` quando não há medição. Nunca NaN — o servidor garante. */
  progress: number | null;
  remaining: number | null;
  startsOn: string;
  dueOn: string | null;
  achievedAt: string | null;
  metricVersion: number;
  createdAt: string;
  monotonic: boolean;
}

export interface GoalsResponse {
  gated: boolean;
  goals: Goal[];
  activeCount: number;
  maxActive: number;
}

export async function getGoals(signal?: AbortSignal): Promise<GoalsResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/goals`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as GoalsResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "goals" } });
    return null;
  }
}

export interface CreateGoalInput {
  kind: GoalKind;
  exerciseId?: string | null;
  targetValue: number;
  targetReps?: number | null;
  dueOn?: string | null;
}

/**
 * Cria a meta.
 *
 * Diferente das leituras do módulo, aqui o erro NÃO vira `null` silencioso: o
 * aluno acabou de agir e precisa saber por que não deu — em especial "você já
 * está nesse patamar", que é orientação, não falha.
 */
export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const res = await authFetch(`${API_URL}/performance/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Não foi possível criar a meta.");
  return data.data as Goal;
}

/** Abandona a meta. Não apaga — o histórico do aluno é preservado. */
export async function abandonGoal(goalId: string): Promise<Goal> {
  const res = await authFetch(`${API_URL}/performance/goals/${goalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "abandoned" }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Não foi possível abandonar a meta.");
  return data.data as Goal;
}
