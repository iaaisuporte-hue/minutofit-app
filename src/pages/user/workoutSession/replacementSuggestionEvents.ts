import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

/**
 * Instrumentação do Motor de Substituições Inteligentes (Sprint P2A).
 *
 * Mesmo canal genérico de `workoutEvents.ts`/`personalExerciseEvents.ts`
 * (`POST /api/user/events`, allow-list no backend, gravação em
 * `data_access_audit`). Módulo próprio em vez de estender
 * `WorkoutEventType`: o payload aqui fala de RANKING de sugestão (tier,
 * posição, contagem), não de execução de treino — misturar os dois faria o
 * union de `workoutEvents.ts` carregar campos que não fazem sentido para
 * "workout.*".
 *
 * Payload é só flags/contagens — NUNCA nome de exercício, motivo textual
 * livre ou dor (mesmo pacto de dados das demais instrumentações).
 * Fire-and-forget: analytics nunca atrasa quem está trocando de exercício.
 */
export type ReplacementSuggestionEventType =
  | "replacement_suggestions_opened"
  | "replacement_suggestion_impression"
  | "replacement_suggestion_selected"
  | "replacement_suggestion_ignored"
  | "replacement_manual_search_selected"
  | "replacement_suggestions_empty"
  | "replacement_suggestions_error";

export interface ReplacementSuggestionEventPayload {
  /** Quantas sugestões chegaram (impressão) ou eram exibidas (ignorado). */
  count?: number;
  /** D8 — o motivo suprimiu os rótulos de confiança nesta chamada. */
  cautionAdvisory?: boolean;
  /** Origem da sugestão escolhida. */
  tier?: "PERSONAL_DEFINED" | "HEURISTIC";
  /** Posição na lista (0 = topo) da sugestão escolhida. */
  position?: number;
  /** A sugestão escolhida trazia o selo de histórico (D6). */
  usedBeforeBadge?: boolean;
  /** Havia sugestão na tela quando o aluno foi para a busca manual mesmo assim. */
  hadSuggestions?: boolean;
}

export function trackReplacementSuggestionEvent(
  eventType: ReplacementSuggestionEventType,
  payload: ReplacementSuggestionEventPayload = {},
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    // best-effort; evento perdido não afeta quem está treinando
  });
}
