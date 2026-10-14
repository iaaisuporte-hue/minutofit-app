import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

/**
 * Condição ÚNICA da "paisagem baixa" (844×390, 932×430...): tem de ser a mesma em todos os arquivos.
 * O `min-width: 600px` é o que impede o teclado do Android, que encolhe a viewport de layout, de
 * transformar um celular em RETRATO (360×340) em "paisagem baixa" e compactar nav/banner no meio da digitação.
 */
const LOW_LANDSCAPE = "@media (min-width: 600px) and (max-height: 500px) and (orientation: landscape)";

const FILES = [
  "../styles/tokens.css",
  "../styles/cookieConsent.css",
  "../pages/user/workoutSession/workoutSession.css",
  "../pages/user/movementLab.css",
];

describe("paisagem baixa — condição única", () => {
  for (const f of FILES) {
    it(`${f} usa só a condição cercada por largura e marcada`, () => {
      const css = read(f);
      expect(css).toContain(`/* low-landscape */\n${LOW_LANDSCAPE} {`);
      // nenhuma variante sem o cerco de largura
      expect(css).not.toMatch(/@media \(max-height: 500px\) and \(orientation: landscape\)/);
      const blocos = css.match(/@media[^{]*\(orientation: landscape\)[^{]*\{/g) ?? [];
      for (const b of blocos) expect(b).toBe(`${LOW_LANDSCAPE} {`);
    });
  }

  it("a nav encolhida pela paisagem baixa continua >= 44px de alvo", () => {
    const tokens = read("../styles/tokens.css");
    const bloco = tokens.slice(tokens.indexOf(LOW_LANDSCAPE));
    const h = Number(/--bottom-nav-h:\s*(\d+)px/.exec(bloco)?.[1]);
    expect(h).toBeGreaterThanOrEqual(44);
  });
});
