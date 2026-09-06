import { describe, expect, it } from "vitest";
import { WebWorkoutLiveSurface } from "./WebWorkoutLiveSurface";

describe("WebWorkoutLiveSurface — no-op (P1D)", () => {
  it("iniciar/atualizar/parar não explodem — sem Lock Screen de PWA neste escopo", () => {
    const s = new WebWorkoutLiveSurface();
    expect(() => s.iniciar()).not.toThrow();
    expect(() =>
      s.atualizar({
        status: "ativo",
        tempoLabel: "12:03",
        exercicioNome: "Supino Reto",
        serieLabel: "Série 1 de 4",
        cargaRepsLabel: "60 kg · 10 reps",
        descansoRestanteLabel: null,
      }),
    ).not.toThrow();
    expect(() => s.parar()).not.toThrow();
  });
});
