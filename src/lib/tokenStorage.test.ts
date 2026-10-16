import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O que estes testes protegem: a web NÃO pode mudar (é o caminho de produção
 * hoje) e o app empacotado precisa migrar a sessão sem pedir login de novo.
 */

const nativo = vi.hoisted(() => ({ valor: false }));
const prefs = vi.hoisted(() => ({
  store: new Map<string, string>(),
  set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
    prefs.store.set(key, value);
  }),
  get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.store.get(key) ?? null })),
  remove: vi.fn(async ({ key }: { key: string }) => {
    prefs.store.delete(key);
  }),
}));

vi.mock("./platform", () => ({
  isNativeApp: () => nativo.valor,
  getPlatform: () => (nativo.valor ? "ios" : "web"),
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    set: (a: { key: string; value: string }) => prefs.set(a),
    get: (a: { key: string }) => prefs.get(a),
    remove: (a: { key: string }) => prefs.remove(a),
  },
}));

async function carregarModulo() {
  vi.resetModules();
  return import("./tokenStorage");
}

beforeEach(() => {
  nativo.valor = false;
  prefs.store.clear();
  prefs.set.mockClear();
  prefs.get.mockClear();
  prefs.remove.mockClear();
  localStorage.clear();
});

describe("tokenStorage — web (comportamento inalterado)", () => {
  it("grava e lê no localStorage, mantendo a chave legada", async () => {
    const ts = await carregarModulo();
    ts.setTokens("acc", "ref");

    expect(localStorage.getItem("corefit_token")).toBe("acc");
    expect(localStorage.getItem("token")).toBe("acc");
    expect(localStorage.getItem("corefit_refresh_token")).toBe("ref");
    expect(ts.getAccessToken()).toBe("acc");
    expect(ts.getRefreshToken()).toBe("ref");
    expect(prefs.set).not.toHaveBeenCalled();
  });

  it("lê a chave legada quando só ela existe", async () => {
    const ts = await carregarModulo();
    localStorage.setItem("token", "antigo");
    expect(ts.getAccessToken()).toBe("antigo");
  });

  it("logout limpa as três chaves", async () => {
    const ts = await carregarModulo();
    ts.setTokens("acc", "ref");
    ts.clearTokens();

    expect(localStorage.getItem("corefit_token")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("corefit_refresh_token")).toBeNull();
    expect(ts.getAccessToken()).toBeNull();
  });

  it("hidratação é no-op na web", async () => {
    const ts = await carregarModulo();
    await ts.hydrateTokenStorage();
    expect(prefs.get).not.toHaveBeenCalled();
  });
});

describe("tokenStorage — app empacotado", () => {
  it("grava no storage nativo e não no localStorage", async () => {
    nativo.valor = true;
    const ts = await carregarModulo();
    ts.setTokens("acc", "ref");

    expect(ts.getAccessToken()).toBe("acc");
    expect(ts.getRefreshToken()).toBe("ref");
    expect(prefs.store.get("corefit_token")).toBe("acc");
    expect(prefs.store.get("corefit_refresh_token")).toBe("ref");
    expect(localStorage.getItem("corefit_token")).toBeNull();
  });

  it("restaura a sessão do storage nativo no boot", async () => {
    nativo.valor = true;
    prefs.store.set("corefit_token", "acc-persistido");
    prefs.store.set("corefit_refresh_token", "ref-persistido");

    const ts = await carregarModulo();
    expect(ts.getAccessToken()).toBeNull(); // antes de hidratar
    await ts.hydrateTokenStorage();

    expect(ts.getAccessToken()).toBe("acc-persistido");
    expect(ts.getRefreshToken()).toBe("ref-persistido");
  });

  it("migra o que estava em localStorage e apaga a origem", async () => {
    nativo.valor = true;
    localStorage.setItem("corefit_token", "acc-antigo");
    localStorage.setItem("token", "acc-antigo");
    localStorage.setItem("corefit_refresh_token", "ref-antigo");

    const ts = await carregarModulo();
    await ts.hydrateTokenStorage();

    expect(ts.getAccessToken()).toBe("acc-antigo");
    expect(ts.getRefreshToken()).toBe("ref-antigo");
    expect(prefs.store.get("corefit_token")).toBe("acc-antigo");
    // Manter cópia no store da WebView anularia o motivo da migração.
    expect(localStorage.getItem("corefit_token")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("corefit_refresh_token")).toBeNull();
  });

  it("não sobrescreve o storage nativo com resquício de localStorage", async () => {
    nativo.valor = true;
    prefs.store.set("corefit_token", "acc-nativo");
    localStorage.setItem("corefit_token", "acc-velho");

    const ts = await carregarModulo();
    await ts.hydrateTokenStorage();

    expect(ts.getAccessToken()).toBe("acc-nativo");
    expect(prefs.store.get("corefit_token")).toBe("acc-nativo");
  });

  it("logout limpa nativo e qualquer resquício de localStorage", async () => {
    nativo.valor = true;
    localStorage.setItem("token", "resquicio");
    const ts = await carregarModulo();
    ts.setTokens("acc", "ref");

    ts.clearTokens();

    expect(ts.getAccessToken()).toBeNull();
    expect(ts.getRefreshToken()).toBeNull();
    expect(prefs.remove).toHaveBeenCalledWith({ key: "corefit_token" });
    expect(prefs.remove).toHaveBeenCalledWith({ key: "corefit_refresh_token" });
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("gravação nativa que falha não apaga a sessão do localStorage", async () => {
    nativo.valor = true;
    localStorage.setItem("corefit_token", "acc-antigo");
    prefs.set.mockRejectedValueOnce(new Error("keychain indisponível"));

    const ts = await carregarModulo();
    await ts.hydrateTokenStorage();

    expect(ts.getAccessToken()).toBe("acc-antigo");
    expect(localStorage.getItem("corefit_token")).toBe("acc-antigo");
  });
});
