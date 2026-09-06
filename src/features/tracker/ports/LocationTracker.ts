import type { PontoBruto } from "../gpsFilter";

/**
 * Porta de rastreamento de localização (SPEC Mobile P2 — camada nativa).
 *
 * Existe para que o domínio da atividade — filtro, distância, pace, rascunho,
 * recuperação — não saiba de onde os pontos vêm. Hoje só há uma implementação,
 * a `WebLocationTracker`, que usa `navigator.geolocation`. Amanhã entra a
 * nativa (foreground service no Android, `CLLocationManager` com
 * `allowsBackgroundLocationUpdates` no iOS) SEM que nada acima desta linha mude.
 *
 * ## O limite que esta porta torna explícito
 *
 * A implementação web **não rastreia com a tela apagada**. Não é um defeito
 * dela: o JavaScript congela quando o WebView vai para segundo plano, inclusive
 * em PWA instalado — limitação já registrada como decisão consciente no
 * CLAUDE.md do projeto. Nenhuma linha de código nesta camada resolve isso.
 * Quem resolve é um `LocationTracker` nativo, e é por isso que esta interface
 * existe antes dele.
 *
 * `suportaSegundoPlano` não é enfeite: a UI PRECISA saber a verdade para avisar
 * quem vai correr que a tela deve ficar ligada. Prometer o que não se entrega é
 * pior do que não ter a função.
 */
export interface LocationTracker {
  /** Identificação da implementação, para diagnóstico e telemetria. */
  readonly nome: string;

  /**
   * A implementação continua registrando pontos com o app em segundo plano e a
   * tela apagada? `false` na web. Ver o bloco acima.
   */
  readonly suportaSegundoPlano: boolean;

  /** Há como obter localização neste ambiente? */
  disponivel(): boolean;

  /**
   * Estado da permissão, sem PEDIR nada.
   *
   * Separado de `solicitarPermissao` de propósito: a §16 manda pedir só quando
   * a pessoa inicia uma atividade, e a tela pré-atividade precisa consultar o
   * estado antes disso para decidir o que mostrar.
   */
  estadoPermissao(): Promise<PermissaoLocalizacao>;

  /** Pede a permissão. Chamar SOMENTE a partir de um gesto do usuário (§16). */
  solicitarPermissao(): Promise<PermissaoLocalizacao>;

  /**
   * Começa a emitir pontos para a sessão inteira de rastreamento — uma vez por
   * atividade, não uma vez por trecho ativo (P1B). Pausa e retomada dentro da
   * mesma sessão são `pausar()`/`retomar()`, não uma nova chamada aqui.
   *
   * `onErro` recebe perda de sinal e negação de permissão em curso — a §19/§20
   * da SPEC exige que a tela reaja a isso, não que trave.
   */
  iniciar(opts: {
    onPonto: (p: PontoBruto) => void;
    onErro?: (e: ErroLocalizacao) => void;
  }): void;

  /**
   * Suspende e retoma a coleta sem encerrar a sessão de rastreamento.
   *
   * Existe porque "pausar a atividade" e "encerrar o rastreamento" são coisas
   * diferentes para uma implementação nativa: derrubar o serviço de primeiro
   * plano a cada pausa apagaria a notificação, e retomar exigiria subi-lo de
   * novo — com o app possivelmente em segundo plano, que é justamente quando o
   * Android proíbe iniciar serviço.
   */
  pausar(): void;
  retomar(): void;

  /**
   * Encerra a sessão por completo — o oposto de `iniciar()`.
   *
   * Seguro de chamar a qualquer momento, mesmo sem uma sessão em curso: é o
   * que faz dele o caminho tanto da limpeza normal (fim/descarte de atividade,
   * `isTracking` virando falso) quanto de um defensivo — descartar um
   * RASCUNHO recuperado (que nunca chegou a retomar rastreamento nesta
   * montagem) chama `parar()` do mesmo jeito, para o caso de o serviço nativo
   * ter sobrevivido a uma morte de processo (`START_STICKY`) sem ninguém do
   * lado web para desligá-lo.
   */
  parar(): void;

  /**
   * Entrega os pontos acumulados enquanto o JavaScript esteve suspenso, e os
   * remove da fila.
   *
   * Só faz sentido em implementação com segundo plano: enquanto o WebView
   * dorme, nenhum callback é entregue, então o lado nativo acumula e o web
   * puxa ao acordar. A web devolve lista vazia — não há nada acumulado quando
   * é o próprio JavaScript que coleta.
   */
  drenar(): Promise<PontoBruto[]>;

  /**
   * Empurra o estado visível — tempo, distância, métrica principal (pace ou
   * velocidade, já formatados) — para a superfície nativa (P1C).
   *
   * `pausado` decide o rótulo de status; os demais campos chegam já
   * FORMATADOS (mesmas funções que a tela usa: `formatTime`,
   * `metricaPrincipal`/`formatarPace`) — a plataforma nativa não reimplementa
   * a regra de negócio, só renderiza texto pronto. É por isso que o contrato
   * é só strings: nenhuma unidade, arredondamento ou escolha pace×velocidade
   * é decidida do lado de lá.
   *
   * No web é no-op: não existe superfície de Lock Screen para o PWA neste
   * escopo (mesmo limite que `suportaSegundoPlano` já sinaliza).
   */
  atualizarEstadoVisivel(estado: EstadoTrackerVisivel): void;
}

/**
 * Estado empurrado para a notificação/Lock Screen — ver `atualizarEstadoVisivel`.
 *
 * Sem campo de pausa de propósito: quem decide "PAUSADO" no lado nativo é o
 * PRÓPRIO serviço, a partir das ações `pausar()`/`retomar()` que já chegam
 * antes de qualquer atualização de estado (mesma sessão de Intents, ordem
 * garantida). Reenviar o mesmo fato por aqui seria uma segunda fonte de
 * verdade para algo que o nativo já sabe com certeza.
 */
export interface EstadoTrackerVisivel {
  /** "00:37:42" — `formatTime`. */
  tempoLabel: string;
  /** "6.31 km" — mesma casa decimal usada na tela. */
  distanciaLabel: string;
  /** "5:59" ou "--" (sem pace ainda), ou velocidade quando a modalidade é bike. */
  metricaValor: string;
  /** "/km" ou "km/h". */
  metricaUnidade: string;
}

export type PermissaoLocalizacao = "concedida" | "negada" | "nao_solicitada" | "indisponivel";

export type ErroLocalizacao =
  | { tipo: "permissao_negada" }
  | { tipo: "indisponivel" }
  | { tipo: "timeout" }
  | { tipo: "sinal_perdido" };
