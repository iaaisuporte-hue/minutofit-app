/**
 * Porta da superfície de exibição ao vivo do treino de musculação (P1D).
 *
 * Mesma ideia da `LocationTracker` (P1B/P1C), mas mais simples: aqui não há
 * ponto de GPS acumulando em segundo plano, então não existe `drenar()`. E não
 * existe `pausar()`/`retomar()` do TREINO em si — o motor de execução não tem
 * esse conceito (só existe pausar/retomar o DESCANSO entre séries, que já é o
 * `useRestTimer` existente); inventar uma pausa de treino que não existe seria
 * adicionar funcionalidade nova, fora do que esta fase pede.
 *
 * Web é no-op — não existe Lock Screen de PWA neste escopo, mesmo limite já
 * estabelecido pela P1C.
 */
export interface WorkoutLiveSurface {
  /** Sobe a notificação para a sessão inteira. Chamar uma vez por treino. */
  iniciar(): void;

  /**
   * Atualiza o texto exibido. `descansando` decide o título — é a única peça
   * que SÓ o web sabe (o nativo não tem visibilidade do descanso, diferente
   * do outdoor tracker onde o serviço já mantinha seu próprio `pausado`).
   */
  atualizar(estado: EstadoTreinoVisivel): void;

  /** Encerra a notificação. Seguro chamar mesmo sem sessão em curso. */
  parar(): void;
}

/**
 * Decide o título. Três estados, não dois: o motor de execução não tem
 * "pausar o treino inteiro" (ver `WorkoutLiveSurface` acima) — o único pause
 * real é do DESCANSO entre séries, e é isso que `descanso_pausado` reflete.
 * "ativo" cobre tanto uma série sendo executada quanto o descanso correndo
 * normalmente.
 */
export type StatusTreinoVisivel = "ativo" | "descansando" | "descanso_pausado";

export interface EstadoTreinoVisivel {
  status: StatusTreinoVisivel;
  /** "42:18" — tempo TOTAL do treino, sempre calculado (mesmo em descanso). */
  tempoLabel: string;
  exercicioNome: string;
  /** "Série 1 de 4" — já formatado. */
  serieLabel: string;
  /** "26 kg · 12 reps", só quando a série atual tem valor real digitado — nunca
   *  o placeholder/sugestão que a tela mostra, que não é dado real ainda. */
  cargaRepsLabel: string | null;
  /** "0:57" restante do descanso. `null` fora do descanso (em qualquer status). */
  descansoRestanteLabel: string | null;
}
