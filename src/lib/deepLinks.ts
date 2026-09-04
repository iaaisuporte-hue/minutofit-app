/**
 * Deep links do S2Core (SPEC Mobile P2 §11).
 *
 * Widgets, notificações e Quick Actions precisam abrir um DESTINO, não a Home.
 * Este módulo é a única tradução entre um link externo e uma rota do app —
 * centralizada de propósito: com a tradução espalhada, cada ponto de entrada
 * inventa a sua e a navegação vira inconsistente, que é o que a §11 proíbe.
 *
 * ## Dois formatos, uma tradução
 *
 * - `s2core://workout/today` — esquema próprio, usado por widget e Quick Action.
 * - `https://app.s2core.com.br/app/user/...` — App Link, usado por convites e
 *   compartilhamento. Já funcionava (`NativeAppBridge`); aqui ganha a mesma
 *   validação.
 *
 * ## Por que uma allow-list e não `pathname` direto
 *
 * O link chega de FORA do app — de uma notificação, de um widget, de uma
 * mensagem. Encaminhar qualquer caminho recebido para o router transforma um
 * link em navegação arbitrária dentro da sessão autenticada. A allow-list
 * garante que só os destinos previstos são alcançáveis por este caminho, e que
 * um link desconhecido cai num lugar seguro em vez de lugar nenhum.
 */

export const ESQUEMA = "s2core";

/** Destino resolvido: rota interna do React Router. */
export interface DestinoDeepLink {
  rota: string;
  /** Qual entrada produziu o link — vira evento de produto (§70/§71). */
  origem: "widget" | "notificacao" | "quick_action" | "app_link" | "desconhecida";
}

/** Fallback quando o link não é reconhecido. Nunca deixa a pessoa em branco. */
export const ROTA_PADRAO = "/app/user/today";

/**
 * Rotas alcançáveis a partir de um link externo.
 *
 * `:id` é o único parâmetro aceito, e apenas como dígitos — ver `traduzir`.
 */
const MAPA: Array<{ padrao: RegExp; rota: (m: RegExpMatchArray) => string }> = [
  // Treino
  { padrao: /^workout\/today$/, rota: () => "/app/user/ficha" },
  { padrao: /^workout\/free$/, rota: () => "/app/user/treino-livre" },
  // A sessão livre em execução é destino próprio: o lembrete de treino não
  // finalizado precisa reabrir a EXECUÇÃO, e `workout/free` leva à montagem.
  { padrao: /^workout\/free\/session$/, rota: () => "/app/user/treino-livre/sessao" },
  { padrao: /^workout\/session\/(\d+)\/(\d+)$/, rota: (m) => `/app/user/treino/${m[1]}/${m[2]}` },
  { padrao: /^workout\/resume$/, rota: () => "/app/user/ficha" },
  // Atividade
  { padrao: /^activity$/, rota: () => "/app/user/activities" },
  { padrao: /^activity\/start\/(walk|run|cycling)$/, rota: (m) => `/app/user/activities?tipo=${m[1]}` },
  // Destinos gerais
  { padrao: /^today$/, rota: () => "/app/user/today" },
  { padrao: /^profile$/, rota: () => "/app/user/profile" },
  { padrao: /^integrations$/, rota: () => "/app/user/integracoes" },
];

/** Caminhos de App Link (https) permitidos, por prefixo. */
const PREFIXOS_HTTPS = [
  "/app/user/",
  "/app/personal/",
  "/convite-personal/",
  "/convite-nutri/",
  "/invite/",
];

/**
 * Traduz um link externo em rota interna.
 *
 * Devolve sempre um destino — nunca null. Um link quebrado abrindo a Hoje é
 * melhor que um app que abre e não vai a lugar nenhum, e a origem
 * `desconhecida` deixa isso visível na telemetria em vez de silencioso.
 */
export function traduzirDeepLink(url: string): DestinoDeepLink {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { rota: ROTA_PADRAO, origem: "desconhecida" };
  }

  // ── Esquema próprio: s2core://workout/today
  if (parsed.protocol === `${ESQUEMA}:`) {
    // `new URL("s2core://workout/today")` põe "workout" em host e "/today" em
    // pathname — daí a recomposição em vez de usar só o pathname.
    const alvo = `${parsed.host}${parsed.pathname}`.replace(/^\/+|\/+$/g, "");
    for (const { padrao, rota } of MAPA) {
      const m = alvo.match(padrao);
      if (m) return { rota: rota(m), origem: origemDe(parsed) };
    }
    return { rota: ROTA_PADRAO, origem: origemDe(parsed) };
  }

  // ── App Link https: só caminhos conhecidos entram
  if (parsed.protocol === "https:" || parsed.protocol === "http:") {
    const caminho = parsed.pathname;
    if (PREFIXOS_HTTPS.some((p) => caminho.startsWith(p))) {
      return { rota: `${caminho}${parsed.search}`, origem: "app_link" };
    }
    return { rota: ROTA_PADRAO, origem: "app_link" };
  }

  return { rota: ROTA_PADRAO, origem: "desconhecida" };
}

/**
 * De onde o link veio, quando o emissor declara (`?from=widget`).
 *
 * É o que permite responder "quanto o widget é utilizado?" (§71) sem inventar
 * um mecanismo de rastreio novo — a informação viaja no próprio link.
 */
function origemDe(u: URL): DestinoDeepLink["origem"] {
  const from = u.searchParams.get("from");
  if (from === "widget") return "widget";
  if (from === "notification") return "notificacao";
  if (from === "quick_action") return "quick_action";
  return "desconhecida";
}

/** Monta um link para o esquema próprio. Usado pela camada nativa futura. */
export function montarDeepLink(caminho: string, origem?: DestinoDeepLink["origem"]): string {
  const base = `${ESQUEMA}://${caminho.replace(/^\/+/, "")}`;
  return origem && origem !== "desconhecida" ? `${base}?from=${origemParam(origem)}` : base;
}

function origemParam(o: DestinoDeepLink["origem"]): string {
  return o === "notificacao" ? "notification" : o === "quick_action" ? "quick_action" : o;
}
