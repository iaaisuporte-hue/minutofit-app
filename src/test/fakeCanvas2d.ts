// Contexto 2D espião para testes de canvas. O jsdom não implementa canvas (e o
// pacote `canvas` nativo não é dependência do projeto), então os testes da
// arte de compartilhamento gravam as chamadas e conferem a geometria/ordem.

import { vi } from "vitest";

export type CanvasCall = {
  op: string;
  args: unknown[];
  /** Estado relevante no momento da chamada. */
  fillStyle: unknown;
  filter: string;
  font: string;
  shadowBlur: number;
  shadowOffsetY: number;
};

export type FakeGradient = { args: number[]; stops: Array<[number, string]>; addColorStop(o: number, c: string): void };

type State = Pick<FakeContext2D, "fillStyle" | "filter" | "font" | "shadowBlur" | "shadowOffsetY" | "shadowColor" | "textAlign">;

export class FakeContext2D {
  calls: CanvasCall[] = [];
  gradients: FakeGradient[] = [];
  /** Opções do `getContext` que criou este contexto (ex.: `willReadFrequently`). */
  options: unknown;
  /** Pixels devolvidos por `getImageData` (padrão: tudo zero). */
  pixels: Uint8ClampedArray | null = null;
  fillStyle: unknown = "#000000";
  strokeStyle: unknown = "#000000";
  filter = "none";
  font = "10px sans-serif";
  textAlign = "start";
  shadowBlur = 0;
  shadowColor = "rgba(0,0,0,0)";
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  lineWidth = 1;
  letterSpacing = "0px";
  imageSmoothingEnabled = true;
  imageSmoothingQuality = "low";
  readonly canvas: HTMLCanvasElement;
  private stack: State[] = [];

  constructor(canvas: HTMLCanvasElement, options?: unknown) {
    this.canvas = canvas;
    this.options = options;
  }

  private rec(op: string, args: unknown[]) {
    this.calls.push({
      op, args,
      fillStyle: this.fillStyle, filter: this.filter, font: this.font,
      shadowBlur: this.shadowBlur, shadowOffsetY: this.shadowOffsetY,
    });
  }

  ops(name: string) {
    return this.calls.filter((c) => c.op === name);
  }

  save() {
    this.stack.push({
      fillStyle: this.fillStyle, filter: this.filter, font: this.font, shadowBlur: this.shadowBlur,
      shadowOffsetY: this.shadowOffsetY, shadowColor: this.shadowColor, textAlign: this.textAlign,
    });
    this.rec("save", []);
  }
  restore() {
    const s = this.stack.pop();
    if (s) Object.assign(this, s);
    this.rec("restore", []);
  }
  scale(...a: number[]) { this.rec("scale", a); }
  setTransform(...a: number[]) { this.rec("setTransform", a); }
  clearRect(...a: number[]) { this.rec("clearRect", a); }
  drawImage(...a: unknown[]) {
    const src = a[0] as { width?: number; height?: number } | undefined;
    // Igual ao navegador: canvas zerado como fonte lança InvalidStateError.
    if (src && "width" in src && (src.width === 0 || src.height === 0)) throw new Error("InvalidStateError");
    this.rec("drawImage", a);
  }
  fillRect(...a: number[]) { this.rec("fillRect", a); }
  fillText(...a: unknown[]) { this.rec("fillText", a); }
  measureText(text: string) {
    const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10);
    return { width: text.length * size * 0.5 };
  }
  createLinearGradient(...a: number[]): FakeGradient {
    const g: FakeGradient = { args: a, stops: [], addColorStop(o, c) { g.stops.push([o, c]); } };
    this.gradients.push(g);
    this.rec("createLinearGradient", a);
    return g;
  }
  getImageData(_x: number, _y: number, w: number, h: number) {
    this.rec("getImageData", [_x, _y, w, h]);
    return { data: this.pixels ?? new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }
  putImageData(...a: unknown[]) { this.rec("putImageData", a); }
  beginPath() { this.rec("beginPath", []); }
  closePath() { this.rec("closePath", []); }
  moveTo(...a: number[]) { this.rec("moveTo", a); }
  lineTo(...a: number[]) { this.rec("lineTo", a); }
  quadraticCurveTo(...a: number[]) { this.rec("quadraticCurveTo", a); }
  arc(...a: number[]) { this.rec("arc", a); }
  clip() { this.rec("clip", []); }
  stroke() { this.rec("stroke", []); }
  fill() { this.rec("fill", []); }
}

const contexts = new WeakMap<HTMLCanvasElement, FakeContext2D>();

/** Contexto falso já criado para o canvas (ou `undefined`). */
export function fakeCtxOf(c: HTMLCanvasElement): FakeContext2D | undefined {
  return contexts.get(c);
}

/**
 * Faz `getContext("2d")` devolver um `FakeContext2D` por canvas e registra
 * todos os canvases criados. Chamar em `beforeEach`; `vi.restoreAllMocks()` desfaz.
 */
export function installFakeCanvas() {
  const created: HTMLCanvasElement[] = [];
  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
    const el = originalCreate(tag, opts);
    if (tag.toLowerCase() === "canvas") created.push(el as HTMLCanvasElement);
    return el;
  }) as typeof document.createElement);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
    _type: string,
    options?: unknown,
  ) {
    let ctx = contexts.get(this);
    if (!ctx) {
      ctx = new FakeContext2D(this, options);
      contexts.set(this, ctx);
    }
    return ctx as unknown as CanvasRenderingContext2D;
  } as HTMLCanvasElement["getContext"]);
  return {
    created,
    /** Canvases com pixels ainda alocados (não zerados por `disposeCanvas`). */
    alive: () => created.filter((c) => c.width > 0 && c.height > 0),
  };
}

/** Liga/desliga a detecção de `ctx.filter` (por protótipo) do código sob teste. */
export function stubCanvasFilterSupport(supported: boolean) {
  const proto = supported ? { filter: "none" } : {};
  vi.stubGlobal("CanvasRenderingContext2D", { prototype: proto });
}

/** Canvas de "foto" com tamanho dado, já com contexto falso. */
export function fakePhotoCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
