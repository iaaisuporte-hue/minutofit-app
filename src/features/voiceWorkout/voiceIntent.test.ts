import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "./voiceIntent";

describe("parseVoiceCommand", () => {
  it("reconhece 'fiz 12 com 28 quilos'", () => {
    const { intent } = parseVoiceCommand("fiz 12 com 28 quilos");
    expect(intent).toEqual({ type: "complete_set", reps: 12, loadKg: 28 });
  });

  it("reconhece '12 com 28' sem verbo nem unidade", () => {
    const { intent } = parseVoiceCommand("12 com 28");
    expect(intent).toEqual({ type: "complete_set", reps: 12, loadKg: 28 });
  });

  it("reconhece 'fiz 10 com 30 quilos'", () => {
    const { intent } = parseVoiceCommand("fiz 10 com 30 quilos");
    expect(intent).toEqual({ type: "complete_set", reps: 10, loadKg: 30 });
  });

  it("reconhece número por extenso: 'fiz doze com vinte e oito'", () => {
    const { intent } = parseVoiceCommand("fiz doze com vinte e oito");
    expect(intent).toEqual({ type: "complete_set", reps: 12, loadKg: 28 });
  });

  it("reconhece 'só 12' sem carga", () => {
    const { intent } = parseVoiceCommand("só 12");
    expect(intent).toEqual({ type: "complete_set", reps: 12, loadKg: null });
  });

  it("aceita vírgula decimal na carga", () => {
    const { intent } = parseVoiceCommand("fiz 8 com 27,5");
    expect(intent).toEqual({ type: "complete_set", reps: 8, loadKg: 27.5 });
  });

  it("aceita 'de' no lugar de 'com'", () => {
    const { intent } = parseVoiceCommand("fiz 12 de 28 quilos");
    expect(intent).toEqual({ type: "complete_set", reps: 12, loadKg: 28 });
  });

  it("devolve null para frase fora da gramática mínima", () => {
    const { intent } = parseVoiceCommand("próximo exercício");
    expect(intent).toBeNull();
  });

  it("devolve null para frase vazia", () => {
    const { intent } = parseVoiceCommand("");
    expect(intent).toBeNull();
  });

  it("normaliza acento e caixa no transcript devolvido", () => {
    const { normalized } = parseVoiceCommand("FIZ 12 COM 28 QUILOS!");
    expect(normalized).toBe("fiz 12 com 28 quilos");
  });
});
