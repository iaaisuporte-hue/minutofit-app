import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adjustSource,
  blurSource,
  buildAdjustLut,
  createPhotoSession,
  disposeCanvas,
  fitWithin,
  loadPhotoSource,
  MAX_SOURCE_EDGE,
} from "./sharePhotoSource";
import { fakeCtxOf, fakePhotoCanvas, installFakeCanvas, stubCanvasFilterSupport } from "../../../test/fakeCanvas2d";

// Pipeline da foto do editor de compartilhamento: memória (uma cópia por
// papel, nada vazando) e paridade do ajuste de cor entre filtro e fallback.

// — <img> e object URL falsos: o jsdom não decodifica imagem nem implementa
//   `URL.createObjectURL`.
const blobDims = new WeakMap<Blob, { w: number; h: number; broken?: boolean }>();
const urlBlob = new Map<string, Blob>();
let urlSeq = 0;

function photo(w: number, h: number, broken = false): Blob {
  const b = new Blob(["x"], { type: "image/jpeg" });
  blobDims.set(b, { w, h, broken });
  return b;
}

type DecodeMode = "resolve" | "manual" | "reject-loaded" | "missing";

class FakeImage {
  static instances: FakeImage[] = [];
  static mode: DecodeMode = "resolve";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = "auto";
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  complete = false;
  srcRemoved = false;
  private url = "";
  private settle: (() => void) | null = null;
  decode?: () => Promise<void>;

  constructor() {
    FakeImage.instances.push(this);
    if (FakeImage.mode !== "missing") this.decode = () => this.runDecode();
    if (FakeImage.mode === "missing") queueMicrotask(() => queueMicrotask(() => this.finish()));
  }
  set src(v: string) { this.url = v; }
  get src() { return this.url; }
  removeAttribute(name: string) { if (name === "src") { this.url = ""; this.srcRemoved = true; } }

  private dims() {
    const blob = urlBlob.get(this.url);
    return blob ? blobDims.get(blob) : undefined;
  }
  /** Carrega os "pixels" (ou falha) e avisa quem estiver ouvindo eventos. */
  finish() {
    const d = this.dims();
    this.complete = true;
    if (!d || d.broken) { this.onerror?.(); return false; }
    this.naturalWidth = this.width = d.w;
    this.naturalHeight = this.height = d.h;
    this.onload?.();
    return true;
  }
  private runDecode(): Promise<void> {
    if (FakeImage.mode === "reject-loaded") {
      this.finish();
      return Promise.reject(new Error("EncodingError"));
    }
    return new Promise<void>((resolve, reject) => {
      const go = () => (this.finish() ? resolve() : reject(new Error("EncodingError")));
      if (FakeImage.mode === "manual") this.settle = go;
      else go();
    });
  }
  /** Modo "manual": o teste decide quando cada decode termina. */
  resolveDecode() { this.settle?.(); }
}

let fake: ReturnType<typeof installFakeCanvas>;
const revoke = vi.fn();

beforeEach(() => {
  fake = installFakeCanvas();
  stubCanvasFilterSupport(true);
  FakeImage.instances = [];
  FakeImage.mode = "resolve";
  vi.stubGlobal("Image", FakeImage);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (b: Blob) => { const u = `blob:fake/${++urlSeq}`; urlBlob.set(u, b); return u; },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  revoke.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

describe("fitWithin", () => {
  it("reduz mantendo a proporção e nunca amplia", () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(1000, 800, 2048)).toEqual({ width: 1000, height: 800 });
    expect(fitWithin(2048, 10, 2048)).toEqual({ width: 2048, height: 10 });
  });
});

describe("loadPhotoSource", () => {
  it("foto maior que o teto vira canvas de 2048 no lado maior, mesma proporção", async () => {
    const c = await loadPhotoSource(photo(4032, 3024));
    expect(c.width).toBe(MAX_SOURCE_EDGE);
    expect(c.height).toBe(1536);
    const draw = fakeCtxOf(c)!.ops("drawImage")[0];
    expect(draw.args.slice(1)).toEqual([0, 0, 2048, 1536]);
  });

  it("foto pequena não é ampliada", async () => {
    const c = await loadPhotoSource(photo(800, 600));
    expect([c.width, c.height]).toEqual([800, 600]);
  });

  it("revoga o object URL e solta o <img> depois de normalizar", async () => {
    await loadPhotoSource(photo(1200, 900));
    const img = FakeImage.instances[0];
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke.mock.calls[0][0]).toMatch(/^blob:fake\//);
    expect(img.srcRemoved).toBe(true);
    expect(img.onload).toBeNull();
  });

  it("decode() rejeitado com a imagem já carregada não é fatal (WebKit)", async () => {
    FakeImage.mode = "reject-loaded";
    const c = await loadPhotoSource(photo(1000, 1000));
    expect(c.width).toBe(1000);
  });

  it("sem decode() cai no onload", async () => {
    FakeImage.mode = "missing";
    const c = await loadPhotoSource(photo(640, 480));
    expect([c.width, c.height]).toEqual([640, 480]);
  });

  it("arquivo que não decodifica lança e ainda revoga o URL", async () => {
    await expect(loadPhotoSource(photo(10, 10, true))).rejects.toThrow();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(fake.alive()).toHaveLength(0);
  });
});

describe("buildAdjustLut — matemática de brightness() contrast()", () => {
  it("brilho multiplica; contraste gira em torno do meio-tom", () => {
    expect(buildAdjustLut({ brightness: 1, contrast: 1 })[137]).toBe(137);
    expect(buildAdjustLut({ brightness: 1.2, contrast: 1 })[100]).toBe(120);
    // (200 − 127,5) × 1,3 + 127,5 = 221,75
    expect(buildAdjustLut({ brightness: 1, contrast: 1.3 })[200]).toBe(222);
    expect(buildAdjustLut({ brightness: 1, contrast: 0.7 })[0]).toBe(38); // 127,5 − 89,25
  });

  it("limita após o brilho, antes do contraste (como a cadeia de filtros)", () => {
    // 220 × 1,4 = 308 → 255; (255 − 127,5) × 0,7 + 127,5 = 216,75.
    // Sem o limite intermediário daria 253,85 — o fallback divergiria do filtro.
    expect(buildAdjustLut({ brightness: 1.4, contrast: 0.7 })[220]).toBe(217);
    expect(buildAdjustLut({ brightness: 1.4, contrast: 1.3 })[255]).toBe(255);
    expect(buildAdjustLut({ brightness: 0.6, contrast: 1.3 })[10]).toBe(0);
  });
});

describe("adjustSource", () => {
  it("neutro devolve a própria fonte, sem cópia", () => {
    const src = fakePhotoCanvas(400, 300);
    const before = fake.created.length;
    expect(adjustSource(src, { brightness: 1, contrast: 1 })).toBe(src);
    expect(fake.created.length).toBe(before);
  });

  it("com filtro nativo: uma cópia, filtro CSS aplicado no drawImage", () => {
    const src = fakePhotoCanvas(400, 300);
    const out = adjustSource(src, { brightness: 1.2, contrast: 0.9 });
    expect(out).not.toBe(src);
    expect([out.width, out.height]).toEqual([400, 300]);
    const ctx = fakeCtxOf(out)!;
    expect(ctx.ops("drawImage")[0].filter).toBe("brightness(1.2) contrast(0.9)");
    expect(ctx.filter).toBe("none");
    expect(ctx.ops("getImageData")).toHaveLength(0);
  });

  it("sem filtro: tabela via getImageData com willReadFrequently, alfa intocado", () => {
    stubCanvasFilterSupport(false);
    const src = fakePhotoCanvas(2, 1);
    // Pré-cria o contexto da saída para injetar os pixels lidos.
    const realCreate = document.createElement.bind(document);
    let out: HTMLCanvasElement | null = null;
    vi.mocked(document.createElement).mockImplementationOnce(((tag: string) => {
      out = realCreate(tag) as HTMLCanvasElement;
      fake.created.push(out);
      return out;
    }) as typeof document.createElement);
    const a = { brightness: 1.4, contrast: 0.7 };
    const pixels = new Uint8ClampedArray([220, 100, 0, 255, 10, 128, 255, 200]);
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement, type: string, opts?: unknown,
    ) {
      const ctx = origGetContext.call(this, type as "2d", opts as CanvasRenderingContext2DSettings);
      if (this === out) (ctx as unknown as { pixels: Uint8ClampedArray }).pixels = pixels;
      return ctx;
    } as HTMLCanvasElement["getContext"]);

    const result = adjustSource(src, a);
    expect(result).toBe(out);
    const ctx = fakeCtxOf(result)!;
    expect(ctx.options).toEqual({ willReadFrequently: true });
    const lut = buildAdjustLut(a);
    expect([...pixels]).toEqual([lut[220], lut[100], lut[0], 255, lut[10], lut[128], lut[255], 200]);
    expect(ctx.ops("putImageData")).toHaveLength(1);
  });
});

describe("blurSource", () => {
  it("vidro em 1/8 com blur escalado ao tamanho pequeno, sobre base nítida", () => {
    const glass = blurSource(fakePhotoCanvas(2048, 1536));
    expect([glass.width, glass.height]).toEqual([256, 192]);
    const draws = fakeCtxOf(glass)!.ops("drawImage");
    expect(draws).toHaveLength(2);
    expect(draws[0].filter).toBe("none");
    expect(draws[1].filter).toBe("blur(2.75px)");
  });

  it("sem filtro: reduz e amplia com suavização, e libera o intermediário", () => {
    stubCanvasFilterSupport(false);
    const before = fake.created.length;
    const glass = blurSource(fakePhotoCanvas(2048, 1536));
    const made = fake.created.slice(before + 1); // [vidro, intermediário]
    expect(made).toHaveLength(2);
    expect(made[1].width).toBe(0); // intermediário zerado
    expect(fakeCtxOf(glass)!.ops("drawImage")[1].args[0]).toBe(made[1]);
  });
});

describe("disposeCanvas", () => {
  it("zera o canvas e tolera nulo", () => {
    const c = fakePhotoCanvas(100, 100);
    disposeCanvas(c);
    expect([c.width, c.height]).toEqual([0, 0]);
    expect(() => disposeCanvas(null)).not.toThrow();
  });
});

describe("createPhotoSession", () => {
  it("ajuste neutro: ajustada é a própria fonte (fonte + vidro vivos)", async () => {
    const s = createPhotoSession();
    const l = await s.load(photo(3000, 2000));
    expect(l).not.toBeNull();
    expect(l!.adjusted).toBe(l!.source);
    expect(fake.alive()).toHaveLength(2);
    expect(s.layers).toBe(l);
  });

  it("setAdjust: mesmo valor é cache; valor novo libera a ajustada e o vidro anteriores", async () => {
    const s = createPhotoSession();
    await s.load(photo(1000, 800));
    const a = s.setAdjust({ brightness: 1.2, contrast: 1 })!;
    expect(a.adjusted).not.toBe(a.source);
    expect(s.setAdjust({ brightness: 1.2, contrast: 1 })).toBe(a);

    const b = s.setAdjust({ brightness: 0.8, contrast: 1.1 })!;
    expect([a.adjusted.width, a.glass.width]).toEqual([0, 0]);
    expect(b.source).toBe(a.source);
    expect(b.source.width).toBe(1000);

    const c = s.setAdjust({ brightness: 1, contrast: 1 })!;
    expect(c.adjusted).toBe(c.source);
    expect(b.adjusted.width).toBe(0);
    expect(fake.alive()).toHaveLength(2);
  });

  it("nunca passa de 4 buffers vivos em trocas repetidas de ajuste e de foto", async () => {
    const s = createPhotoSession();
    let peak = 0;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement, type: string, opts?: unknown,
    ) {
      peak = Math.max(peak, fake.alive().length);
      return origGetContext.call(this, type as "2d", opts as CanvasRenderingContext2DSettings);
    } as HTMLCanvasElement["getContext"]);
    await s.load(photo(2000, 1500));
    for (let i = 0; i < 20; i++) s.setAdjust({ brightness: 0.7 + i * 0.03, contrast: 1.1 });
    await s.load(photo(1500, 2000), { brightness: 1.1, contrast: 1 });
    await s.load(photo(1200, 1200));
    expect(peak).toBeLessThanOrEqual(4);
    expect(fake.alive()).toHaveLength(2);
  });

  it("geração obsoleta é descartada e o canvas dela liberado", async () => {
    FakeImage.mode = "manual";
    const s = createPhotoSession();
    const pA = s.load(photo(1000, 1000));
    const pB = s.load(photo(800, 600));
    await Promise.resolve();
    const [imgA, imgB] = FakeImage.instances;

    imgB.resolveDecode();
    const lb = await pB;
    expect(lb!.source.width).toBe(800);

    imgA.resolveDecode();
    expect(await pA).toBeNull();
    expect(s.layers).toBe(lb);
    // O canvas de A foi criado e já zerado; só B (fonte + vidro) segue vivo.
    expect(fake.alive().map((c) => c.width).sort()).toEqual([100, 800]);
  });

  it("falha de decodificação mantém a foto atual", async () => {
    const s = createPhotoSession();
    const l = await s.load(photo(1000, 1000));
    await expect(s.load(photo(5, 5, true))).rejects.toThrow();
    expect(s.layers).toBe(l);
    expect(l!.source.width).toBe(1000);
  });

  it("dispose zera tudo, invalida o que estava em voo e a sessão segue reutilizável", async () => {
    const s = createPhotoSession();
    await s.load(photo(1000, 800));
    const l = s.setAdjust({ brightness: 1.3, contrast: 1 })!;
    FakeImage.mode = "manual";
    const inflight = s.load(photo(600, 600));
    s.dispose();
    expect(s.layers).toBeNull();
    for (const c of [l.source, l.adjusted, l.glass]) expect([c.width, c.height]).toEqual([0, 0]);

    await Promise.resolve();
    FakeImage.instances.at(-1)!.resolveDecode();
    expect(await inflight).toBeNull();
    expect(fake.alive()).toHaveLength(0);

    FakeImage.mode = "resolve";
    expect(await s.load(photo(500, 500))).not.toBeNull();
  });
});
