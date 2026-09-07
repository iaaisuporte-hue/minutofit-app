import { describe, expect, it } from "vitest";
import {
  initialWakeWordState,
  isMidCommand,
  isWakeListening,
  transition,
  type WakeWordEvent,
  type WakeWordMachineState,
} from "./wakeWordStateMachine";

function apply(state: WakeWordMachineState, events: WakeWordEvent[]): WakeWordMachineState {
  return events.reduce(transition, state);
}

describe("wakeWordStateMachine — caminho feliz", () => {
  it("percorre disabled → waiting_for_wake → wake_detected → capturing → processing → speaking → waiting_for_wake", () => {
    let s = initialWakeWordState();
    expect(s.state).toBe("disabled");

    s = transition(s, { type: "ENABLE" });
    expect(s.state).toBe("starting");

    s = transition(s, { type: "READY" });
    expect(s.state).toBe("waiting_for_wake");

    s = transition(s, { type: "WAKE_DETECTED" });
    expect(s.state).toBe("wake_detected");

    s = transition(s, { type: "CAPTURE_STARTED" });
    expect(s.state).toBe("capturing_command");

    s = transition(s, { type: "COMMAND_RECEIVED" });
    expect(s.state).toBe("processing");

    s = transition(s, { type: "PROCESSED" });
    expect(s.state).toBe("speaking");

    s = transition(s, { type: "SPEAK_DONE" });
    expect(s.state).toBe("returning_to_wake");

    s = transition(s, { type: "COOLDOWN_DONE" });
    expect(s.state).toBe("waiting_for_wake");
  });
});

describe("wakeWordStateMachine — anti self-trigger (P5C.2)", () => {
  it("isWakeListening só é true em waiting_for_wake — em todo o resto do ciclo (inclusive speaking) fica false", () => {
    let s = apply(initialWakeWordState(), [{ type: "ENABLE" }, { type: "READY" }]);
    expect(isWakeListening(s.state)).toBe(true);

    const passos: WakeWordEvent[] = [
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
      { type: "COMMAND_RECEIVED" },
      { type: "PROCESSED" },
    ];
    for (const evento of passos) {
      s = transition(s, evento);
      expect(isWakeListening(s.state)).toBe(false);
    }
    expect(s.state).toBe("speaking");
    expect(isWakeListening(s.state)).toBe(false);

    s = transition(s, { type: "SPEAK_DONE" });
    expect(s.state).toBe("returning_to_wake");
    // Cooldown: ainda NÃO volta a ouvir — só depois de COOLDOWN_DONE.
    expect(isWakeListening(s.state)).toBe(false);

    s = transition(s, { type: "COOLDOWN_DONE" });
    expect(isWakeListening(s.state)).toBe(true);
  });
});

describe("wakeWordStateMachine — confirmação sem nova wake word (P5C.18)", () => {
  it("de awaiting_confirmation volta direto para processing, nunca por waiting_for_wake/wake_detected", () => {
    let s = apply(initialWakeWordState(), [
      { type: "ENABLE" },
      { type: "READY" },
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
      { type: "COMMAND_RECEIVED" }, // "finalizar treino"
      { type: "NEEDS_CONFIRMATION" }, // "quer finalizar?"
    ]);
    expect(s.state).toBe("awaiting_confirmation");

    // resposta "sim" chega pela MESMA captura, sem WAKE_DETECTED no meio
    s = transition(s, { type: "COMMAND_RECEIVED" });
    expect(s.state).toBe("processing");
  });

  it("suporta confirmação encadeada (ex.: finish_initial → finish_despite_pending)", () => {
    let s = apply(initialWakeWordState(), [
      { type: "ENABLE" },
      { type: "READY" },
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
      { type: "COMMAND_RECEIVED" },
      { type: "NEEDS_CONFIRMATION" },
      { type: "COMMAND_RECEIVED" }, // "sim" da primeira pergunta
      { type: "NEEDS_CONFIRMATION" }, // segunda pergunta (exercícios pendentes)
    ]);
    expect(s.state).toBe("awaiting_confirmation");

    s = transition(s, { type: "COMMAND_RECEIVED" }); // "sim" da segunda
    s = transition(s, { type: "PROCESSED" });
    expect(s.state).toBe("speaking");
  });
});

describe("wakeWordStateMachine — comando vazio (P5C.16)", () => {
  it("silêncio na janela de captura volta para wake sem passar por processing/speaking", () => {
    let s = apply(initialWakeWordState(), [
      { type: "ENABLE" },
      { type: "READY" },
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
    ]);
    s = transition(s, { type: "COMMAND_EMPTY" });
    expect(s.state).toBe("returning_to_wake");

    s = transition(s, { type: "COOLDOWN_DONE" });
    expect(s.state).toBe("waiting_for_wake");
  });

  it("silêncio durante a captura de uma CONFIRMAÇÃO também volta para wake, sem executar nada", () => {
    let s = apply(initialWakeWordState(), [
      { type: "ENABLE" },
      { type: "READY" },
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
      { type: "COMMAND_RECEIVED" },
      { type: "NEEDS_CONFIRMATION" },
    ]);
    s = transition(s, { type: "COMMAND_EMPTY" });
    expect(s.state).toBe("returning_to_wake");
  });
});

describe("wakeWordStateMachine — eventos fora de ordem são no-op", () => {
  it("WAKE_DETECTED duplicado durante a captura não reinicia o ciclo", () => {
    let s = apply(initialWakeWordState(), [
      { type: "ENABLE" },
      { type: "READY" },
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
    ]);
    const antes = s;
    s = transition(s, { type: "WAKE_DETECTED" });
    expect(s).toEqual(antes);
    expect(s.state).toBe("capturing_command");
  });

  it("COOLDOWN_DONE fora de returning_to_wake não faz nada", () => {
    const s = apply(initialWakeWordState(), [{ type: "ENABLE" }, { type: "READY" }]);
    const depois = transition(s, { type: "COOLDOWN_DONE" });
    expect(depois).toEqual(s);
  });

  it("ENABLE repetido enquanto já starting/waiting não regride o estado", () => {
    let s = apply(initialWakeWordState(), [{ type: "ENABLE" }]);
    expect(s.state).toBe("starting");
    s = transition(s, { type: "ENABLE" });
    expect(s.state).toBe("starting");
  });
});

describe("wakeWordStateMachine — desligar e erro", () => {
  it("DISABLE funciona a partir de qualquer estado ativo, inclusive no meio de uma captura", () => {
    const s = apply(initialWakeWordState(), [
      { type: "ENABLE" },
      { type: "READY" },
      { type: "WAKE_DETECTED" },
      { type: "CAPTURE_STARTED" },
    ]);
    const desligando = transition(s, { type: "DISABLE" });
    expect(desligando.state).toBe("stopping");
    const desligado = transition(desligando, { type: "STOPPED" });
    expect(desligado.state).toBe("disabled");
  });

  it("ERROR leva a error com o motivo, e ERROR_RECOVERED volta a ouvir", () => {
    let s = apply(initialWakeWordState(), [{ type: "ENABLE" }, { type: "READY" }, { type: "WAKE_DETECTED" }]);
    s = transition(s, { type: "ERROR", reason: "recognizer_unavailable" });
    expect(s.state).toBe("error");
    expect(s.errorReason).toBe("recognizer_unavailable");

    s = transition(s, { type: "ERROR_RECOVERED" });
    expect(s.state).toBe("waiting_for_wake");
    expect(s.errorReason).toBeNull();
  });

  it("falha ao iniciar (START_FAILED) vai para error, não para waiting_for_wake", () => {
    let s = apply(initialWakeWordState(), [{ type: "ENABLE" }]);
    s = transition(s, { type: "START_FAILED", reason: "permission_denied" });
    expect(s.state).toBe("error");
    expect(s.errorReason).toBe("permission_denied");
  });

  it("DISABLE a partir de error também desliga (não fica preso em error)", () => {
    let s = apply(initialWakeWordState(), [{ type: "ENABLE" }, { type: "READY" }]);
    s = transition(s, { type: "ERROR", reason: "recognizer_busy" });
    s = transition(s, { type: "DISABLE" });
    expect(s.state).toBe("stopping");
  });
});

describe("isMidCommand", () => {
  it("é true durante o ciclo de comando, false em waiting_for_wake/speaking/disabled", () => {
    expect(isMidCommand("wake_detected")).toBe(true);
    expect(isMidCommand("capturing_command")).toBe(true);
    expect(isMidCommand("processing")).toBe(true);
    expect(isMidCommand("awaiting_confirmation")).toBe(true);
    expect(isMidCommand("waiting_for_wake")).toBe(false);
    expect(isMidCommand("speaking")).toBe(false);
    expect(isMidCommand("disabled")).toBe(false);
  });
});
