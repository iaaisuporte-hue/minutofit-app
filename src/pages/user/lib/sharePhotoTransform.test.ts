import { describe, expect, it } from "vitest";
import {
  applyPan,
  applyPinch,
  clampTransform,
  coverRect,
  DEFAULT_TRANSFORM,
  defaultEdit,
  isDefaultEdit,
  MAX_ZOOM,
  type PhotoFrame,
  type PhotoTransform,
} from "./sharePhotoTransform";

// Geometria do editor de foto do compartilhamento. Pura: a mesma conta vale
// para a prévia e para a exportação, então é aqui que a paridade se prova.

/** O `drawCover` que a arte usava antes do editor — referência de paridade. */
function legacyDrawCover(imgW: number, imgH: number, w: number, h: number) {
  const ir = imgW / imgH;
  const cr = w / h;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    dw = w;
    dh = w / ir;
    dx = 0;
    dy = (h - dh) / 2;
  }
  return { dx, dy, dw, dh };
}

const STORY = { canvasW: 1080, canvasH: 1920 };
const SQUARE = { canvasW: 1080, canvasH: 1080 };
const PHOTOS = [
  { imgW: 2048, imgH: 1536 }, // paisagem
  { imgW: 1536, imgH: 2048 }, // retrato
  { imgW: 1600, imgH: 1600 }, // quadrada
  { imgW: 900, imgH: 2000 },  // retrato mais estreito que o Story
  { imgW: 3, imgH: 1 },       // panorâmica extrema
];
const FRAMES: PhotoFrame[] = PHOTOS.flatMap((p) => [{ ...p, ...STORY }, { ...p, ...SQUARE }]);

/** A foto cobre o card inteiro, sem borda vazia em nenhum lado. */
function covers(f: PhotoFrame, t: PhotoTransform) {
  const r = coverRect(f, t);
  const eps = 1e-6;
  return r.dx <= eps && r.dy <= eps && r.dx + r.dw >= f.canvasW - eps && r.dy + r.dh >= f.canvasH - eps;
}

describe("coverRect", () => {
  it("sem edição é exatamente o cover legado (a arte sem ajuste não muda)", () => {
    for (const f of FRAMES) {
      expect(coverRect(f, DEFAULT_TRANSFORM)).toEqual(legacyDrawCover(f.imgW, f.imgH, f.canvasW, f.canvasH));
      expect(coverRect(f)).toEqual(legacyDrawCover(f.imgW, f.imgH, f.canvasW, f.canvasH));
    }
  });

  it("zoom cresce em torno do centro e o offset é fração do card", () => {
    const f = { imgW: 1600, imgH: 1600, ...SQUARE };
    const r = coverRect(f, { zoom: 2, offsetX: 0.1, offsetY: -0.05 });
    expect(r.dw).toBe(2160);
    expect(r.dh).toBe(2160);
    expect(r.dx).toBeCloseTo((1080 - 2160) / 2 + 108);
    expect(r.dy).toBeCloseTo((1080 - 2160) / 2 - 54);
  });
});

describe("clampTransform", () => {
  it("limita o zoom a [1, 3] e devolve padrão para valores não finitos", () => {
    const f = FRAMES[0];
    expect(clampTransform(f, { zoom: 0.2, offsetX: 0, offsetY: 0 }).zoom).toBe(1);
    expect(clampTransform(f, { zoom: 9, offsetX: 0, offsetY: 0 }).zoom).toBe(MAX_ZOOM);
    expect(clampTransform(f, { zoom: Number.NaN, offsetX: Number.NaN, offsetY: Infinity })).toEqual({
      zoom: 1, offsetX: 0, offsetY: 0,
    });
  });

  it("nunca deixa borda vazia — em todos os cantos, zooms e formatos", () => {
    const extremes = [-10, -1, -0.3, 0, 0.3, 1, 10];
    for (const f of FRAMES) {
      for (const zoom of [0.5, 1, 1.37, 2, 3, 5]) {
        for (const offsetX of extremes) {
          for (const offsetY of extremes) {
            const t = clampTransform(f, { zoom, offsetX, offsetY });
            expect(covers(f, t)).toBe(true);
          }
        }
      }
    }
  });

  it("com zoom 1 só desliza no eixo onde a foto sobra", () => {
    const f = { imgW: 2048, imgH: 1536, ...STORY }; // paisagem no Story sobra na largura
    const t = clampTransform(f, { zoom: 1, offsetX: 5, offsetY: 5 });
    expect(t.offsetY).toBe(0);
    expect(t.offsetX).toBeGreaterThan(0);
    // Encostado: a borda esquerda da foto está exatamente na borda do card.
    expect(coverRect(f, t).dx).toBeCloseTo(0);
  });

  it("é idempotente para valores já válidos", () => {
    const f = FRAMES[1];
    const t = { zoom: 1.5, offsetX: 0.05, offsetY: -0.04 };
    expect(clampTransform(f, t)).toEqual(t);
  });
});

describe("applyPan", () => {
  it("converte px do card em fração e respeita o limite", () => {
    const f = { imgW: 1600, imgH: 1600, ...SQUARE };
    const t = applyPan({ zoom: 2, offsetX: 0, offsetY: 0 }, f, 108, -54);
    expect(t.offsetX).toBeCloseTo(0.1);
    expect(t.offsetY).toBeCloseTo(-0.05);
    const far = applyPan(t, f, 100000, 100000);
    expect(covers(f, far)).toBe(true);
  });
});

describe("applyPinch", () => {
  /** Ponto da foto (0..1) que está sob `p` no card. */
  const photoPointAt = (f: PhotoFrame, t: PhotoTransform, p: { x: number; y: number }) => {
    const r = coverRect(f, t);
    return { u: (p.x - r.dx) / r.dw, v: (p.y - r.dy) / r.dh };
  };

  it("mantém sob os dedos o mesmo ponto da foto", () => {
    const f = { imgW: 1536, imgH: 2048, ...STORY };
    const start = { zoom: 1.2, offsetX: 0, offsetY: 0 };
    const focal = { x: 600, y: 900 };
    const before = photoPointAt(f, start, focal);
    const t = applyPinch(start, f, focal, 1.5);
    expect(t.zoom).toBeCloseTo(1.8);
    const after = photoPointAt(f, t, focal);
    expect(after.u).toBeCloseTo(before.u, 6);
    expect(after.v).toBeCloseTo(before.v, 6);
  });

  it("o arraste simultâneo leva o ponto ancorado junto com os dedos", () => {
    const f = { imgW: 1600, imgH: 1600, ...SQUARE };
    const start = { zoom: 2, offsetX: 0, offsetY: 0 };
    const focal = { x: 500, y: 520 };
    const before = photoPointAt(f, start, focal);
    const t = applyPinch(start, f, focal, 1.1, { dx: 30, dy: -20 });
    const after = photoPointAt(f, t, { x: focal.x + 30, y: focal.y - 20 });
    expect(after.u).toBeCloseTo(before.u, 6);
    expect(after.v).toBeCloseTo(before.v, 6);
  });

  it("no teto de zoom vira só arraste e nunca abre borda", () => {
    const f = { imgW: 2048, imgH: 1536, ...STORY };
    const t = applyPinch({ zoom: 3, offsetX: 0, offsetY: 0 }, f, { x: 100, y: 100 }, 4);
    expect(t.zoom).toBe(MAX_ZOOM);
    expect(t.offsetX).toBeCloseTo(0);
    expect(t.offsetY).toBeCloseTo(0);
    const out = applyPinch({ zoom: 1.2, offsetX: 0, offsetY: 0 }, f, { x: 0, y: 0 }, 0.1);
    expect(out.zoom).toBe(1);
    expect(covers(f, out)).toBe(true);
  });

  it("ignora fator inválido", () => {
    const f = FRAMES[0];
    const start = { zoom: 1.5, offsetX: 0, offsetY: 0 };
    expect(applyPinch(start, f, { x: 540, y: 960 }, Number.NaN)).toEqual(start);
    expect(applyPinch(start, f, { x: 540, y: 960 }, 0)).toEqual(start);
  });
});

describe("defaultEdit / isDefaultEdit", () => {
  it("padrão = zoom 1, offset 0, brilho/contraste 1, overlay médio — em objetos novos", () => {
    const a = defaultEdit();
    const b = defaultEdit();
    expect(a).toEqual({
      transform: { zoom: 1, offsetX: 0, offsetY: 0 },
      adjust: { brightness: 1, contrast: 1 },
      overlay: "medium",
    });
    expect(a.transform).not.toBe(b.transform);
    expect(isDefaultEdit(a)).toBe(true);
  });

  it("qualquer campo alterado deixa de ser padrão", () => {
    const mods: Array<(e: ReturnType<typeof defaultEdit>) => void> = [
      (e) => { e.transform.zoom = 1.1; },
      (e) => { e.transform.offsetX = 0.01; },
      (e) => { e.transform.offsetY = -0.01; },
      (e) => { e.adjust.brightness = 1.1; },
      (e) => { e.adjust.contrast = 0.9; },
      (e) => { e.overlay = "soft"; },
    ];
    for (const mod of mods) {
      const e = defaultEdit();
      mod(e);
      expect(isDefaultEdit(e)).toBe(false);
    }
  });
});
