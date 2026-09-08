import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";

/**
 * Instrumentação do Voice Workout (P5A — mesmo canal e mesma regra de
 * `workoutEvents.ts`).
 *
 * **O que estes eventos NÃO carregam, e isso é regra, não descuido:**
 * transcript, carga, repetições, nome de exercício, observação ou qualquer
 * conteúdo de fala. Medem se o LOOP funcionou (ativou, ouviu, reconheceu,
 * executou), nunca O QUE foi dito.
 */
export type VoiceEventType =
  | "voice.activated"
  | "voice.deactivated"
  | "voice.listen_started"
  | "voice.stt_success"
  | "voice.stt_failure"
  | "voice.command_success"
  | "voice.command_failure"
  // P5B — máquina de confirmação, desfazer e substituição por voz.
  | "voice.confirmation_requested"
  | "voice.confirmation_accepted"
  | "voice.confirmation_rejected"
  | "voice.undo_used"
  | "voice.substitution_requested"
  // P5C — spike aberto de wake word (Picovoice Porcupine × motor ONNX
  // estilo openWakeWord, sem fornecedor definitivo). Só o CICLO, nunca a
  // keyword em si nem o áudio.
  | "voice.wake_started"
  | "voice.wake_detected"
  | "voice.wake_error";

/** Campos permitidos. Tipado para que transcript/carga/reps não entrem por descuido. */
export interface VoiceEventPayload {
  /** "plan" | "free" — origem da sessão, igual a `workoutEvents.ts`. */
  mode?: "plan" | "free";
  /** Latência ponta a ponta do comando, em ms. */
  latencyMs?: number;
  /** Motivo de falha, em categoria fechada — nunca a mensagem crua do erro. */
  errorKind?: string;
  /**
   * P5C — QUAL variante detectou ("S2CORE" vs "Ei S2CORE"), para o
   * protocolo de teste comparar as duas sob a mesma sessão. Nunca o áudio
   * nem o transcript.
   */
  wakeVariant?: "s2core" | "ei_s2core";
}

export function postVoiceEvent(eventType: VoiceEventType, payload: VoiceEventPayload = {}): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    // best-effort; evento perdido não afeta quem está treinando
  });
}
