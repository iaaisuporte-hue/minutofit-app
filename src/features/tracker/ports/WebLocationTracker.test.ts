import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebLocationTracker } from "./WebLocationTracker";

/**
 * P1B: pausar/retomar precisam soltar e re-adquirir o receptor de GPS SEM
 * perder a sessão — e `parar()` precisa ser seguro mesmo sem nada em curso,
 * porque é o mesmo caminho usado como defensivo no descarte de um rascunho
 * recuperado (ver `ActivityTrackerPage`).
 */

let watchId = 0;
const watchPosition = vi.fn(() => ++watchId);
const clearWatch = vi.fn();

beforeEach(() => {
  watchId = 0;
  watchPosition.mockClear();
  clearWatch.mockClear();
  Object.defineProperty(global.navigator, "geolocation", {
    value: {
      watchPosition: (ok: PositionCallback) => {
        const id = watchPosition();
        // Simula uma leitura imediata, como o browser normalmente entrega.
        queueMicrotask(() =>
          ok({
            coords: { latitude: -23.5, longitude: -46.6, accuracy: 5, altitude: null },
            timestamp: 1000,
          } as GeolocationPosition),
        );
        return id;
      },
      clearWatch,
      getCurrentPosition: vi.fn(),
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebLocationTracker — pausar/retomar sem perder a sessão", () => {
  it("iniciar() assina o watchPosition e entrega pontos", async () => {
    const t = new WebLocationTracker();
    const onPonto = vi.fn();
    t.iniciar({ onPonto });
    await Promise.resolve();
    expect(onPonto).toHaveBeenCalledWith(expect.objectContaining({ lat: -23.5, lng: -46.6 }));
  });

  it("pausar() solta o receptor — para de gastar bateria com o GPS", () => {
    const t = new WebLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    t.pausar();
    expect(clearWatch).toHaveBeenCalledTimes(1);
  });

  it("retomar() reabre o receptor com o MESMO callback, sem chamar iniciar() de novo", async () => {
    const t = new WebLocationTracker();
    const onPonto = vi.fn();
    t.iniciar({ onPonto });
    await Promise.resolve();
    t.pausar();
    watchPosition.mockClear();
    t.retomar();
    expect(watchPosition).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(onPonto).toHaveBeenCalled();
  });

  it("retomar() sem ter pausado antes é no-op — não assina duas vezes", async () => {
    const t = new WebLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    await Promise.resolve();
    watchPosition.mockClear();
    t.retomar();
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("parar() sem nenhuma sessão em curso não explode", () => {
    const t = new WebLocationTracker();
    expect(() => t.parar()).not.toThrow();
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it("parar() depois de retomar() não reativa a coleta (reseta as opções)", async () => {
    const t = new WebLocationTracker();
    t.iniciar({ onPonto: vi.fn() });
    await Promise.resolve();
    t.parar();
    watchPosition.mockClear();
    t.retomar();
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("drenar() sempre devolve vazio — nada acumula do lado que já dorme junto", async () => {
    const t = new WebLocationTracker();
    await expect(t.drenar()).resolves.toEqual([]);
  });

  it("atualizarEstadoVisivel é no-op — sem Lock Screen de PWA neste escopo (P1C)", () => {
    const t = new WebLocationTracker();
    expect(() =>
      t.atualizarEstadoVisivel({ tempoLabel: "00:00:05", distanciaLabel: "0.01 km", metricaValor: "--", metricaUnidade: "/km" }),
    ).not.toThrow();
  });
});
