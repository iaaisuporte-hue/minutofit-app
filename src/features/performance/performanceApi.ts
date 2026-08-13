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
export interface ProgressScoreBlock {
  value: number | null;
  status: "onboarding" | "ok";
  trend: string;
  factors: { id: string; label: string; delta: number }[];
  changes7d: { id: string; label: string; delta: number }[];
}

export interface TrainingLoadBlock {
  effortLoad7d: number | null;
  /** Faixa qualitativa, nunca número cru — não é métrica clínica. */
  ratioBand: string | null;
}

export interface PerformanceOverview {
  gated: boolean;
  freeSummary: { sessions30d: number; activeDays28: number; currentStreak: number };
  consistency: ConsistencySummary;
  /** `null` até a Onda P3. */
  score: ProgressScoreBlock | null;
  /** `null` até a Onda P3. */
  load: TrainingLoadBlock | null;
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
