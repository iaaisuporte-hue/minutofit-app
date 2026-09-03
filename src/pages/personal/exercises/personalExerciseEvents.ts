import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

/**
 * Instrumentação da Biblioteca de Exercícios Personalizados do Personal
 * (Sprint P1_PERSONAL_CUSTOM_EXERCISES).
 *
 * Mesmo canal genérico de `workoutEvents.ts` (`POST /api/user/events`,
 * allow-list no backend, gravação em `data_access_audit`) — o personal
 * também autentica contra `authMiddleware` e cai neste endpoint, não existe
 * rota de eventos própria do módulo Personal. Fire-and-forget: telemetria
 * nunca bloqueia quem está gerindo a biblioteca.
 *
 * Payload é só flags/contagens — SEM nome ou descrição do exercício, mesmo
 * pacto de dados do `workoutEvents.ts`.
 */
export type PersonalExerciseEventType =
  | "personal_custom_exercise_create_started"
  | "personal_custom_exercise_created"
  | "personal_custom_exercise_edited"
  | "personal_custom_exercise_archived"
  | "personal_custom_exercise_added_to_plan";

export function trackPersonalExerciseEvent(eventType: PersonalExerciseEventType): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload: {} }),
  }).catch(() => {
    // best-effort; evento perdido não afeta o personal
  });
}
