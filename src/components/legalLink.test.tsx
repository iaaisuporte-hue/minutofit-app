import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const plataforma = vi.hoisted(() => ({ nativo: false }));
const browser = vi.hoisted(() => ({ open: vi.fn(async () => undefined) }));

vi.mock("../lib/platform", () => ({
  isNativeApp: () => plataforma.nativo,
  getPlatform: () => (plataforma.nativo ? "ios" : "web"),
}));
vi.mock("@capacitor/browser", () => ({ Browser: browser }));

const { LegalLink } = await import("./LegalLink");

beforeEach(() => {
  plataforma.nativo = false;
  browser.open.mockClear();
});

describe("LegalLink", () => {
  it("na web abre a rota interna em nova aba (formulário preservado)", () => {
    render(<MemoryRouter><LegalLink doc="termos">Termos de Uso</LegalLink></MemoryRouter>);
    const link = screen.getByRole("link", { name: "Termos de Uso" });
    expect(link).toHaveAttribute("href", "/termos");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("no app abre a página pública no navegador do sistema, sem target=_blank", () => {
    plataforma.nativo = true;
    render(<MemoryRouter><LegalLink doc="privacidade">Política de Privacidade</LegalLink></MemoryRouter>);
    const link = screen.getByRole("link", { name: "Política de Privacidade" });
    expect(link).toHaveAttribute("href", "https://s2core.com.br/privacidade");
    expect(link).not.toHaveAttribute("target");
    fireEvent.click(link);
    expect(browser.open).toHaveBeenCalledWith({ url: "https://s2core.com.br/privacidade" });
  });
});

/**
 * Guarda de regressão: `<Link to="/rota-interna" target="_blank">` não abre nada
 * no iOS (vira capacitor://localhost/... no UIApplication.open). Link externo
 * (https) com target=_blank continua permitido — esse o sistema sabe abrir.
 */
describe("nenhuma rota interna aberta com target=_blank", () => {
  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return arquivos(p);
      return /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [p] : [];
    });
  }

  it("varre src/", () => {
    const raiz = join(__dirname, "..");
    const ofensores: string[] = [];
    for (const arquivo of arquivos(raiz)) {
      const texto = readFileSync(arquivo, "utf8");
      for (const m of texto.matchAll(/<Link\b[^>]*\btarget="_blank"[^>]*>/g)) {
        if (arquivo.endsWith("LegalLink.tsx")) continue; // o caminho web do próprio componente
        ofensores.push(`${arquivo.replace(raiz, "src")}: ${m[0]}`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});
