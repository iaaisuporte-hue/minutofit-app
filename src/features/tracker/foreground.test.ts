import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `aoVoltarAoPrimeiroPlano` é o gatilho de reconciliação da P1B: sem ele, o
 * cronômetro e a rota só se atualizariam no próximo tique do relógio (até 1 s
 * de atraso), bem no instante em que a pessoa desbloqueia para conferir.
 */

const addListener = vi.fn();
let appStateHandler: ((s: { isActive: boolean }) => void) | null = null;

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (event: string, cb: (s: { isActive: boolean }) => void) => {
      appStateHandler = cb;
      return addListener(event, cb);
    },
  },
}));

const isNativeAppMock = vi.fn();
vi.mock("../../lib/platform", () => ({ isNativeApp: () => isNativeAppMock() }));

const { aoVoltarAoPrimeiroPlano } = await import("./foreground");

function definirVisibilidade(estado: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: estado, configurable: true });
}

beforeEach(() => {
  isNativeAppMock.mockReturnValue(false);
  addListener.mockReset().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  appStateHandler = null;
  definirVisibilidade("visible");
});

afterEach(() => {
  vi.clearAllTimers();
});

describe("aoVoltarAoPrimeiroPlano — web/PWA", () => {
  it("dispara quando o documento fica visível", () => {
    const cb = vi.fn();
    aoVoltarAoPrimeiroPlano(cb);
    definirVisibilidade("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("NÃO dispara quando o documento fica oculto", () => {
    const cb = vi.fn();
    aoVoltarAoPrimeiroPlano(cb);
    definirVisibilidade("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).not.toHaveBeenCalled();
  });

  it("colapsa avisos próximos dentro da janela de debounce", () => {
    const cb = vi.fn();
    aoVoltarAoPrimeiroPlano(cb, 400);
    definirVisibilidade("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("desmontar remove o ouvinte — sem vazamento entre telas", () => {
    const cb = vi.fn();
    const parar = aoVoltarAoPrimeiroPlano(cb);
    parar();
    definirVisibilidade("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("aoVoltarAoPrimeiroPlano — app empacotado", () => {
  beforeEach(() => isNativeAppMock.mockReturnValue(true));

  it("também escuta appStateChange do Capacitor", async () => {
    const cb = vi.fn();
    aoVoltarAoPrimeiroPlano(cb);
    await Promise.resolve();
    await Promise.resolve();
    expect(addListener).toHaveBeenCalledWith("appStateChange", expect.any(Function));
    appStateHandler?.({ isActive: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("appStateChange com isActive:false não dispara", async () => {
    const cb = vi.fn();
    aoVoltarAoPrimeiroPlano(cb);
    await Promise.resolve();
    await Promise.resolve();
    appStateHandler?.({ isActive: false });
    expect(cb).not.toHaveBeenCalled();
  });

  it("visibilitychange e appStateChange próximos colapsam num só disparo", async () => {
    const cb = vi.fn();
    aoVoltarAoPrimeiroPlano(cb, 400);
    await Promise.resolve();
    await Promise.resolve();
    definirVisibilidade("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    appStateHandler?.({ isActive: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("desmontar remove listener nativo mesmo se o handle chegar depois", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    addListener.mockResolvedValue({ remove });
    const cb = vi.fn();
    const parar = aoVoltarAoPrimeiroPlano(cb);
    parar();
    await Promise.resolve();
    await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
