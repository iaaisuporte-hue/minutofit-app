/**
 * Registro do controller da sessão de treino ATIVA (P5A — fundação do Voice
 * Workout).
 *
 * Mesmo espírito do `overlayStack.ts`: em vez de um EventBus genérico, a
 * página REGISTRA a si mesma ao montar. Quem precisa mandar um comando (a
 * ponte de voz, futuramente) pega o controller ativo e chama `dispatch`
 * diretamente — determinístico, sem adivinhar se alguém está ouvindo.
 *
 * No máximo uma sessão de treino existe por vez na árvore (não há duas
 * `WorkoutSessionPage` montadas ao mesmo tempo), então "o último a registrar
 * vence" é suficiente — não é uma pilha como a de overlays.
 */

import type { WorkoutSnapshot } from "./WorkoutSnapshot";

export type WorkoutCommand =
  | { type: "complete_set"; setIndex: number; reps?: string; loadKg?: string }
  | { type: "set_load"; setIndex: number; loadKg: string }
  | { type: "set_reps"; setIndex: number; reps: string }
  | { type: "attach_observation"; setIndex: number; observation: string | null }
  | { type: "next_exercise" }
  | { type: "previous_exercise" }
  | { type: "pause_rest" }
  | { type: "resume_rest" }
  | { type: "skip_rest" };

export interface WorkoutCommandResult {
  ok: boolean;
  changed: boolean;
  reason?: string;
}

export interface WorkoutController {
  dispatch(command: WorkoutCommand): WorkoutCommandResult;
  snapshot(): WorkoutSnapshot;
}

let ativo: WorkoutController | null = null;

/** Registra o controller da sessão em curso. Devolve a função que o remove. */
export function registerWorkoutController(controller: WorkoutController): () => void {
  ativo = controller;
  return () => {
    if (ativo === controller) ativo = null;
  };
}

/** `null` quando não há sessão de treino montada agora. */
export function getActiveWorkoutController(): WorkoutController | null {
  return ativo;
}

/** Só para teste: garante que nenhum registro anterior ficou preso. */
export function __resetWorkoutControllerRegistry(): void {
  ativo = null;
}
