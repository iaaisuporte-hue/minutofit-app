import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrato JS ↔ nativo do serviço de primeiro plano (P1B). O lado Java tem seu
 * próprio comportamento (não testável em CI sem toolchain Android — ver
 * relatório); aqui trava-se o que o TypeScript promete a quem chama.
 */

const start = vi.fn();
const pause = vi.fn();
const resume = vi.fn();
const stop = vi.fn();
const drain = vi.fn();
const updateState = vi.fn();
const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const addListener = vi.fn();

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    start: (...a: unknown[]) => start(...a),
    pause: (...a: unknown[]) => pause(...a),
    resume: (...a: unknown[]) => resume(...a),
    stop: (...a: unknown[]) => stop(...a),
    drain: (...a: unknown[]) => drain(...a),
    updateState: (...a: unknown[]) => updateState(...a),
    checkPermissions: (...a: unknown[]) => checkPermissions(...a),
    requestPermissions: (...a: unknown[]) => requestPermissions(...a),
    addListener: (...a: unknown[]) => addListener(...a),
  }),
}));

const { NativeLocationTracker } = await import("./NativeLocationTracker");

beforeEach(() => {
  start.mockReset().mockResolvedValue(undefined);
  pause.mockReset().mockResolvedValue(undefined);
  resume.mockReset().mockResolvedValue(undefined);
  stop.mockReset().mockResolvedValue(undefined);
  drain.mockReset().mockResolvedValue({ points: [], running: true });
  updateState.mockReset().mockResolvedValue(undefined);
  checkPermissions.mockReset().mockResolvedValue({ location: "granted" });
  requestPermissions.mockReset().mockResolvedValue({ location: "granted" });
  addListener.mockReset().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NativeLocationTracker — identidade", () => {
  it("declara suporte a segundo plano — é a razão de existir", () => {
    const t = new NativeLocationTracker();
    expect(t.suportaSegundoPlano).toBe(true);
    expect(t.disponivel()).toBe(true);
  });
});

describe("NativeLocationTracker — permissão", () => {
  it("traduz granted/denied/prompt para o vocabulário da porta", async () => {
    const t = new NativeLocationTracker();
    checkPermissions.mockResolvedValueOnce({ location: "granted" });
    expect(await t.estadoPermissao()).toBe("concedida");
    checkPermissions.mockResolvedValueOnce({ location: "denied" });
    expect(await t.estadoPermissao()).toBe("negada");
    checkPermissions.mockResolvedValueOnce({ location: "prompt" });
    expect(await t.estadoPermissao()).toBe("nao_solicitada");
  });

  it("solicitarPermissao chama requestPermissions e traduz o resultado", async () => {
    const t = new NativeLocationTracker();
    requestPermissions.mockResolvedValueOnce({ location: "denied" });
    expect(await t.solicitarPermissao()).toBe("negada");
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });
});

describe("NativeLocationTracker — sessão", () => {
  it("iniciar() sobe o serviço e assina o evento location", () => {
    const t = new NativeLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) }));
    expect(addListener).toHaveBeenCalledWith("location", expect.any(Function));
  });

  it("evento location vira PontoBruto e chega ao onPonto", async () => {
    const t = new NativeLocationTracker();
    const onPonto = vi.fn();
    let handler: ((p: unknown) => void) | undefined;
    addListener.mockImplementation((_evt, cb) => {
      handler = cb;
      return Promise.resolve({ remove: vi.fn().mockResolvedValue(undefined) });
    });
    t.iniciar({ onPonto });
    await Promise.resolve();
    handler?.({ lat: -23.5, lng: -46.6, accuracy: 8, altitude: 12, timestamp: 5000, sequence: 1 });
    expect(onPonto).toHaveBeenCalledWith({ lat: -23.5, lng: -46.6, accuracy: 8, altitude: 12, timestamp: 5000 });
  });

  it("pausar() chama pause() sem tocar em start/stop", () => {
    const t = new NativeLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    t.pausar();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  });

  it("retomar() chama resume() sem reiniciar o serviço", () => {
    const t = new NativeLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    start.mockClear();
    t.retomar();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("parar() encerra o serviço", () => {
    const t = new NativeLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    t.parar();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("parar() sem sessão em curso não explode — é o caminho defensivo do descarte", () => {
    const t = new NativeLocationTracker();
    expect(() => t.parar()).not.toThrow();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("um ponto chegando DEPOIS de parar() não alimenta onPonto (sessão cancelada)", async () => {
    const t = new NativeLocationTracker();
    const onPonto = vi.fn();
    let handler: ((p: unknown) => void) | undefined;
    addListener.mockImplementation((_evt, cb) => {
      handler = cb;
      return Promise.resolve({ remove: vi.fn().mockResolvedValue(undefined) });
    });
    t.iniciar({ onPonto });
    await Promise.resolve();
    t.parar();
    handler?.({ lat: 1, lng: 2, accuracy: null, altitude: null, timestamp: 1, sequence: 1 });
    expect(onPonto).not.toHaveBeenCalled();
  });

  it("start() rejeitando por permissão vira erro permissao_negada", async () => {
    const t = new NativeLocationTracker();
    const onErro = vi.fn();
    start.mockRejectedValueOnce(new Error("location_permission_denied"));
    t.iniciar({ onPonto: vi.fn(), onErro });
    await Promise.resolve();
    await Promise.resolve();
    expect(onErro).toHaveBeenCalledWith({ tipo: "permissao_negada" });
  });

  it("start() rejeitando por outro motivo vira indisponivel", async () => {
    const t = new NativeLocationTracker();
    const onErro = vi.fn();
    start.mockRejectedValueOnce(new Error("boom"));
    t.iniciar({ onPonto: vi.fn(), onErro });
    await Promise.resolve();
    await Promise.resolve();
    expect(onErro).toHaveBeenCalledWith({ tipo: "indisponivel" });
  });
});

describe("NativeLocationTracker — estado visível na notificação (P1C)", () => {
  it("atualizarEstadoVisivel chama updateState com os campos já formatados", () => {
    const t = new NativeLocationTracker();
    t.atualizarEstadoVisivel({
      tempoLabel: "00:12:03",
      distanciaLabel: "2.14 km",
      metricaValor: "5:38",
      metricaUnidade: "/km",
    });
    expect(updateState).toHaveBeenCalledWith({
      elapsed: "00:12:03",
      distance: "2.14 km",
      metricValue: "5:38",
      metricUnit: "/km",
    });
  });

  it("não envia campo de pausa — o nativo já sabe pelo pausar()/retomar() anteriores", () => {
    const t = new NativeLocationTracker();
    t.atualizarEstadoVisivel({ tempoLabel: "00:00:01", distanciaLabel: "0.00 km", metricaValor: "--", metricaUnidade: "/km" });
    const enviado = updateState.mock.calls[0][0];
    expect(Object.keys(enviado).sort()).toEqual(["distance", "elapsed", "metricUnit", "metricValue"]);
  });

  it("é fire-and-forget: rejeição do bridge não escapa como exceção síncrona", () => {
    const t = new NativeLocationTracker();
    updateState.mockRejectedValueOnce(new Error("bridge indisponível"));
    expect(() =>
      t.atualizarEstadoVisivel({ tempoLabel: "00:00:01", distanciaLabel: "0.00 km", metricaValor: "--", metricaUnidade: "/km" }),
    ).not.toThrow();
  });
});

describe("NativeLocationTracker — dreno de pontos acumulados", () => {
  it("drenar() converte os pontos da fila nativa para PontoBruto", async () => {
    const t = new NativeLocationTracker();
    drain.mockResolvedValueOnce({
      points: [{ lat: 1, lng: 2, accuracy: 5, altitude: null, timestamp: 100, sequence: 1 }],
      running: true,
    });
    const pontos = await t.drenar();
    expect(pontos).toEqual([{ lat: 1, lng: 2, accuracy: 5, altitude: null, timestamp: 100 }]);
  });

  it("drenar() sem pontos acumulados devolve lista vazia", async () => {
    const t = new NativeLocationTracker();
    drain.mockResolvedValueOnce({ points: [], running: true });
    expect(await t.drenar()).toEqual([]);
  });

  it("falha no dreno não derruba a tela — devolve vazio", async () => {
    const t = new NativeLocationTracker();
    drain.mockRejectedValueOnce(new Error("bridge indisponível"));
    expect(await t.drenar()).toEqual([]);
  });
});
