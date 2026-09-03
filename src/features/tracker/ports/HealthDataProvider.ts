import type { Activity } from "../types";

/**
 * Porta de dados de saúde (SPEC Mobile P2 §41–§47).
 *
 * ## Estado honesto: NÃO EXISTE IMPLEMENTAÇÃO
 *
 * Health Connect (Android) e HealthKit (iOS) são APIs nativas. Implementá-las
 * exige um plugin Capacitor em Kotlin e outro em Swift, compilados com o
 * Android SDK e o Xcode. Nenhum dos dois existe neste ambiente, e escrever
 * código nativo sem nunca compilá-lo produziria um arquivo que parece pronto e
 * não é — o pior resultado possível.
 *
 * O que existe é ESTA INTERFACE, e ela não é decorativa: ela é o contrato que
 * a §85 pede documentar, escrito na linguagem que o resto do domínio já fala.
 * Quando o plugin nativo for escrito, ele implementa isto e é registrado — sem
 * refatoração do domínio, porque nada acima desta linha conhece Health Connect.
 *
 * A ausência de implementação é DETECTÁVEL em tempo de execução
 * (`provedorDeSaude()` devolve null), e a tela de Integrações usa isso para
 * mostrar "indisponível nesta versão" em vez de um botão que não faz nada.
 *
 * ## O que a implementação futura terá de respeitar
 *
 * 1. **Permissão granular (§42/§47).** Pedir só os tipos que o produto usa. A
 *    interface expõe `escoposNecessarios` justamente para que a lista seja
 *    revisável em código, e não escondida dentro do plugin.
 * 2. **Ownership e anti-loop (§45).** Uma atividade que o S2Core escreveu no
 *    Health Connect não pode voltar como atividade nova. O `sourceExternalId`
 *    da atividade importada e o campo de origem do registro escrito são as duas
 *    pontas que fecham esse laço — a dedução final é do `activityService`.
 * 3. **Passo não é atividade (§56).** `lerMetricasDiarias` existe separada de
 *    `importarAtividades` porque contagem de passos é métrica do dia, não
 *    sessão de exercício, e fundi-las criaria "atividades" que ninguém fez.
 */
export interface HealthDataProvider {
  readonly nome: "health_connect" | "apple_health";

  /** A API existe e está instalada neste aparelho? */
  disponivel(): Promise<boolean>;

  /** Escopos que o produto realmente usa. Revisável aqui, não dentro do plugin. */
  readonly escoposNecessarios: EscopoSaude[];

  estadoPermissoes(): Promise<Record<EscopoSaude, "concedida" | "negada" | "nao_solicitada">>;

  /** Abre o fluxo nativo de consentimento. Só a partir de gesto do usuário. */
  solicitarPermissoes(escopos: EscopoSaude[]): Promise<boolean>;

  /**
   * Importa sessões de exercício compatíveis a partir de `desde`.
   *
   * Devolve o shape canônico já com `sourceExternalId` preenchido — é ele que
   * garante a deduplicação no servidor (§5).
   */
  importarAtividades(desde: Date): Promise<AtividadeImportada[]>;

  /**
   * Escreve uma atividade do S2Core na fonte (§45). Opcional: uma implementação
   * pode ser só de leitura, e a UI reflete isso.
   */
  escreverAtividade?(atividade: AtividadeParaExportar): Promise<{ externalId: string } | null>;

  /** Métricas do dia — passos, calorias de repouso. NÃO viram atividade (§56). */
  lerMetricasDiarias?(dia: Date): Promise<MetricasDiarias | null>;
}

export type EscopoSaude =
  | "exercise_sessions"
  | "distance"
  | "heart_rate"
  | "steps"
  | "calories"
  | "speed"
  | "exercise_route";

/** Atividade vinda de fora, pronta para o `POST /api/activities`. */
export interface AtividadeImportada {
  tipo: Activity["type"];
  /** Identificador NA ORIGEM — a chave da deduplicação (§5). */
  sourceExternalId: string;
  /** App que produziu o dado por trás do agregador (§51). Ex.: "Garmin Connect". */
  sourceApp: string | null;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceKm: number | null;
  calories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainM: number | null;
  /** Rota, quando a fonte expõe e o usuário autorizou (§44). Ausência é normal. */
  route: Array<{ lat: number; lng: number }> | null;
}

export interface AtividadeParaExportar {
  tipo: Activity["type"];
  startedAt: Date;
  endedAt: Date;
  distanceKm: number;
  caloriesEstimated: number;
}

export interface MetricasDiarias {
  passos: number | null;
  caloriesAtivas: number | null;
}

/**
 * Registro dos provedores disponíveis.
 *
 * Vazio hoje, de propósito: nenhum provedor está implementado, e a função
 * devolver `null` é a informação correta — não um stub que finge funcionar.
 * O plugin nativo, quando existir, chama `registrarProvedorDeSaude` no boot.
 */
const provedores = new Map<string, HealthDataProvider>();

export function registrarProvedorDeSaude(p: HealthDataProvider): void {
  provedores.set(p.nome, p);
}

/**
 * O provedor da plataforma atual, ou `null` quando não há nenhum.
 *
 * `null` é o estado real desta versão. A UI de Integrações trata isso como
 * "indisponível nesta versão do app" — nunca como erro, e nunca escondendo a
 * seção, porque a pessoa precisa saber que a integração existe no roteiro.
 */
export function provedorDeSaude(plataforma: "android" | "ios" | "web"): HealthDataProvider | null {
  if (plataforma === "android") return provedores.get("health_connect") ?? null;
  if (plataforma === "ios") return provedores.get("apple_health") ?? null;
  return null;
}

/** Só para teste: limpa o registro entre casos. */
export function __limparProvedores(): void {
  provedores.clear();
}
