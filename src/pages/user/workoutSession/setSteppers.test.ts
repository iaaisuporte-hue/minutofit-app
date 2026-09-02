import { describe, expect, it } from "vitest";
import {
  cargaInicial,
  passoCarga,
  passoReps,
  primeiroNumero,
  repsIniciais,
  serieAtual,
} from "./setSteppers";

describe("cargaInicial — de onde parte o primeiro toque", () => {
  it("respeita o que já está digitado", () => {
    expect(cargaInicial({ atual: "77.5", ultimaCarga: 60 })).toBe(77.5);
  });

  it("a série anterior DESTE treino vence a do último treino", () => {
    // Quem subiu para 85 na série 1 de hoje não quer 80 de volta na série 2.
    expect(cargaInicial({ atual: "", cargaSerieAnterior: "85", ultimaCarga: 80 })).toBe(85);
  });

  it("sem série anterior, usa a última carga conhecida", () => {
    expect(cargaInicial({ atual: "", ultimaCarga: 80 })).toBe(80);
  });

  it("sem referência nenhuma, começa do zero", () => {
    expect(cargaInicial({ atual: "" })).toBe(0);
  });

  it("aceita vírgula decimal (teclado pt-BR)", () => {
    expect(cargaInicial({ atual: "82,5" })).toBe(82.5);
  });

  it("texto inválido não vira NaN", () => {
    expect(cargaInicial({ atual: "abc", ultimaCarga: 40 })).toBe(40);
  });
});

describe("passoCarga", () => {
  it("soma e subtrai mantendo a meia anilha", () => {
    expect(passoCarga(80, 2.5)).toBe("82.5");
    expect(passoCarga(82.5, -2.5)).toBe("80");
    expect(passoCarga(80, 5)).toBe("85");
  });

  it("nunca desce abaixo de zero", () => {
    expect(passoCarga(2, -5)).toBe("0");
    expect(passoCarga(0, -2.5)).toBe("0");
  });

  it("tem teto — toque preso no + não vira carga absurda", () => {
    expect(passoCarga(998, 5)).toBe("999");
  });

  it("não deixa resíduo de ponto flutuante", () => {
    // 0.1+0.2 clássico: sem arredondar viria "82.50000000000001"
    expect(passoCarga(82.4, 0.1)).toBe("82.5");
  });
});

describe("repsIniciais — a prescrição é o alvo", () => {
  it("parte do primeiro número da prescrição", () => {
    expect(repsIniciais({ atual: "", prescritas: "10-12" })).toBe(10);
    expect(repsIniciais({ atual: "", prescritas: "12" })).toBe(12);
  });

  it("prescrição sem número cai na série anterior", () => {
    expect(repsIniciais({ atual: "", prescritas: "até a falha", repsSerieAnterior: "8" })).toBe(8);
  });

  it("o que já está digitado vence tudo", () => {
    expect(repsIniciais({ atual: "9", prescritas: "12" })).toBe(9);
  });
});

describe("primeiroNumero", () => {
  it("lê prescrição escrita à mão pelo personal", () => {
    expect(primeiroNumero("10-12")).toBe(10);
    expect(primeiroNumero("8 a 10")).toBe(8);
    expect(primeiroNumero("15")).toBe(15);
    expect(primeiroNumero("até a falha")).toBeNull();
    expect(primeiroNumero("")).toBeNull();
  });
});

describe("passoReps", () => {
  it("anda de 1 em 1 e não fica negativo", () => {
    expect(passoReps(10, 1)).toBe("11");
    expect(passoReps(1, -1)).toBe("0");
    expect(passoReps(0, -1)).toBe("0");
  });

  it("arredonda — reps é contagem, não medida", () => {
    expect(passoReps(9.5, 1)).toBe("11");
  });
});

describe("serieAtual — a série que o botão grande opera", () => {
  it("é a primeira não concluída", () => {
    const sets = [
      { setIndex: 1, done: true },
      { setIndex: 2, done: false },
      { setIndex: 3, done: false },
    ];
    expect(serieAtual(sets)?.setIndex).toBe(2);
  });

  it("pula buracos: uma série desmarcada no meio volta a ser a atual", () => {
    const sets = [
      { setIndex: 1, done: true },
      { setIndex: 2, done: false },
      { setIndex: 3, done: true },
    ];
    expect(serieAtual(sets)?.setIndex).toBe(2);
  });

  it("exercício concluído não tem série atual", () => {
    expect(serieAtual([{ setIndex: 1, done: true }])).toBeNull();
  });
});
