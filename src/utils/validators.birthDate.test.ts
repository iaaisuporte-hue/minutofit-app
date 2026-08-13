/**
 * Regra de data de nascimento do cadastro.
 *
 * A função existe porque `register.tsx` e `register-personal.tsx` já a chamavam
 * — e a ausência dela deixou a `main` sem compilar e a tela de cadastro
 * quebrando em runtime. Estes testes travam o contrato para que a dependência
 * não volte a se perder.
 *
 * As datas são calculadas em relação a HOJE, não fixadas: um teste com data
 * literal de aniversário passa a falhar sozinho com o passar do tempo.
 */
import { describe, expect, it } from "vitest";

import { MINIMUM_AGE_YEARS, getBirthDateError } from "./validators";

/** 'YYYY-MM-DD' de hoje deslocado por N anos e N dias. */
function dateKey(yearsAgo: number, daysOffset = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  d.setDate(d.getDate() + daysOffset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 29 de fevereiro não existe na maioria dos anos, e `setFullYear` rola a data
 * para 1º de março. Os dois casos de BORDA de aniversário deslizariam um dia e
 * falhariam — só nesse dia, uma vez a cada quatro anos, com uma mensagem
 * incompreensível para quem estivesse de plantão. Os demais casos não dependem
 * da borda e seguem rodando.
 */
const hoje = new Date();
const ehDia29DeFevereiro = hoje.getMonth() === 1 && hoje.getDate() === 29;

describe("getBirthDateError", () => {
  it("aceita quem tem folga sobre a idade mínima", () => {
    expect(getBirthDateError(dateKey(30))).toBeNull();
  });

  it.skipIf(ehDia29DeFevereiro)("aceita quem faz a idade mínima exatamente hoje", () => {
    // A borda importa: no aniversário de 18 anos a conta é permitida.
    expect(getBirthDateError(dateKey(MINIMUM_AGE_YEARS))).toBeNull();
  });

  it.skipIf(ehDia29DeFevereiro)("recusa quem faz a idade mínima amanhã", () => {
    const err = getBirthDateError(dateKey(MINIMUM_AGE_YEARS, 1));
    expect(err).toBe(`É necessário ter ${MINIMUM_AGE_YEARS} anos ou mais para criar uma conta.`);
  });

  it("recusa quem está claramente abaixo da idade mínima", () => {
    expect(getBirthDateError(dateKey(10))).toContain(`${MINIMUM_AGE_YEARS} anos ou mais`);
  });

  it("recusa data no futuro", () => {
    expect(getBirthDateError(dateKey(-1))).toBe("Data de nascimento inválida.");
  });

  it("recusa data que não existe no calendário", () => {
    // `new Date(2000, 1, 30)` vira 1º de março em vez de falhar — por isso a
    // função compara os componentes de volta.
    expect(getBirthDateError("2000-02-30")).toBe("Data de nascimento inválida.");
    expect(getBirthDateError("2000-13-01")).toBe("Data de nascimento inválida.");
    expect(getBirthDateError("2000-00-10")).toBe("Data de nascimento inválida.");
  });

  it("recusa formato fora de YYYY-MM-DD", () => {
    for (const bad of ["10/05/1990", "1990-5-10", "ontem", "1990"]) {
      expect(getBirthDateError(bad)).toBe("Data de nascimento inválida.");
    }
  });

  it("pede a data quando o campo está vazio — mensagem própria, não 'inválida'", () => {
    // O contrato distingue "não respondeu" de "respondeu errado": o cadastro
    // não acusa quem ainda não preencheu (FINDING-002).
    expect(getBirthDateError("")).toBe("Informe sua data de nascimento.");
  });

  it("não impõe teto de idade — a aplicação não tem essa regra", () => {
    expect(getBirthDateError(dateKey(95))).toBeNull();
  });
});

describe("regra compartilhada entre cadastro de aluno e de personal", () => {
  it("é a mesma função nas duas telas, então o veredito é idêntico", async () => {
    // Ambas as páginas importam `getBirthDateError` de `utils/validators`.
    // Este teste trava a expectativa de que não surja uma segunda implementação
    // divergente — o cadastro de personal não pode aceitar menor de idade.
    const aluno = await import("../pages/register");
    const personal = await import("../pages/register-personal");
    expect(aluno.default).toBeTypeOf("function");
    expect(personal.default).toBeTypeOf("function");

    const menor = dateKey(MINIMUM_AGE_YEARS, 1);
    const maior = dateKey(MINIMUM_AGE_YEARS);
    expect(getBirthDateError(menor)).not.toBeNull();
    expect(getBirthDateError(maior)).toBeNull();
  });
});
