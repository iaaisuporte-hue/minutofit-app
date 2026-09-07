/**
 * Registra a sessão de treino atual como o controller ativo (P5A).
 *
 * `controller` muda a cada render (fecha sobre `exercises`/`currentIndex`
 * mais recentes), mas o registro no módulo só precisa acontecer uma vez: a
 * função estável guardada no registry lê sempre a versão mais nova via ref,
 * então quem chama `dispatch`/`snapshot` de fora nunca vê estado velho.
 */

import { useEffect, useRef } from "react";
import { registerWorkoutController, type WorkoutController } from "./workoutControllerRegistry";

export function useWorkoutController(controller: WorkoutController): void {
  const ref = useRef(controller);

  // Atualizar o ref é efeito, não render: mutá-lo direto no corpo da função
  // é o padrão antigo de "latest ref", que a regra `react-hooks/refs` (nova
  // no eslint-plugin-react-hooks@7) passou a proibir.
  useEffect(() => {
    ref.current = controller;
  });

  useEffect(() => {
    const estavel: WorkoutController = {
      dispatch: (command) => ref.current.dispatch(command),
      snapshot: () => ref.current.snapshot(),
    };
    return registerWorkoutController(estavel);
  }, []);
}
