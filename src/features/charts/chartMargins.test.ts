/**
 * Contrato: nenhum gráfico recharts usa margem ESQUERDA NEGATIVA. O <svg> tem overflow:hidden, então o eixo Y que "sai" da
 * margem tem as marcas cortadas (medido em Alimentação, Estado metabólico e Evolução — Android, out/2026).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

declare const __dirname: string;
const root = join(__dirname, "../..");
const files: string[] = [];
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(n) && !/\.test\./.test(n)) files.push(p);
  }
};
walk(root);

describe("margens de gráficos recharts", () => {
  it("há gráficos para verificar", () => {
    expect(files.filter((f) => /from ['"]recharts['"]/.test(readFileSync(f, "utf8"))).length).toBeGreaterThanOrEqual(5);
  });
  it("nenhum <LineChart/BarChart/AreaChart margin> com left negativo", () => {
    const bad = files.filter((f) => /<(Line|Bar|Area|Composed)Chart[^>]*margin=\{\{[^}]*left:\s*-\d/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
