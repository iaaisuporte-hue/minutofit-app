import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

// Instrumentação do registro retroativo de treino (Spec 024). Reaproveita o canal
// POST /user/events (allow-list no backend → data_access_audit). Fire-and-forget:
// analytics nunca bloqueia a UX nem lança erro para o usuário.
export type RetroWorkoutEventType =
  | "retro_workout.opened"
  | "retro_workout.date_selected"
  | "retro_workout.submitted"
  | "retro_workout.blocked_over_limit";

export function postRetroEvent(
  eventType: RetroWorkoutEventType,
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
