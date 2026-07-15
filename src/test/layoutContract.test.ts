import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// Contrato de layout: a altura do bottom nav e a reserva de espaço do conteúdo
// DEVEM referenciar o mesmo token (--bottom-nav-h). Se alguém trocar a altura
// da nav sem ajustar a reserva, o conteúdo volta a ficar escondido atrás dela.
describe("layout contract — bottom nav reserve", () => {
  const tokens = read("../styles/tokens.css");
  const components = read("../styles/components.css");

  it("token --bottom-nav-h está definido", () => {
    expect(tokens).toMatch(/--bottom-nav-h:\s*\d+px/);
  });

  it(".mobileBottomNav usa var(--bottom-nav-h) na altura", () => {
    expect(components).toMatch(/height:\s*calc\(var\(--bottom-nav-h\)/);
  });

  it("a reserva do .main referencia o mesmo token (folga real)", () => {
    // padding-bottom: calc(var(--bottom-nav-h) + ... )
    expect(components).toMatch(/padding-bottom:\s*calc\(var\(--bottom-nav-h\)\s*\+/);
  });

  it("a topbar mobile é sticky e respeita a safe-area do topo", () => {
    expect(components).toMatch(/\.mobileTopBar\b[\s\S]*?position:\s*sticky/);
    expect(components).toMatch(/padding-top:\s*calc\([^)]*env\(safe-area-inset-top/);
  });
});
