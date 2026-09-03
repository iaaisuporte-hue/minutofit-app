import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";

/**
 * Instrumentação da prontidão (SPEC Mobile P3 §71, §72).
 *
 * A §71 é explícita: **não enviar health data bruto para analytics**. O payload
 * é fechado e carrega só estado, confiança e modo — nunca score exato, nunca
 * sono, dor, HRV ou qualquer componente. O estado responde às perguntas do §72
 * (quantos consultam, quantos seguem a recomendação) sem transformar a
 * telemetria num prontuário.
 */
export type ReadinessEventType =
  | "readiness_viewed"
  | "readiness_details_opened"
  | "daily_checkin_started"
  | "daily_checkin_completed"
  | "recommendation_accepted"
  | "recommendation_ignored"
  | "workout_adjustment_opened";

export interface ReadinessEventPayload {
  state?: string;
  confidence?: string;
  mode?: string;
  recommendation?: string;
}

export function postReadinessEvent(
  eventType: ReadinessEventType,
  payload: ReadinessEventPayload = {},
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    /* best-effort */
  });
}
