import { beforeEach, describe, expect, it, vi } from "vitest";

const plataforma = vi.hoisted(() => ({ nativo: false, nome: "web" as "web" | "ios" | "android" }));
vi.mock("./platform", () => ({
  isNativeApp: () => plataforma.nativo,
  getPlatform: () => plataforma.nome,
}));

const { applyNativeIosViewport } = await import("./nativeViewport");

const ORIGINAL = "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content";

function doc(content = ORIGINAL): Document {
  const d = document.implementation.createHTMLDocument("t");
  const meta = d.createElement("meta");
  meta.name = "viewport";
  meta.content = content;
  d.head.appendChild(meta);
  return d;
}
const conteudo = (d: Document) => d.querySelector<HTMLMetaElement>('meta[name="viewport"]')!.content;

beforeEach(() => {
  plataforma.nativo = false;
  plataforma.nome = "web";
});

describe("applyNativeIosViewport", () => {
  it("no app iOS acrescenta maximum-scale=1 e preserva o resto (viewport-fit=cover incluso)", () => {
    plataforma.nativo = true;
    plataforma.nome = "ios";
    const d = doc();
    expect(applyNativeIosViewport(d)).toBe(true);
    expect(conteudo(d)).toBe(`${ORIGINAL}, maximum-scale=1`);
  });

  it("é idempotente (não duplica a diretiva)", () => {
    plataforma.nativo = true;
    plataforma.nome = "ios";
    const d = doc(`${ORIGINAL}, maximum-scale=5`);
    applyNativeIosViewport(d);
    applyNativeIosViewport(d);
    expect(conteudo(d).match(/maximum-scale/g)).toHaveLength(1);
    expect(conteudo(d)).toContain("maximum-scale=1");
  });

  it("no app Android não mexe (lá maximum-scale bloquearia o pinça de acessibilidade)", () => {
    plataforma.nativo = true;
    plataforma.nome = "android";
    const d = doc();
    expect(applyNativeIosViewport(d)).toBe(false);
    expect(conteudo(d)).toBe(ORIGINAL);
  });

  it("na web (inclusive Safari do iPhone) não mexe", () => {
    const d = doc();
    expect(applyNativeIosViewport(d)).toBe(false);
    expect(conteudo(d)).toBe(ORIGINAL);
  });
});
