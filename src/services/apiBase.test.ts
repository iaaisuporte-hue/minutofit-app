/**
 * Guarda de configuração do app empacotado.
 *
 * Sem `VITE_API_URL`, a base cai em `${origin}/api` — que na WebView do
 * Capacitor resolve para `capacitor://localhost/api` (iOS) ou
 * `https://localhost/api` (Android), hosts onde não existe backend. O app
 * abria e nada funcionava, sem uma linha de log. Estes testes travam o aviso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isNativeApp = vi.fn(() => false);
const getPlatform = vi.fn(() => "web");
const captureMessage = vi.fn();

vi.mock("../lib/platform", () => ({
  isNativeApp: () => isNativeApp(),
  getPlatform: () => getPlatform(),
}));
vi.mock("@sentry/react", () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}));

/** Recarrega o módulo: a base é resolvida uma única vez, na importação. */
async function importApiBase() {
  vi.resetModules();
  return import("./apiBase");
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  isNativeApp.mockReturnValue(false);
  getPlatform.mockReturnValue("web");
  captureMessage.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("apiBase — VITE_API_URL ausente no app nativo", () => {
  it("reporta no console e no Sentry quando roda nativo sem a env", async () => {
    isNativeApp.mockReturnValue(true);
    getPlatform.mockReturnValue("ios");

    const mod = await importApiBase();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain("VITE_API_URL");
    expect(captureMessage).toHaveBeenCalledWith(
      "api_base.missing_url.native",
      expect.objectContaining({ level: "error", tags: { platform: "ios" } }),
    );
    expect(mod.reportMissingNativeApiUrl()).toBe(true);
  });

  it("não reporta nada na web — o fallback por origem é legítimo lá", async () => {
    const mod = await importApiBase();

    expect(console.error).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(mod.reportMissingNativeApiUrl()).toBe(false);
  });

  it("não reporta no nativo quando a env está definida, e usa o valor dela", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.s2core.com.br/api");
    isNativeApp.mockReturnValue(true);
    getPlatform.mockReturnValue("android");

    const mod = await importApiBase();

    expect(mod.API_URL).toBe("https://api.s2core.com.br/api");
    expect(console.error).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
