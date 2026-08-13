/**
 * Séries preenchidas e não marcadas — a regra que decide se um treino conta.
 *
 * Estes testes existem por causa de um defeito real: cinco sessões chegaram à
 * produção com dezenas de séries e ZERO feitas, porque o aluno preencheu a
 * ficha inteira sem tocar no ✓ e o payload descarta tudo que não está marcado.
 * Um aluno relatou como "treinei a semana toda e o sistema não mostra".
 */
import { describe, expect, it } from "vitest";
import { findFilledUnchecked, isFilled, markFilledDone } from "./filledSets";

const set = (over: Partial<Parameters<typeof isFilled>[0]> = {}) => ({
  setIndex: 1,
  done: false,
  reps: "",
  loadKg: "",
  ...over,
});

describe("isFilled — o aluno escreveu algo?", () => {
  it("repetições bastam", () => {
    expect(isFilled(set({ reps: "12" }))).toBe(true);
  });

  it("carga basta", () => {
    expect(isFilled(set({ loadKg: "40" }))).toBe(true);
  });

  it("só repetições é o caso do peso corporal — precisa contar", () => {
    // Exigir carga E repetições deixaria de fora um treino que existe.
    expect(isFilled(set({ reps: "15", loadKg: "" }))).toBe(true);
  });

  it("campo vazio, espaços ou ausente não são preenchimento", () => {
    expect(isFilled(set())).toBe(false);
    expect(isFilled(set({ reps: "   " }))).toBe(false);
    expect(isFilled(set({ reps: null, loadKg: undefined }))).toBe(false);
  });
});

describe("findFilledUnchecked", () => {
  it("acha o trabalho que seria descartado ao salvar", () => {
    const exercicios = [
      { sets: [set({ setIndex: 1, reps: "10", loadKg: "40" }), set({ setIndex: 2 })] },
      { sets: [set({ setIndex: 1, loadKg: "60" })] },
    ];
    expect(findFilledUnchecked(exercicios)).toEqual([
      { exIndex: 0, setIndex: 1 },
      { exIndex: 1, setIndex: 1 },
    ]);
  });

  it("série já marcada não entra — ela vai ser salva de qualquer jeito", () => {
    const exercicios = [{ sets: [set({ reps: "10", done: true })] }];
    expect(findFilledUnchecked(exercicios)).toEqual([]);
  });

  it("série vazia não entra — ninguém registrou nada nela", () => {
    expect(findFilledUnchecked([{ sets: [set(), set({ setIndex: 2 })] }])).toEqual([]);
  });

  it("ficha inteira preenchida e nada marcado: é o caso que gerou o defeito", () => {
    // Este é o formato exato das sessões abandonadas em produção.
    const exercicios = [
      { sets: [set({ setIndex: 1, reps: "12", loadKg: "40" }), set({ setIndex: 2, reps: "10", loadKg: "40" })] },
      { sets: [set({ setIndex: 1, reps: "8", loadKg: "60" })] },
    ];
    expect(findFilledUnchecked(exercicios)).toHaveLength(3);
  });

  it("lista vazia não quebra", () => {
    expect(findFilledUnchecked([])).toEqual([]);
  });
});

describe("markFilledDone", () => {
  const agora = 1_760_000_000_000;

  it("marca o que foi preenchido e carimba a hora", () => {
    const [ex] = markFilledDone([{ sets: [set({ reps: "10" })] }], agora);
    expect(ex.sets[0].done).toBe(true);
    expect((ex.sets[0] as { completedAt?: number }).completedAt).toBe(agora);
  });

  it("NÃO marca série vazia — quem pulou o exercício continua com ele pulado", () => {
    // A função converte trabalho registrado; não presume trabalho que ninguém
    // registrou. Marcar tudo inflaria frequência e recorde com dado inventado.
    const [ex] = markFilledDone([{ sets: [set(), set({ setIndex: 2, reps: "10" })] }], agora);
    expect(ex.sets[0].done).toBe(false);
    expect(ex.sets[1].done).toBe(true);
  });

  it("não mexe em série já marcada", () => {
    const original = set({ reps: "10", done: true, setIndex: 3 });
    const [ex] = markFilledDone([{ sets: [original] }], agora);
    expect(ex.sets[0].done).toBe(true);
  });

  it("não muta a entrada", () => {
    const entrada = [{ sets: [set({ reps: "10" })] }];
    const copia = JSON.parse(JSON.stringify(entrada));
    markFilledDone(entrada, agora);
    expect(entrada).toEqual(copia);
  });

  it("depois de marcar, não sobra nada a descartar", () => {
    const exercicios = [
      { sets: [set({ setIndex: 1, reps: "12" }), set({ setIndex: 2, loadKg: "40" })] },
      { sets: [set({ setIndex: 1 })] },
    ];
    expect(findFilledUnchecked(markFilledDone(exercicios, agora))).toEqual([]);
  });

  it("atravessa vários exercícios de uma vez", () => {
    const exercicios = [
      { sets: [set({ reps: "10" })] },
      { sets: [set({ loadKg: "50" })] },
      { sets: [set()] },
    ];
    const marcados = markFilledDone(exercicios, agora);
    expect(marcados.map((e) => e.sets[0].done)).toEqual([true, true, false]);
  });
});
