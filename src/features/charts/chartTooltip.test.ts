/**
 * Tooltip dos gráficos: fundo/rótulo/itens vêm de TOKENS (nunca do branco inline do recharts) e o par texto×fundo passa
 * WCAG AA (≥4,5:1) nos dois temas. A medição no navegador (estado real) está em scripts/qa-mobile-layout/alimentacao-regressao.mjs.
 */
import { describe, expect, it } from "vitest";
import { chartTooltipProps } from "./chartTooltip";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest injeta __dirname; `new URL(import.meta.url)` não é file: no jsdom
declare const __dirname: string;
const css = readFileSync(resolve(__dirname, "../../styles/tokens.css"), "utf8");
const block = (start: string) => { const i = css.indexOf(start); return css.slice(i, css.indexOf("\n}", i)); };
const token = (b: string, name: string) => (b.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)) ?? [])[1];
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("chartTooltipProps", () => {
  it("usa tokens do tema (sem cor fixa) para fundo, rótulo e item", () => {
    expect(chartTooltipProps.contentStyle.backgroundColor).toBe("var(--color-surface)");
    expect(chartTooltipProps.labelStyle.color).toBe("var(--color-text)");
    expect(chartTooltipProps.itemStyle.color).toBe("var(--color-text)");
  });
  it.each([[":root {", "claro"], ['html[data-theme="dark"] {', "escuro"]])("texto × fundo ≥ 4,5:1 no tema %s", (start) => {
    const b = block(start);
    expect(ratio(token(b, "--color-text"), token(b, "--color-surface"))).toBeGreaterThanOrEqual(4.5);
  });
});
