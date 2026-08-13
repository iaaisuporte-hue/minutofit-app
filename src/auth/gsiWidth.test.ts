/**
 * Largura do botão do Google — regressão do ISSUE-001 (/qa, ago/2026).
 *
 * O login e o cadastro rolavam de lado a 320 e 360px, as duas larguras Android
 * mais comuns do Brasil. Causa: `renderButton({ width: 320 })` fixo, e o Google
 * renderiza o iframe com ~20px a mais que o pedido — 340 num container de 296.
 *
 * Provado no navegador: zerar a largura do iframe derrubava o `scrollWidth` de
 * 374 para 360.
 */
import { describe, expect, it } from "vitest";
import { gsiWidth } from "./GoogleSignInButton";

describe("gsiWidth", () => {
  it("desconta o chrome que o Google acrescenta por conta própria", () => {
    // Num container de 296px o iframe precisa sair com 296 — logo, pedimos 276.
    expect(gsiWidth(296)).toBe(276);
  });

  it("o caso que quebrava: 360px de viewport cabe sem estourar", () => {
    // 360 − 24 (padding da página) − 40 (padding do cartão) = 296 disponíveis.
    const disponivel = 360 - 24 - 40;
    expect(gsiWidth(disponivel) + 20).toBeLessThanOrEqual(disponivel);
  });

  it("o caso mais apertado: 320px de viewport também cabe", () => {
    const disponivel = 320 - 24 - 40;
    // O piso do GIS é 200, então aqui o botão bate no mínimo aceito.
    expect(gsiWidth(disponivel)).toBe(236);
    expect(gsiWidth(disponivel) + 20).toBeLessThanOrEqual(disponivel);
  });

  it("respeita o piso do GIS — abaixo de 200 ele ignora o parâmetro", () => {
    // Ignorar o parâmetro devolveria o padrão largo, que é o bug de novo.
    expect(gsiWidth(100)).toBe(200);
    expect(gsiWidth(1)).toBe(200);
  });

  it("respeita o teto do GIS", () => {
    expect(gsiWidth(9999)).toBe(400);
  });

  it("container ainda sem layout cai no padrão, não em NaN nem zero", () => {
    // `clientWidth` é 0 antes do primeiro layout; pedir 0 ou NaN ao GIS faria
    // ele ignorar o parâmetro.
    for (const v of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      const w = gsiWidth(v);
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(200);
      expect(w).toBeLessThanOrEqual(400);
    }
  });

  it("é sempre inteiro — fração faria o GIS arredondar por conta dele", () => {
    expect(Number.isInteger(gsiWidth(296.7))).toBe(true);
    expect(gsiWidth(296.7)).toBe(276);
  });
});
