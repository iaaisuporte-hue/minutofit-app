import { API_URL, parseJson } from "../../services/apiBase";
import { authFetch } from "../../services/apiClient";
import { getAccessToken } from "../../services/authTokens";
import * as Sentry from "@sentry/react";

/**
 * Cliente do S2CORE Readiness (SPEC Mobile P3 §57).
 *
 * Gateado por feature flag no servidor. 403 aqui não é erro: é a flag desligada
 * para este usuário, e a UI simplesmente não mostra a seção. Distinguir os dois
 * casos importa — esconder por falha e esconder por rollout parecem iguais na
 * tela e são coisas diferentes no log.
 */

export type ReadinessState =
  | "ready_intense" | "ready" | "moderate" | "light" | "recover" | "calibrating";

export type Recommendation =
  | "INTENSE" | "NORMAL" | "MODERATE" | "LIGHT" | "RECOVERY" | "CHECKIN_FIRST";

export type Confidence = "high" | "medium" | "low";

export interface ReadinessReason {
  id: string;
  label: string;
  direction: "positive" | "negative" | "neutral";
  severity: "info" | "caution" | "block";
}

export interface MuscleGroupState {
  group: string;
  label: string;
  recovery: number;
  state: "recovered" | "partial" | "recovering";
}

export interface ReadinessToday {
  date: string;
  /** null = não dá para afirmar (cold start ou sem dado). Nunca exibir como 0. */
  score: number | null;
  state: ReadinessState;
  recommendation: Recommendation;
  confidence: Confidence;
  dataCompleteness: number;
  mode: "cold_start" | "building" | "established";
  headline: string;
  microcopy: string;
  reasons: ReadinessReason[];
  muscleRecovery: MuscleGroupState[];
  algorithmVersion: string;
}

/** `null` = indisponível (flag off, sem sessão, ou falha). A UI oculta a seção. */
export async function getReadinessToday(groups?: string[]): Promise<ReadinessToday | null> {
  if (!getAccessToken()) return null;
  try {
    const q = groups?.length ? `?groups=${encodeURIComponent(groups.join(","))}` : "";
    const res = await authFetch(`${API_URL}/readiness/today${q}`);
    // 403 = flag desligada para este usuário. Silencioso de propósito.
    if (res.status === 403) return null;
    if (!res.ok) {
      Sentry.captureMessage("readiness.failed.http", {
        level: "warning",
        tags: { feature: "readiness", status: String(res.status) },
      });
      return null;
    }
    const data = await parseJson(res);
    const d = data?.data as Record<string, unknown> | null;
    if (!d) return null;
    return {
      date: String(d.date ?? ""),
      score: d.score == null ? null : Number(d.score),
      state: d.state as ReadinessState,
      recommendation: d.recommendation as Recommendation,
      confidence: d.confidence as Confidence,
      dataCompleteness: Number(d.data_completeness ?? 0),
      mode: d.mode as ReadinessToday["mode"],
      headline: String(d.headline ?? ""),
      microcopy: String(d.microcopy ?? ""),
      reasons: (d.reasons as ReadinessReason[]) ?? [],
      muscleRecovery: (d.muscle_recovery as MuscleGroupState[]) ?? [],
      algorithmVersion: String(d.algorithm_version ?? ""),
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "readiness", reason: "network" } });
    return null;
  }
}

/** Feedback pós-treino (§46). Fire-and-forget: nunca bloqueia o resumo. */
export function postEffortFeedback(
  perceived: "very_light" | "light" | "adequate" | "hard" | "very_hard",
  sessionId?: number | null,
): void {
  authFetch(`${API_URL}/readiness/effort-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ perceived, sessionId: sessionId ?? null }),
  }).catch(() => {
    /* insumo de calibração futura; perder um não afeta o usuário */
  });
}
