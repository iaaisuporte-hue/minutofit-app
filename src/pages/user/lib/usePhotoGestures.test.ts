import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePhotoGestures } from "./usePhotoGestures";
import { DEFAULT_TRANSFORM, type PhotoFrame, type PhotoTransform } from "./sharePhotoTransform";

// Gestos do editor de foto com eventos sintéticos. O jsdom não tem
// PointerEvent: um MouseEvent com o tipo certo + `pointerId` basta para o hook,
// que só lê clientX/clientY/button/pointerId.

// Superfície de 270×480 px de tela para um Story 1080×1920: 1 px de tela = 4 do card.
const FRAME: PhotoFrame = { imgW: 2048, imgH: 1536, canvasW: 1080, canvasH: 1920 };

function pointer(type: string, id: number, x: number, y: number, extra: MouseEventInit = {}) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...extra });
  Object.defineProperty(e, "pointerId", { value: id });
  return e;
}

let rafQueue: Array<{ id: number; cb: FrameRequestCallback }>;
let rafSeq: number;
const flushRaf = () => {
  const q = rafQueue;
  rafQueue = [];
  q.forEach((r) => r.cb(0));
};

function setup(opts: { frame?: PhotoFrame | null; enabled?: boolean } = {}) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 270, height: 480, right: 270, bottom: 480, x: 0, y: 0, toJSON() {} }) as DOMRect;
  el.setPointerCapture = vi.fn();
  const addSpy = vi.spyOn(el, "addEventListener");
  const removeSpy = vi.spyOn(el, "removeEventListener");
  // Contrato do hook: getTransform reflete o último onChange de forma síncrona.
  const state = { t: { ...DEFAULT_TRANSFORM } as PhotoTransform };
  const onChange = vi.fn((t: PhotoTransform) => { state.t = t; });
  const frame = opts.frame === undefined ? FRAME : opts.frame;
  const hook = renderHook(() =>
    usePhotoGestures({
      targetRef: { current: el },
      getFrame: () => frame,
      getTransform: () => state.t,
      onChange,
      enabled: opts.enabled,
    }),
  );
  return { el, state, onChange, hook, addSpy, removeSpy };
}

beforeEach(() => {
  rafQueue = [];
  rafSeq = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafQueue.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => {
    rafQueue = rafQueue.filter((r) => r.id !== id);
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePhotoGestures", () => {
  it("um dedo arrasta; vários moves no mesmo frame viram um único onChange", () => {
    const { el, onChange } = setup();
    el.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    el.dispatchEvent(pointer("pointermove", 1, 105, 100));
    el.dispatchEvent(pointer("pointermove", 1, 110, 100));
    expect(rafQueue).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    flushRaf();
    expect(onChange).toHaveBeenCalledTimes(1);
    // 10 px de tela × 4 = 40 px do card.
    expect(onChange.mock.calls[0][0].offsetX).toBeCloseTo(40 / 1080);
    expect(onChange.mock.calls[0][0].offsetY).toBe(0);
  });

  it("ignora botão que não é o principal", () => {
    const { el, onChange } = setup();
    el.dispatchEvent(pointer("pointerdown", 1, 100, 100, { button: 2 }));
    el.dispatchEvent(pointer("pointermove", 1, 150, 100));
    flushRaf();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("dois dedos fazem pinça: afastar ao dobro dobra o zoom", () => {
    const { el, onChange } = setup();
    el.dispatchEvent(pointer("pointerdown", 1, 100, 240));
    el.dispatchEvent(pointer("pointerdown", 2, 150, 240));
    el.dispatchEvent(pointer("pointermove", 2, 200, 240));
    flushRaf();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].zoom).toBeCloseTo(2);
  });

  it("pointercancel termina o gesto sem devolver a foto ao lugar", () => {
    const { el, onChange, state } = setup();
    el.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    el.dispatchEvent(pointer("pointermove", 1, 110, 100));
    el.dispatchEvent(pointer("pointercancel", 1, 110, 100));
    flushRaf();
    const moved = state.t.offsetX;
    expect(moved).toBeGreaterThan(0);
    el.dispatchEvent(pointer("pointermove", 1, 200, 100)); // ponteiro já solto
    el.dispatchEvent(pointer("lostpointercapture", 1, 200, 100));
    flushRaf();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(state.t.offsetX).toBe(moved);
  });

  it("roda com ctrl (pinça do trackpad) dá zoom e cancela o zoom da página", () => {
    const { el, onChange } = setup();
    const e = new WheelEvent("wheel", { deltaY: -20, ctrlKey: true, clientX: 135, clientY: 240, cancelable: true });
    el.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    flushRaf();
    expect(onChange.mock.calls[0][0].zoom).toBeCloseTo(Math.exp(0.2));
  });

  it("wheel e touchmove entram como não passivos; menu de toque longo é cancelado", () => {
    const { el, addSpy } = setup();
    const opts = (type: string) => addSpy.mock.calls.find((c) => c[0] === type)?.[2];
    expect(opts("wheel")).toEqual({ passive: false });
    expect(opts("touchmove")).toEqual({ passive: false });
    const menu = new MouseEvent("contextmenu", { cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it("sem foto os gestos são ignorados", () => {
    const { el, onChange } = setup({ frame: null });
    el.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    el.dispatchEvent(pointer("pointermove", 1, 150, 100));
    flushRaf();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("unmount remove todos os listeners e cancela o frame pendente", () => {
    const { el, onChange, hook, addSpy, removeSpy } = setup();
    el.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    el.dispatchEvent(pointer("pointermove", 1, 120, 100));
    const pending = rafQueue[0].id;
    hook.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(pending);
    const added = addSpy.mock.calls.map((c) => [c[0], c[1]]);
    const removed = removeSpy.mock.calls.map((c) => [c[0], c[1]]);
    expect(removed).toEqual(expect.arrayContaining(added));
    expect(removed).toHaveLength(added.length);
    flushRaf();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("desligado não instala nada", () => {
    const { addSpy } = setup({ enabled: false });
    expect(addSpy).not.toHaveBeenCalled();
  });
});
