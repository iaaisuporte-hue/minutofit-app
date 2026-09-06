import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoTreinoVisivel } from "./WorkoutLiveSurface";

/**
 * Contrato JS ↔ nativo do serviço de treino (P1D). O lado Java tem seu
 * próprio comportamento (não testável em CI sem toolchain Android); aqui
 * trava-se o que o TypeScript promete a quem chama.
 */

const start = vi.fn();
const update = vi.fn();
const stop = vi.fn();

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    start: (...a: unknown[]) => start(...a),
    update: (...a: unknown[]) => update(...a),
    stop: (...a: unknown[]) => stop(...a),
  }),
}));

const { NativeWorkoutLiveSurface } = await import("./NativeWorkoutLiveSurface");

const base: EstadoTreinoVisivel = {
  status: "ativo",
  tempoLabel: "12:03",
  exercicioNome: "Supino Reto",
  serieLabel: "Série 1 de 4",
  cargaRepsLabel: "60 kg · 10 reps",
  descansoRestanteLabel: null,
};

beforeEach(() => {
  start.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
  stop.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("NativeWorkoutLiveSurface — sessão", () => {
  it("iniciar() chama start()", () => {
    new NativeWorkoutLiveSurface().iniciar();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("parar() chama stop() — seguro mesmo sem sessão em curso", () => {
    const s = new NativeWorkoutLiveSurface();
    expect(() => s.parar()).not.toThrow();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("é fire-and-forget: rejeição do bridge não escapa como exceção síncrona", () => {
    start.mockRejectedValueOnce(new Error("bridge indisponível"));
    expect(() => new NativeWorkoutLiveSurface().iniciar()).not.toThrow();
  });
});

describe("NativeWorkoutLiveSurface — título por status (P1D)", () => {
  it("ativo: título normal, corpo com tempo/exercício/série/carga", () => {
    new NativeWorkoutLiveSurface().atualizar(base);
    expect(update).toHaveBeenCalledWith({
      title: "S2Core · Treino em andamento",
      body: "12:03 · Supino Reto · Série 1 de 4 · 60 kg · 10 reps",
    });
  });

  it("ativo sem carga/reps digitados: corpo não inventa placeholder", () => {
    new NativeWorkoutLiveSurface().atualizar({ ...base, cargaRepsLabel: null });
    expect(update).toHaveBeenCalledWith({
      title: "S2Core · Treino em andamento",
      body: "12:03 · Supino Reto · Série 1 de 4",
    });
  });

  it("descansando: título de descanso, corpo prioriza o restante e a próxima série", () => {
    new NativeWorkoutLiveSurface().atualizar({
      ...base,
      status: "descansando",
      descansoRestanteLabel: "0:57",
      serieLabel: "Série 2 de 4",
    });
    expect(update).toHaveBeenCalledWith({
      title: "S2Core · Descanso",
      body: "0:57 · Próxima: Supino Reto · Série 2 de 4",
    });
  });

  it("descanso_pausado: título distinto — é o único pause real que existe no motor", () => {
    new NativeWorkoutLiveSurface().atualizar({
      ...base,
      status: "descanso_pausado",
      descansoRestanteLabel: "0:40",
    });
    expect(update).toHaveBeenCalledWith({
      title: "S2Core · Descanso pausado",
      body: expect.stringContaining("0:40"),
    });
  });

  it("descanso sem restante conhecido cai num fallback honesto, não number quebrado", () => {
    new NativeWorkoutLiveSurface().atualizar({ ...base, status: "descansando", descansoRestanteLabel: null });
    const chamada = update.mock.calls[0][0] as { body: string };
    expect(chamada.body).toContain("--:--");
    expect(chamada.body).not.toContain("NaN");
    expect(chamada.body).not.toContain("undefined");
  });
});
