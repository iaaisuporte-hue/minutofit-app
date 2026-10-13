import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";
import { MOBILE_SHELL_QUERY } from "./mobileShell";

// O CSS não consegue importar a constante: este teste é o que impede CSS e React de divergirem de novo
// (o G1 nasceu de breakpoints de navegação que andaram separados: 720 numa regra, 980 noutra).
// Lê o FONTE dos .css do disco (o build do Vite remove os comentários-marcadores; o Vitest trata `?raw` de CSS de forma própria).
function listCss(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? listCss(p) : e.name.endsWith(".css") ? [p] : [];
  });
}
const SRC = join(process.cwd(), "src");
const css: Record<string, string> = Object.fromEntries(listCss(SRC).map((f) => [relative(SRC, f).replace(/\\/g, "/"), readFileSync(f, "utf8")]));

const norm = (q: string) => q.replace(/\s+/g, " ").trim();

/** Percorre os blocos `@media` (nível raiz) e devolve { query, body, markedBefore }. */
function mediaBlocks(source: string) {
  const out: Array<{ query: string; body: string; marked: boolean }> = [];
  const re = /@media\s+([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    const before = source.slice(Math.max(0, m.index - 600), m.index);
    // o marcador é o ÚLTIMO comentário antes do @media (nada entre o fim do comentário e a query além de espaço)
    const trimmed = before.trimEnd();
    const comment = trimmed.endsWith("*/") ? trimmed.slice(trimmed.lastIndexOf("/*") + 2, -2) : "";
    out.push({ query: norm(m[1]), body: source.slice(re.lastIndex, i - 1), marked: /^\s*mobile-shell/.test(comment) });
  }
  return out;
}

const NAV_SELECTORS = /\.(mobileBottomNav|mobileTopBar|wmp|fw-cta-bar)\b|\.appShell--with(BottomNav|MobileHeader)/;

describe("shell mobile: CSS e constante dizem a mesma coisa", () => {
  const entries = Object.entries(css);

  it("toda media query marcada `mobile-shell` é exatamente MOBILE_SHELL_QUERY", () => {
    const marked = entries.flatMap(([file, src]) => mediaBlocks(src).filter((b) => b.marked).map((b) => ({ file, ...b })));
    expect(marked.length).toBeGreaterThanOrEqual(5); // top bar, bottom nav, mini-player, FAB, CTA do treino livre
    for (const b of marked) expect(b.query, `${b.file}`).toBe(norm(MOBILE_SHELL_QUERY));
  });

  it("nenhuma regra que depende da presença da nav/top bar/mini-player fica fora da condição do shell", () => {
    const offenders = entries.flatMap(([file, src]) =>
      mediaBlocks(src)
        .filter((b) => NAV_SELECTORS.test(b.body) && b.query !== norm(MOBILE_SHELL_QUERY))
        .map((b) => `${file}: @media ${b.query}`),
    );
    expect(offenders).toEqual([]);
  });

  it("os marcadores existem onde devem (apagar um marcador não pode passar em silêncio)", () => {
    const count = (suffix: string) => entries.filter(([f]) => f.endsWith(suffix)).flatMap(([, s]) => mediaBlocks(s).filter((b) => b.marked)).length;
    expect(count("styles/components.css")).toBeGreaterThanOrEqual(4);
    expect(count("freeWorkout/freeWorkout.css")).toBeGreaterThanOrEqual(1);
  });
});
