import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

/**
 * Instrumentação de Aderência, Recorrência e Insights do Personal (Sprint P2B).
 *
 * Mesmo canal genérico de `personalExerciseEvents.ts`/`performanceEvents.ts`
 * (`POST /api/user/events`, allow-list no backend em `ALLOWED_FRONTEND_EVENTS`,
 * gravação em `data_access_audit`) — não existe rota de eventos própria do
 * módulo Personal. Fire-and-forget: telemetria nunca bloqueia quem está
 * revendo a ficha do aluno.
 *
 * Payload é só flags/contagens — SEM nome de exercício, motivo textual livre
 * ou qualquer conteúdo do insight (mesmo pacto de dados das demais
 * instrumentações do produto).
 */
export type PersonalInsightsEventType =
  | "personal_adherence_viewed"
  | "personal_exercise_insight_viewed"
  | "personal_recurring_replacement_viewed"
  | "personal_plan_review_started"
  | "personal_plan_review_cancelled"
  | "personal_plan_updated_from_insight";

export function trackPersonalInsightsEvent(
  eventType: PersonalInsightsEventType,
  payload: Record<string, unknown> = {},
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    // best-effort; evento perdido não afeta o personal
  });
}
