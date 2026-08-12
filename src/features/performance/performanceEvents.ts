import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";

// Instrumentação do módulo Performance (Spec 033). Reaproveita o canal
// POST /user/events (allow-list no backend → data_access_audit). Fire-and-forget:
// analytics nunca bloqueia a UX nem lança erro para o usuário.
//
// A allow-list do backend só aceita os eventos que já existem de verdade —
// os de recorde, meta e upgrade entram com as ondas que os produzem.
export type PerformanceEventType = "performance.opened" | "performance.tab_viewed";

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
