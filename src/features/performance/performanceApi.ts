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
