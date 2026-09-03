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
   * Começa a emitir pontos. Devolve a função que encerra.
   *
   * `onErro` recebe perda de sinal e negação de permissão em curso — a §19/§20
   * da SPEC exige que a tela reaja a isso, não que trave.
   */
  iniciar(opts: {
    onPonto: (p: PontoBruto) => void;
    onErro?: (e: ErroLocalizacao) => void;
  }): () => void;
}

export type PermissaoLocalizacao = "concedida" | "negada" | "nao_solicitada" | "indisponivel";

export type ErroLocalizacao =
  | { tipo: "permissao_negada" }
  | { tipo: "indisponivel" }
  | { tipo: "timeout" }
  | { tipo: "sinal_perdido" };
