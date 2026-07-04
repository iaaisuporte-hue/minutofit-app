import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

// Instrumentação do beta do Lab de Movimento. Reaproveita o canal POST /user/events
// (allow-list no backend → data_access_audit). Fire-and-forget: analytics nunca
// bloqueia a UX nem lança erro para o usuário.
export type LabEventType =
  | "movement_lab.opened"
  | "movement_lab.camera_error"
  | "movement_lab.session_completed"
  | "movement_lab.feedback_submitted";

export function postLabEvent(
  eventType: LabEventType,
  payload: Record<string, unknown> = {}
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    // best-effort; evento perdido não afeta o usuário
  });
}
