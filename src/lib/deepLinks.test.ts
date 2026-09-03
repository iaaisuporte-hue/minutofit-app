import { describe, expect, it } from "vitest";
import { montarDeepLink, ROTA_PADRAO, traduzirDeepLink } from "./deepLinks";

describe("traduzirDeepLink — esquema próprio (§11)", () => {
  it("abre o treino de hoje", () => {
    expect(traduzirDeepLink("s2core://workout/today").rota).toBe("/app/user/ficha");
  });

  it("abre uma sessão específica com plano e dia", () => {
    expect(traduzirDeepLink("s2core://workout/session/7/2").rota).toBe("/app/user/treino/7/2");
  });

  it("abre o treino livre", () => {
    expect(traduzirDeepLink("s2core://workout/free").rota).toBe("/app/user/treino-livre");
  });

  it("abre o tracker já na modalidade pedida", () => {
    expect(traduzirDeepLink("s2core://activity/start/run").rota).toBe("/app/user/activities?tipo=run");
    expect(traduzirDeepLink("s2core://activity/start/cycling").rota).toBe("/app/user/activities?tipo=cycling");
  });

  it("modalidade fora da lista não vira rota — cai no padrão", () => {
    expect(traduzirDeepLink("s2core://activity/start/natacao").rota).toBe(ROTA_PADRAO);
  });
});

describe("traduzirDeepLink — o link vem de fora, então valida", () => {
  it("caminho desconhecido abre a Hoje em vez de lugar nenhum", () => {
    expect(traduzirDeepLink("s2core://qualquer/coisa").rota).toBe(ROTA_PADRAO);
  });

  it("URL malformada não quebra", () => {
    expect(traduzirDeepLink("isto não é uma url").rota).toBe(ROTA_PADRAO);
    expect(traduzirDeepLink("").rota).toBe(ROTA_PADRAO);
  });

  it("id de sessão só aceita dígitos — nada de path traversal", () => {
    expect(traduzirDeepLink("s2core://workout/session/../../admin/7").rota).toBe(ROTA_PADRAO);
    expect(traduzirDeepLink("s2core://workout/session/abc/2").rota).toBe(ROTA_PADRAO);
  });

  it("App Link fora dos prefixos conhecidos não vira navegação arbitrária", () => {
    expect(traduzirDeepLink("https://app.s2core.com.br/admin/usuarios").rota).toBe(ROTA_PADRAO);
    expect(traduzirDeepLink("https://app.s2core.com.br/app/user/profile").rota).toBe("/app/user/profile");
  });

  it("esquema estranho cai no padrão", () => {
    expect(traduzirDeepLink("javascript://workout/today").rota).toBe(ROTA_PADRAO);
  });

  it("App Link preserva a query (convites usam token na URL)", () => {
    expect(traduzirDeepLink("https://app.s2core.com.br/invite/abc?x=1").rota).toBe("/invite/abc?x=1");
  });
});

describe("origem do link — responde 'quanto o widget é usado?' (§71)", () => {
  it("lê a origem declarada", () => {
    expect(traduzirDeepLink("s2core://workout/today?from=widget").origem).toBe("widget");
    expect(traduzirDeepLink("s2core://workout/today?from=notification").origem).toBe("notificacao");
    expect(traduzirDeepLink("s2core://workout/today?from=quick_action").origem).toBe("quick_action");
  });

  it("sem declaração, a origem é desconhecida — não inventa", () => {
    expect(traduzirDeepLink("s2core://workout/today").origem).toBe("desconhecida");
  });

  it("https é sempre app_link", () => {
    expect(traduzirDeepLink("https://app.s2core.com.br/app/user/today").origem).toBe("app_link");
  });
});

describe("montarDeepLink — a ponta que a camada nativa usa", () => {
  it("monta com e sem origem", () => {
    expect(montarDeepLink("workout/today")).toBe("s2core://workout/today");
    expect(montarDeepLink("/workout/today", "widget")).toBe("s2core://workout/today?from=widget");
    expect(montarDeepLink("activity/start/run", "quick_action")).toBe("s2core://activity/start/run?from=quick_action");
  });

  it("ida e volta: o que se monta é o que se traduz", () => {
    const link = montarDeepLink("workout/session/3/1", "widget");
    const d = traduzirDeepLink(link);
    expect(d.rota).toBe("/app/user/treino/3/1");
    expect(d.origem).toBe("widget");
  });
});
