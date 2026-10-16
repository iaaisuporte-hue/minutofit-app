import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PREFIXOS_HTTPS } from "./deepLinks";

/**
 * O AASA é servido como arquivo estático sem extensão: nenhum compilador olha
 * para ele, então um JSON quebrado ou um caminho esquecido só apareceria em
 * produção, como "o Universal Link abre no Safari".
 */
const CAMINHO = resolve(__dirname, "../../public/.well-known/apple-app-site-association");

function ler(): { applinks: { details: Array<{ appID: string; paths: string[] }> } } {
  return JSON.parse(readFileSync(CAMINHO, "utf8"));
}

describe("apple-app-site-association", () => {
  it("é JSON válido com a estrutura applinks.details", () => {
    const aasa = ler();
    expect(Array.isArray(aasa.applinks.details)).toBe(true);
    expect(aasa.applinks.details).toHaveLength(1);
  });

  it("aponta para o bundle do app", () => {
    expect(ler().applinks.details[0].appID).toMatch(/\.com\.s2core\.app$/);
  });

  it("cobre exatamente os prefixos que o roteador de deep link aceita", () => {
    const paths = ler().applinks.details[0].paths;
    expect(paths.slice().sort()).toEqual(PREFIXOS_HTTPS.map((p) => `${p}*`).sort());
  });
});
