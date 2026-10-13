import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..");
const tokens = readFileSync(join(src, "styles/tokens.css"), "utf8");
const tok = (name: string) => Number(new RegExp(`--${name}:\\s*(\\d+)`).exec(tokens)?.[1]);

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|css)$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

describe("contrato de empilhamento (z-index)", () => {
  it("a escala de tokens é estritamente crescente na ordem declarada", () => {
    const ordem = ["z-topbar", "z-mini-player", "z-nav", "z-fab", "z-consent", "z-modal", "z-status", "z-toast"].map(tok);
    expect(ordem.every((n) => Number.isFinite(n))).toBe(true);
    for (let i = 1; i < ordem.length; i++) expect(ordem[i]).toBeGreaterThan(ordem[i - 1]);
  });

  it("o toast fica acima de qualquer z-index numérico do app (modais inline legados)", () => {
    const toast = tok("z-toast");
    const max = walk(src)
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/z-?[iI]ndex:\s*['"]?(\d{3,5})/g)].map((m) => Number(m[1])))
      .reduce((a, b) => Math.max(a, b), 0);
    expect(max).toBeGreaterThan(0);
    expect(toast).toBeGreaterThan(max);
  });
});
