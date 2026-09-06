import { afterEach, describe, expect, it, vi } from "vitest";

const getPlatformMock = vi.fn();
vi.mock("../../../lib/platform", () => ({ getPlatform: () => getPlatformMock() }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({}) }));

const { createLocationTracker } = await import("./createLocationTracker");

afterEach(() => vi.restoreAllMocks());

describe("createLocationTracker — escolha por plataforma (P1B)", () => {
  it("Android recebe o tracker nativo com serviço de primeiro plano", () => {
    getPlatformMock.mockReturnValue("android");
    const t = createLocationTracker();
    expect(t.nome).toBe("android-foreground-service");
    expect(t.suportaSegundoPlano).toBe(true);
  });

  it("iOS cai na web — sem plugin nativo do lado iOS nesta fase", () => {
    getPlatformMock.mockReturnValue("ios");
    const t = createLocationTracker();
    expect(t.nome).toBe("web-geolocation");
    expect(t.suportaSegundoPlano).toBe(false);
  });

  it("web usa a implementação de sempre", () => {
    getPlatformMock.mockReturnValue("web");
    const t = createLocationTracker();
    expect(t.nome).toBe("web-geolocation");
  });
});
