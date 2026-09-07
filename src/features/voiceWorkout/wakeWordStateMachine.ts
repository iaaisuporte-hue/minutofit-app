/**
 * Máquina de estados do ciclo wake word → captura → processamento →
 * confirmação → fala → cooldown → wake word (P5C.1).
 *
 * Pura e sem I/O de propósito: nenhum SDK, nenhum timer, nenhuma chamada de
 * rede. Só a REGRA de quais transições são válidas — quem dispara os
 * eventos (o `WakeWordDetector` real, o `VoiceEngine`, os timers de
 * cooldown/janela) é responsabilidade de quem integra isto, ainda não
 * escrita nesta fase (sem fornecedor aprovado — ver a "Wake Word Decision").
 *
 * A garantia mais importante que este módulo formaliza é o anti-self-trigger
 * (P5C.2): `isWakeListening(state)` só é `true` em `waiting_for_wake`. Em
 * TODOS os outros estados — inclusive `speaking`, onde o próprio TTS do
 * S2CORE poderia soar parecido com a keyword — o detector deve estar
 * suspenso. É uma trava estrutural, não uma convenção que dependa de quem
 * chama lembrar de suspender na hora certa.
 */

export type WakeWordState =
  | "disabled"
  | "starting"
  | "waiting_for_wake"
  | "wake_detected"
  | "capturing_command"
  | "processing"
  | "awaiting_confirmation"
  | "speaking"
  | "returning_to_wake"
  | "error"
  | "stopping";

export type WakeWordEvent =
  | { type: "ENABLE" }
  | { type: "READY" }
  | { type: "START_FAILED"; reason: string }
  | { type: "WAKE_DETECTED" }
  | { type: "CAPTURE_STARTED" }
  | { type: "COMMAND_RECEIVED" }
  | { type: "COMMAND_EMPTY" }
  | { type: "NEEDS_CONFIRMATION" }
  | { type: "PROCESSED" }
  | { type: "SPEAK_DONE" }
  | { type: "COOLDOWN_DONE" }
  | { type: "ERROR"; reason: string }
  | { type: "ERROR_RECOVERED" }
  | { type: "DISABLE" }
  | { type: "STOPPED" };

export interface WakeWordMachineState {
  state: WakeWordState;
  errorReason: string | null;
}

/** Janela de captura de comando após a wake word (P5C.15) — mesmo valor do `VoiceEngine.listenOnce`. */
export const COMMAND_WINDOW_MS = 6_000;

/** Cooldown depois do TTS antes de reativar a escuta (P5C.2) — faixa 300–700ms, meio do caminho até medir em device real. */
export const WAKE_COOLDOWN_MS = 500;

export function initialWakeWordState(): WakeWordMachineState {
  return { state: "disabled", errorReason: null };
}

/**
 * Aplica um evento. Transição inválida para o estado atual é NO-OP (devolve
 * o mesmo estado) — um evento nativo fora de ordem ou duplicado (ex.: dois
 * `WAKE_DETECTED` antes do primeiro terminar de processar) não pode
 * corromper a máquina.
 */
export function transition(current: WakeWordMachineState, event: WakeWordEvent): WakeWordMachineState {
  const { state } = current;

  // DISABLE funciona de qualquer estado ativo — desligar é sempre possível,
  // mesmo no meio de uma captura ou de uma fala.
  if (event.type === "DISABLE" && state !== "disabled" && state !== "stopping") {
    return { state: "stopping", errorReason: null };
  }
  if (event.type === "STOPPED" && state === "stopping") {
    return { state: "disabled", errorReason: null };
  }
  if (event.type === "ERROR" && state !== "disabled" && state !== "stopping") {
    return { state: "error", errorReason: event.reason };
  }
  if (event.type === "ERROR_RECOVERED" && state === "error") {
    return { state: "waiting_for_wake", errorReason: null };
  }

  switch (state) {
    case "disabled":
      return event.type === "ENABLE" ? { state: "starting", errorReason: null } : current;

    case "starting":
      if (event.type === "READY") return { state: "waiting_for_wake", errorReason: null };
      if (event.type === "START_FAILED") return { state: "error", errorReason: event.reason };
      return current;

    case "waiting_for_wake":
      return event.type === "WAKE_DETECTED" ? { state: "wake_detected", errorReason: null } : current;

    case "wake_detected":
      return event.type === "CAPTURE_STARTED" ? { state: "capturing_command", errorReason: null } : current;

    case "capturing_command":
      if (event.type === "COMMAND_RECEIVED") return { state: "processing", errorReason: null };
      if (event.type === "COMMAND_EMPTY") return { state: "returning_to_wake", errorReason: null };
      return current;

    case "processing":
      if (event.type === "NEEDS_CONFIRMATION") return { state: "awaiting_confirmation", errorReason: null };
      if (event.type === "PROCESSED") return { state: "speaking", errorReason: null };
      return current;

    // A resposta de uma confirmação é capturada SEM nova wake word (P5C.18)
    // — por isso reaproveita os mesmos eventos de `capturing_command`, não
    // volta para `waiting_for_wake`/`wake_detected` no meio do caminho.
    case "awaiting_confirmation":
      if (event.type === "COMMAND_RECEIVED") return { state: "processing", errorReason: null };
      if (event.type === "COMMAND_EMPTY") return { state: "returning_to_wake", errorReason: null };
      return current;

    case "speaking":
      return event.type === "SPEAK_DONE" ? { state: "returning_to_wake", errorReason: null } : current;

    case "returning_to_wake":
      return event.type === "COOLDOWN_DONE" ? { state: "waiting_for_wake", errorReason: null } : current;

    case "error":
    case "stopping":
      // Únicas saídas já tratadas acima (ERROR_RECOVERED/DISABLE e STOPPED).
      return current;

    default:
      return current;
  }
}

/**
 * P5C.2 — único estado em que o detector pode estar de fato ouvindo a
 * keyword. Usar isto (não uma flag paralela) para decidir se o microfone da
 * wake word está ativo evita a classe de bug "esqueci de suspender".
 */
export function isWakeListening(state: WakeWordState): boolean {
  return state === "waiting_for_wake";
}

/** Estados em que a sessão está "no meio de um comando" — útil para UI/telemetria. */
export function isMidCommand(state: WakeWordState): boolean {
  return state === "wake_detected" || state === "capturing_command" || state === "processing" || state === "awaiting_confirmation";
}
