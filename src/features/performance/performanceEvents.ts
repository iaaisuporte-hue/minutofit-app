import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";

// Instrumentação do módulo Performance (Spec 033). Reaproveita o canal
// POST /user/events (allow-list no backend → data_access_audit). Fire-and-forget:
// analytics nunca bloqueia a UX nem lança erro para o usuário.
//
// A allow-list do backend só aceita os eventos que já existem de verdade.
// O payload leva só identificador e contagem: nada de nome de exercício do
// usuário, nada de informação de saúde — o evento mede adoção, não conteúdo.
export type PerformanceEventType =
  | "performance.opened"
  | "performance.tab_viewed"
  | "performance.progression_viewed"
  | "performance.exercise_selected"
  | "performance.prs_viewed"
  | "performance.pr_celebrated"
  | "performance.upgrade_cta_clicked"
  | "performance.score_viewed"
  | "performance.score_component_opened"
  | "performance.score_history_viewed"
  | "performance.goal_created"
  | "performance.goal_viewed"
  | "performance.goal_completed"
  | "performance.goal_cancelled"
  // Onda P5 — visão do personal.
  | "personal.performance_opened"
  | "personal.performance_insight_opened"
  | "personal.performance_ai_summary_requested"
  | "personal.performance_ai_summary_shown";

export function postPerformanceEvent(
  eventType: PerformanceEventType,
  payload: Record<string, unknown> = {},
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    // best-effort; evento perdido não afeta o usuário
  });
}
