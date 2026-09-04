import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

/**
 * Instrumentação da execução do treino (SPEC P1 §51/§52).
 *
 * Reaproveita o canal que já existe — `POST /user/events`, allow-list no
 * backend, gravação em `data_access_audit`. Nenhum SDK novo, como a §51 pede.
 *
 * **O que estes eventos NÃO carregam**, e isso é regra, não descuido: carga,
 * repetições, nome de exercício, dor, RPE, peso corporal ou qualquer sinal do
 * corpo. Eles medem o USO da tela — começou, concluiu, abandonou, quanto
 * tempo, quantas séries — que é o que as perguntas do §52 exigem. O pacto de
 * dados do produto ("existe para proteger seus sinais biológicos, não para
 * explorar sua atenção") não abre exceção para analytics de produto.
 *
 * Fire-and-forget: analytics nunca bloqueia nem atrasa quem está treinando.
 */
export type WorkoutEventType =
  | "workout.started"
  | "workout.completed"
  | "workout.abandoned"
  | "workout.resumed"
  | "workout.set_completed"
  | "workout.exercise_skipped"
  | "workout.exercise_reordered"
  // Execução dinâmica: o aluno troca, desfaz, acrescenta e remove exercício
  // durante a sessão. Medem a MUDANÇA, nunca o que entrou no lugar do quê.
  | "workout.exercise_substituted"
  | "workout.substitution_undone"
  | "workout.exercise_added"
  | "workout.exercise_removed"
  // Lembrete de treino não finalizado. Medem se o mecanismo funciona — quantas
  // sessões chegam a ser lembradas e quantas voltam pelo toque — e nada sobre o
  // treino em si.
  | "workout.reminder_scheduled"
  | "workout.reminder_opened"
  | "workout.free_started"
  | "workout.repeat_started"
  | "workout.share_opened";

/** Campos permitidos. Tipado para que um dado sensível não entre por descuido. */
export interface WorkoutEventPayload {
  /** "plan" | "free" — origem da sessão. */
  mode?: "plan" | "free";
  /** Duração até o evento, em segundos. */
  durationS?: number;
  /** Contagens agregadas da sessão. */
  setsDone?: number;
  totalSets?: number;
  exercisesDone?: number;
  totalExercises?: number;
  /** Quantos exercícios ficaram sem nenhuma série (§33). */
  pendingExercises?: number;
  /** Concluiu offline e ficou para sincronizar. */
  offline?: boolean;
  /**
   * A substituição veio com motivo? Booleano de propósito: saber QUANTAS trocas
   * são justificadas responde se a pergunta vale a fricção; o motivo em si é
   * conversa entre aluno e personal, e vai no registro da série, não no evento.
   */
  hadReason?: boolean;
}

export function postWorkoutEvent(
  eventType: WorkoutEventType,
  payload: WorkoutEventPayload = {},
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    // best-effort; evento perdido não afeta o usuário
  });
}
