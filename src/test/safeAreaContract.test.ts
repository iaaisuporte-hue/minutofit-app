import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/**
 * Contrato de áreas seguras das telas FORA de shell (login, cadastro, convite,
 * senha, páginas legais, completar perfil). Nelas não há topbar que desconte a
 * status bar / Dynamic Island do iPhone — e é a primeira tela que a App Review
 * vê. O jsdom não calcula `env()`, então o contrato é sobre o CSS declarado.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..");
const ler = (rel: string) => readFileSync(join(src, rel), "utf8");
const components = ler("styles/components.css");

/** Corpo da primeira regra `.auth-page {` de nível superior. */
function regraBase(css: string, seletor: string): string {
  const i = css.search(new RegExp(`^\\${seletor} \\{`, "m"));
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("}", i));
}

describe("contrato de safe area", () => {
  it("viewport-fit=cover está no index.html (sem ele env() é sempre 0)", () => {
    expect(readFileSync(join(src, "..", "index.html"), "utf8")).toMatch(/viewport-fit=cover/);
  });

  it(".auth-page desconta os quatro lados", () => {
    const base = regraBase(components, ".auth-page");
    for (const lado of ["top", "right", "bottom", "left"]) {
      expect(base).toContain(`env(safe-area-inset-${lado}`);
    }
  });

  it("nenhum breakpoint volta a usar o shorthand `padding` em .auth-page (apagaria os insets)", () => {
    const fora = [...components.matchAll(/\.auth-page\s*\{([^}]*)\}/g)]
      .map((m) => m[1])
      .filter((corpo) => /(^|;|\s)padding\s*:/.test(corpo) && !/env\(safe-area-inset-top/.test(corpo));
    expect(fora).toEqual([]);
  });

  it.each(["pages/PrivacyPolicyPage.tsx", "pages/TermsOfUsePage.tsx", "pages/DeleteAccountInfoPage.tsx", "pages/ProfileCompletionPage.tsx"])(
    "%s (padding inline) desconta o topo",
    (arquivo) => {
      expect(ler(arquivo)).toMatch(/env\(safe-area-inset-top/);
    },
  );
});
