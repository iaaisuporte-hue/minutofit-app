import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  composeWorkoutImage,
  computeCardLayout,
  OVERLAY_PRESETS,
  renderBackground,
  renderForeground,
  renderWorkoutCard,
  type CardPhoto,
} from "./shareWorkoutImage";
import { clampTransform, coverRect, defaultEdit, type ShareEdit } from "./sharePhotoTransform";
import {
  FakeContext2D,
  fakeCtxOf,
  fakePhotoCanvas,
  installFakeCanvas,
  stubCanvasFilterSupport,
} from "../../../test/fakeCanvas2d";

// Renderização da arte com um contexto 2D espião (jsdom não tem canvas).
// Confere o que importa sem pixels: a foto sai no retângulo do enquadramento,
// os presets de escurecimento são os combinados, e o conteúdo do treino
// (foco/exercícios) continua intacto.

const EXERCISES = [
  { name: "Puxada frente", sets: 4, reps: "12" },
  { name: "Remada baixa", sets: 3, reps: "10-12" },
];
const CONTENT = { focus: "Costas + Bíceps", exercises: EXERCISES };

let fake: ReturnType<typeof installFakeCanvas>;

beforeEach(() => {
  fake = installFakeCanvas();
  stubCanvasFilterSupport(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function newCtx(w = 1080, h = 1920) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return new FakeContext2D(c);
}
const asCtx = (f: FakeContext2D) => f as unknown as CanvasRenderingContext2D;

function photoLayers(w: number, h: number): CardPhoto {
  return { adjusted: fakePhotoCanvas(w, h), glass: fakePhotoCanvas(Math.round(w / 8), Math.round(h / 8)) };
}

function edit(over: Partial<ShareEdit> = {}): ShareEdit {
  return { ...defaultEdit(), ...over };
}

describe("renderBackground", () => {
  it("desenha a foto no retângulo do enquadramento e o vidro no mesmo retângulo, dentro do recorte", () => {
    const layout = computeCardLayout("story", CONTENT);
    const photo = photoLayers(2048, 1536);
    const ctx = newCtx();
    const transform = { zoom: 2, offsetX: 0.1, offsetY: -0.05 };
    renderBackground(asCtx(ctx), 1, photo, edit({ transform }), layout);

    const frame = { imgW: 2048, imgH: 1536, canvasW: 1080, canvasH: 1920 };
    const r = coverRect(frame, clampTransform(frame, transform));
    const draws = ctx.ops("drawImage");
    expect(draws[0].args).toEqual([photo.adjusted, r.dx, r.dy, r.dw, r.dh]);
    expect(draws[1].args).toEqual([photo.glass, r.dx, r.dy, r.dw, r.dh]);
    // O vidro só existe dentro do painel: o clip vem antes dele.
    const clipIdx = ctx.calls.findIndex((c) => c.op === "clip");
    expect(clipIdx).toBeGreaterThan(-1);
    expect(ctx.calls.indexOf(draws[1])).toBeGreaterThan(clipIdx);
  });

  it("sem edição usa o cover centralizado legado", () => {
    const layout = computeCardLayout("square", CONTENT);
    const photo = photoLayers(1536, 2048);
    const ctx = newCtx(1080, 1080);
    renderBackground(asCtx(ctx), 1, photo, edit(), layout);
    // Retrato num quadrado: largura = card, altura sobra e é centralizada.
    const dh = 1080 / (1536 / 2048);
    expect(ctx.ops("drawImage")[0].args).toEqual([photo.adjusted, 0, (1080 - dh) / 2, 1080, dh]);
  });

  it("limita um enquadramento inválido em vez de abrir borda vazia", () => {
    const layout = computeCardLayout("story", CONTENT);
    const ctx = newCtx();
    renderBackground(asCtx(ctx), 1, photoLayers(2048, 1536), edit({ transform: { zoom: 0.3, offsetX: 9, offsetY: -9 } }), layout);
    const [, dx, dy, dw, dh] = ctx.ops("drawImage")[0].args as number[];
    expect(dx).toBeLessThanOrEqual(0);
    expect(dy).toBeLessThanOrEqual(0);
    expect(dx + dw).toBeGreaterThanOrEqual(1080);
    expect(dy + dh).toBeGreaterThanOrEqual(1920);
  });

  it.each(["soft", "medium", "strong"] as const)("preset %s: véu global, scrim e véu do painel combinados", (preset) => {
    const p = OVERLAY_PRESETS[preset];
    const layout = computeCardLayout("story", CONTENT);
    const ctx = newCtx();
    renderBackground(asCtx(ctx), 1, photoLayers(2048, 1536), edit({ overlay: preset }), layout);

    const fullVeil = ctx.ops("fillRect").filter(
      (c) => typeof c.fillStyle === "string" && c.fillStyle.startsWith("rgba(7,12,18,") && (c.args as number[])[2] === 1080,
    );
    if (p.globalVeil > 0) expect(fullVeil.map((c) => c.fillStyle)).toContain(`rgba(7,12,18,${p.globalVeil})`);
    else expect(fullVeil).toHaveLength(0);

    const scrim = ctx.gradients[0];
    expect(scrim.stops.map((s) => s[1])).toEqual([
      "rgba(7,12,18,0)",
      `rgba(7,12,18,${p.scrimText})`,
      `rgba(7,12,18,${p.scrimBase})`,
    ]);
    expect(ctx.ops("fillRect").some((c) => c.fillStyle === `rgba(8,13,20,${p.panelVeil})`)).toBe(true);
  });

  it("presets: padrão sem véu global, forte ≈ arte anterior", () => {
    expect(OVERLAY_PRESETS.medium.globalVeil).toBe(0);
    expect(OVERLAY_PRESETS.soft.globalVeil).toBe(0);
    expect(OVERLAY_PRESETS.strong).toMatchObject({ globalVeil: 0.2, scrimText: 0.7, scrimBase: 0.94, panelVeil: 0.8 });
    expect(OVERLAY_PRESETS.soft.scrimText).toBeLessThan(OVERLAY_PRESETS.medium.scrimText);
    expect(OVERLAY_PRESETS.medium.scrimText).toBeLessThan(OVERLAY_PRESETS.strong.scrimText);
  });

  it("sem foto: gradiente da marca com os valores de sempre, independente do preset", () => {
    const layout = computeCardLayout("story", CONTENT);
    const ctx = newCtx();
    renderBackground(asCtx(ctx), 1, null, edit({ overlay: "strong" }), layout);
    expect(ctx.ops("drawImage")).toHaveLength(0);
    expect(ctx.gradients[0].stops).toEqual([[0, "#0b1220"], [1, "#0f2a24"]]);
    expect(ctx.gradients[1].stops.map((s) => s[1])).toEqual(["rgba(7,12,18,0)", "rgba(7,12,18,0.34)", "rgba(7,12,18,0.88)"]);
    expect(ctx.ops("fillRect").some((c) => c.fillStyle === "rgba(8,13,20,0.46)")).toBe(true);
    expect(ctx.ops("fillRect").some((c) => c.fillStyle === "rgba(7,12,18,0.2)")).toBe(false);
  });

  it("foto já liberada (canvas zerado) cai no gradiente em vez de lançar", () => {
    const layout = computeCardLayout("story", CONTENT);
    const photo = photoLayers(1000, 1000);
    photo.adjusted.width = 0;
    const ctx = newCtx();
    expect(() => renderBackground(asCtx(ctx), 1, photo, edit(), layout)).not.toThrow();
    expect(ctx.ops("drawImage")).toHaveLength(0);
  });

  it("escala da prévia vira um ctx.scale envolvendo o desenho todo", () => {
    const layout = computeCardLayout("story", CONTENT);
    const ctx = newCtx(360, 640);
    renderBackground(asCtx(ctx), 1 / 3, photoLayers(2048, 1536), edit(), layout);
    expect(ctx.calls[0].op).toBe("save");
    expect(ctx.calls[1]).toMatchObject({ op: "scale", args: [1 / 3, 1 / 3] });
    expect(ctx.calls.at(-1)!.op).toBe("restore");
  });
});

describe("renderForeground", () => {
  const texts = (ctx: FakeContext2D) => ctx.ops("fillText").map((c) => c.args[0] as string);

  it("foco e exercícios intactos, sem pintar fundo nenhum", () => {
    const layout = computeCardLayout("story", { ...CONTENT, eyebrow: "TREINO CONCLUÍDO" });
    const ctx = newCtx();
    renderForeground(asCtx(ctx), 1, layout, null, "medium");
    const t = texts(ctx);
    expect(t).toEqual(expect.arrayContaining(["Costas", " +", "Bíceps", "TREINO CONCLUÍDO", "EXERCÍCIOS EXECUTADOS", "Puxada frente", "4 × 12", "Remada baixa", "3 × 10-12", "S2Core"]));
    // Camada transparente: nenhum retângulo cobre o card inteiro.
    expect(ctx.ops("fillRect").some((c) => (c.args as number[])[2] === 1080 && (c.args as number[])[3] > 14)).toBe(false);
    expect(ctx.ops("drawImage")).toHaveLength(0); // sem logo → fallback de texto
  });

  it("sombra do texto só no Suave, multiplicada pela escala, e nunca no painel", () => {
    const layout = computeCardLayout("story", CONTENT);
    const ctx = newCtx(540, 960);
    renderForeground(asCtx(ctx), 0.5, layout, null, "soft");
    const hero = ctx.ops("fillText").find((c) => c.args[0] === "Costas")!;
    expect(hero.shadowBlur).toBe(7);
    expect(hero.shadowOffsetY).toBe(1);
    const row = ctx.ops("fillText").find((c) => c.args[0] === "Puxada frente")!;
    expect(row.shadowBlur).toBe(0);

    for (const preset of ["medium", "strong", null] as const) {
      const c2 = newCtx();
      renderForeground(asCtx(c2), 1, layout, null, preset);
      expect(c2.ops("fillText").every((c) => c.shadowBlur === 0)).toBe(true);
    }
  });

  it("desenha o logo no retângulo do layout quando há logo", () => {
    const layout = computeCardLayout("square", CONTENT);
    const ctx = newCtx(1080, 1080);
    const logo = {} as HTMLImageElement;
    renderForeground(asCtx(ctx), 1, layout, logo, null);
    expect(ctx.ops("drawImage")[0].args).toEqual([logo, layout.logo.x, layout.logo.y, layout.logo.w, layout.logo.h]);
    expect(texts(ctx)).not.toContain("S2Core");
  });
});

describe("renderWorkoutCard", () => {
  it("fundo antes da camada fixa; sem foto a camada fixa não recebe preset", () => {
    const layout = computeCardLayout("story", CONTENT);
    const ctx = newCtx();
    renderWorkoutCard(asCtx(ctx), 1, layout, null, edit({ overlay: "soft" }), null);
    const firstText = ctx.calls.findIndex((c) => c.op === "fillText");
    const lastGradient = ctx.calls.map((c) => c.op).lastIndexOf("createLinearGradient");
    expect(lastGradient).toBeLessThan(firstText);
    expect(ctx.ops("fillText").every((c) => c.shadowBlur === 0)).toBe(true);
  });
});

describe("composeWorkoutImage", () => {
  class FakeLogo {
    src = "";
    decode() { return Promise.resolve(); }
  }

  beforeEach(() => {
    vi.stubGlobal("Image", FakeLogo);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback) {
      cb(new Blob(["jpeg"], { type: "image/jpeg" }));
    });
  });

  it("mantém o formato de retorno e um encode só (dataUrl vem do blob)", async () => {
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL");
    const r = await composeWorkoutImage({ focus: "Pernas", format: "square", exercises: EXERCISES });
    expect(r.focus).toBe("Pernas");
    expect(r.format).toBe("square");
    expect(r.blob.type).toBe("image/jpeg");
    expect(r.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(toDataURL).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
  });

  it("photoSource cru: aplica enquadramento/ajuste, não libera a fonte do chamador e libera o resto", async () => {
    const source = fakePhotoCanvas(2048, 1536);
    const exportCanvases: HTMLCanvasElement[] = [];
    const before = fake.created.length;
    await composeWorkoutImage({
      focus: "Costas",
      photoSource: source,
      photoAdjust: { zoom: 1.5, offsetX: 0.05, brightness: 1.2 },
      overlay: "soft",
    });
    exportCanvases.push(...fake.created.slice(before));
    expect(source.width).toBe(2048);
    // Export + ajustada + vidro: todos zerados no fim.
    expect(exportCanvases.length).toBeGreaterThanOrEqual(3);
    expect(exportCanvases.every((c) => c.width === 0)).toBe(true);

    const out = exportCanvases[0];
    const draw = fakeCtxOf(out)!.ops("drawImage")[0];
    const frame = { imgW: 2048, imgH: 1536, canvasW: 1080, canvasH: 1920 };
    const r = coverRect(frame, clampTransform(frame, { zoom: 1.5, offsetX: 0.05, offsetY: 0 }));
    expect(draw.args.slice(1)).toEqual([r.dx, r.dy, r.dw, r.dh]);
    expect(draw.args[0]).not.toBe(source); // brilho 1.2 → cópia ajustada
  });

  it("CardPhoto do editor é usado como está, sem recalcular nem liberar", async () => {
    const layers = photoLayers(1600, 1600);
    const before = fake.created.length;
    await composeWorkoutImage({ focus: "Peito", photoSource: layers, photoAdjust: { brightness: 1.3 } });
    const made = fake.created.slice(before);
    expect(made).toHaveLength(1); // só o canvas de exportação
    expect(fakeCtxOf(made[0])!.ops("drawImage")[0].args[0]).toBe(layers.adjusted);
    expect(layers.adjusted.width).toBe(1600);
    expect(layers.glass!.width).toBe(200);
  });
});
