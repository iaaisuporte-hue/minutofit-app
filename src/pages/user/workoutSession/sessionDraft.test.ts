/**
 * Fingerprint da ficha guardado no rascunho.
 *
 * Ele existe para responder uma pergunta na retomada: a ficha mudou desde que o
 * aluno começou? Comparar comprimento não responde — o personal pode trocar o
 * exercício, as repetições ou a ordem sem mexer na quantidade, e o aluno
 * continuaria executando a versão antiga sem saber.
 */
import { describe, expect, it } from "vitest";
import { computePrescribedBaseline, type PrescribedBaselineItem } from "./sessionDraft";

const supino: PrescribedBaselineItem = {
  exerciseId: "ex-1",
  name: "Supino reto",
  sets: "4",
  reps: "8",
  rest: "90s",
};
const remada: PrescribedBaselineItem = {
  exerciseId: "ex-2",
  name: "Remada curvada",
  sets: "3",
  reps: "10",
  rest: "60s",
};

describe("computePrescribedBaseline", () => {
  it("a mesma ficha dá sempre a mesma string", () => {
    expect(computePrescribedBaseline([supino, remada])).toBe(
      computePrescribedBaseline([supino, remada]),
    );
  });

  it("reordenar conta como ficha diferente — a comparação é posicional", () => {
    expect(computePrescribedBaseline([supino, remada])).not.toBe(
      computePrescribedBaseline([remada, supino]),
    );
  });

  it("mudar as repetições muda a string", () => {
    expect(computePrescribedBaseline([{ ...supino, reps: "12" }, remada])).not.toBe(
      computePrescribedBaseline([supino, remada]),
    );
  });

  it("trocar o exercício mantendo o resto muda a string", () => {
    expect(computePrescribedBaseline([{ ...supino, exerciseId: "ex-9" }])).not.toBe(
      computePrescribedBaseline([supino]),
    );
  });

  it("acrescentar ou tirar item muda a string", () => {
    expect(computePrescribedBaseline([supino])).not.toBe(computePrescribedBaseline([supino, remada]));
  });

  it("emparelhar dois exercícios em Bi-Set muda a string", () => {
    const soltos = computePrescribedBaseline([supino, remada]);
    const pareados = computePrescribedBaseline([
      { ...supino, technique: { type: "bi_set", biSetGroupId: "g1" } },
      { ...remada, technique: { type: "bi_set", biSetGroupId: "g1" } },
    ]);
    expect(pareados).not.toBe(soltos);
  });

  it("campo de técnica ausente e nulo dão a mesma string", () => {
    expect(computePrescribedBaseline([{ ...supino, technique: null }])).toBe(
      computePrescribedBaseline([supino]),
    );
  });

  it("ficha vazia tem baseline estável", () => {
    expect(computePrescribedBaseline([])).toBe(computePrescribedBaseline([]));
  });
});
