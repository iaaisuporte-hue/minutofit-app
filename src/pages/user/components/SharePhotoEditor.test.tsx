import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { installFakeCanvas } from "../../../test/fakeCanvas2d";
import { __limparOverlays, fecharTopo } from "../../../lib/overlayStack";
import { defaultEdit, type PhotoAdjust, type ShareEdit } from "../lib/sharePhotoTransform";
import type { PhotoLayers, PhotoSession } from "../lib/sharePhotoSource";

// O desenho em si (renderBackground/renderForeground) tem teste próprio com
// canvas espião; aqui elas viram espiões para conferir O QUE o editor desenha,
// quantas vezes, e que nenhum JPEG sai durante a edição.
const img = vi.hoisted(() => ({
  computeCardLayout: vi.fn((format: string) => ({ format, width: 1080, height: format === "story" ? 1920 : 1080 })),
  renderBackground: vi.fn(),
  renderForeground: vi.fn(),
  getLogo: vi.fn(async () => null),
  composeWorkoutImage: vi.fn(),
}));
vi.mock("../lib/shareWorkoutImage", () => img);

import { SharePhotoEditor, type ShareEdits } from "./SharePhotoEditor";

let rafQueue: Array<{ id: number; cb: FrameRequestCallback }>;
let rafSeq: number;
const cancelRaf = vi.fn((id: number) => {
  rafQueue = rafQueue.filter((r) => r.id !== id);
});
function flushRaf() {
  act(() => {
    const q = rafQueue;
    rafQueue = [];
    q.forEach((r) => r.cb(0));
  });
}

function canvasLike(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Sessão falsa: mesmo contrato da real (objeto novo a cada ajuste, cache por valor). */
function fakeSession() {
  const source = canvasLike(2000, 1500);
  const mk = (adjust: PhotoAdjust): PhotoLayers => ({ source, adjusted: source, glass: source, adjust: { ...adjust } });
  let layers: PhotoLayers | null = mk({ brightness: 1, contrast: 1 });
  const s = {
    get layers() {
      return layers;
    },
    load: vi.fn(),
    setAdjust: vi.fn((a: PhotoAdjust) => {
      if (!layers) return null;
      if (layers.adjust.brightness === a.brightness && layers.adjust.contrast === a.contrast) return layers;
      layers = mk(a);
      return layers;
    }),
    dispose: vi.fn(),
  };
  return s as typeof s & PhotoSession;
}

function pointer(type: string, id: number, x: number, y: number) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(e, "pointerId", { value: id });
  return e;
}

function edits(story: Partial<ShareEdit> = {}, square: Partial<ShareEdit> = {}): ShareEdits {
  return { story: { ...defaultEdit(), ...story }, square: { ...defaultEdit(), ...square } };
}

function montar(over: Partial<React.ComponentProps<typeof SharePhotoEditor>> = {}) {
  const session = fakeSession();
  const onDone = vi.fn();
  const onBack = vi.fn();
  const utils = render(
    <SharePhotoEditor
      session={session}
      initialLayers={session.layers!}
      initialFormat="story"
      initialEdits={edits()}
      focus="Peito"
      onDone={onDone}
      onBack={onBack}
      {...over}
    />,
  );
  const canvas = utils.container.querySelector("canvas.spe-canvas") as HTMLCanvasElement;
  return { ...utils, session, onDone, onBack, canvas };
}

/** Deixa o logo resolver e roda o frame pendente. */
async function primeiroFrame() {
  await act(async () => {});
  flushRaf();
}

const brilho = () => screen.getByLabelText("Brilho da foto") as HTMLInputElement;
const contraste = () => screen.getByLabelText("Contraste da foto") as HTMLInputElement;
const botao = (name: string) => screen.getByRole("button", { name });

let canvases: ReturnType<typeof installFakeCanvas>;

beforeEach(() => {
  vi.clearAllMocks();
  __limparOverlays();
  window.sessionStorage.clear();
  canvases = installFakeCanvas();
  rafQueue = [];
  rafSeq = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafQueue.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", cancelRaf);
  // Palco de 360×640 px (cabe um Story exato). Também é o retângulo do canvas
  // para os gestos: 1 px de tela = 3 px do card.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: 360, height: 640, right: 360, bottom: 640, x: 0, y: 0, toJSON() {},
  } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob");
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SharePhotoEditor — desenho", () => {
  it("canvas com a proporção do card e backing store = largura CSS × DPR (≤ 2)", async () => {
    vi.stubGlobal("devicePixelRatio", 3);
    const { canvas } = montar();
    await primeiroFrame();
    expect(canvas.style.width).toBe("360px");
    expect(canvas.style.height).toBe("640px");
    // DPR 3 é limitado a 2.
    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(1280);
    const [, scale] = img.renderBackground.mock.calls[0];
    expect(scale).toBeCloseTo(720 / 1080);
  });

  it("frames coalescidos: várias mudanças antes do rAF viram um desenho; a camada fixa fica em cache", async () => {
    montar();
    await primeiroFrame();
    expect(img.renderBackground).toHaveBeenCalledTimes(1);
    expect(img.renderForeground).toHaveBeenCalledTimes(1);

    fireEvent.change(brilho(), { target: { value: "1.1" } });
    fireEvent.change(brilho(), { target: { value: "1.2" } });
    fireEvent.change(contraste(), { target: { value: "0.9" } });
    expect(rafQueue).toHaveLength(1);
    flushRaf();
    expect(img.renderBackground).toHaveBeenCalledTimes(2);
    // Brilho não mexe na camada fixa: nada de redesenhar texto/logo.
    expect(img.renderForeground).toHaveBeenCalledTimes(1);

    // Overlay muda a chave do cache (sombra do texto no "Suave").
    fireEvent.click(botao("Suave"));
    flushRaf();
    expect(img.renderForeground).toHaveBeenCalledTimes(2);
    expect(img.renderForeground.mock.calls[1][4]).toBe("soft");
  });

  it("gesto redesenha só o fundo: nenhum JPEG, nenhum ajuste de fonte, nenhuma composição", async () => {
    const { canvas, session } = montar();
    await primeiroFrame();
    act(() => {
      canvas.dispatchEvent(pointer("pointerdown", 1, 100, 100));
      canvas.dispatchEvent(pointer("pointermove", 1, 110, 100));
      canvas.dispatchEvent(pointer("pointermove", 1, 120, 100));
    });
    flushRaf(); // rAF do gesto → onChange
    flushRaf(); // rAF do desenho
    act(() => {
      canvas.dispatchEvent(pointer("pointerup", 1, 120, 100));
    });
    const last = img.renderBackground.mock.calls.at(-1)!;
    expect(last[3].transform.offsetX).not.toBe(0);
    expect(img.composeWorkoutImage).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
    expect(session.setAdjust).not.toHaveBeenCalled();
    expect(img.renderForeground).toHaveBeenCalledTimes(1);
  });

  it("unmount cancela o frame pendente e libera os canvases do editor", async () => {
    const { unmount, canvas } = montar();
    await primeiroFrame();
    fireEvent.change(brilho(), { target: { value: "1.2" } });
    const pending = rafQueue[0].id;
    const fg = canvases.created.find((c) => c !== canvas && c.width === canvas.width);
    expect(fg).toBeDefined();
    unmount();
    expect(cancelRaf).toHaveBeenCalledWith(pending);
    expect(canvas.width).toBe(0);
    expect(fg!.width).toBe(0);
  });
});

describe("SharePhotoEditor — ajustes", () => {
  it("brilho/contraste com debounce: um setAdjust com o último valor", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { session } = montar();
    await primeiroFrame();
    fireEvent.change(brilho(), { target: { value: "1.1" } });
    fireEvent.change(brilho(), { target: { value: "1.3" } });
    fireEvent.change(contraste(), { target: { value: "1.2" } });
    expect(session.setAdjust).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(session.setAdjust).toHaveBeenCalledTimes(1);
    expect(session.setAdjust).toHaveBeenCalledWith({ brightness: 1.3, contrast: 1.2 });
    // O frame seguinte usa as camadas NOVAS (as antigas podem estar zeradas).
    flushRaf();
    expect(img.renderBackground.mock.calls.at(-1)![2]).toBe(session.layers);
  });

  it("sliders acessíveis com aria-valuetext e copy separando brilho (foto) de escurecimento (fundo)", () => {
    montar();
    expect(brilho()).toHaveAttribute("aria-valuetext", "Neutro");
    fireEvent.change(brilho(), { target: { value: "1.2" } });
    expect(brilho()).toHaveAttribute("aria-valuetext", "+20%");
    expect(screen.getByText("Ajuste da foto")).toBeInTheDocument();
    expect(screen.getByText("Escurecimento do fundo")).toBeInTheDocument();
  });

  it("Restaurar zera zoom/offset/brilho/contraste e volta o overlay a Médio só no formato atual", async () => {
    const square: Partial<ShareEdit> = {
      transform: { zoom: 2, offsetX: 0.1, offsetY: 0 },
      adjust: { brightness: 0.8, contrast: 1.1 },
      overlay: "strong",
    };
    const { onDone } = montar({
      initialEdits: edits(
        { transform: { zoom: 1.5, offsetX: 0.05, offsetY: -0.02 }, adjust: { brightness: 1.2, contrast: 0.9 }, overlay: "soft" },
        square,
      ),
    });
    expect(botao("Restaurar")).toBeEnabled();
    fireEvent.click(botao("Restaurar"));
    expect(brilho().value).toBe("1");
    expect(contraste().value).toBe("1");
    expect(botao("Médio")).toHaveAttribute("aria-pressed", "true");
    expect(botao("Restaurar")).toBeDisabled();
    fireEvent.click(botao("Concluir"));
    const result = onDone.mock.calls[0][0];
    expect(result.edits.story).toEqual(defaultEdit());
    expect(result.edits.square).toEqual({ ...defaultEdit(), ...square });
  });

  it("cada formato guarda a própria edição; o não visitado nasce no padrão", () => {
    montar();
    fireEvent.change(brilho(), { target: { value: "1.3" } });
    fireEvent.click(botao("Suave"));
    fireEvent.click(botao("Feed 1:1"));
    expect(brilho().value).toBe("1");
    expect(botao("Médio")).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(contraste(), { target: { value: "0.8" } });
    fireEvent.click(botao("Story 9:16"));
    expect(brilho().value).toBe("1.3");
    expect(contraste().value).toBe("1");
    expect(botao("Suave")).toHaveAttribute("aria-pressed", "true");
  });

  it("alternar Story↔Feed 20× não decodifica, não compõe e só reaplica ajuste quando o valor muda", async () => {
    const { session } = montar({ initialEdits: edits({}, { adjust: { brightness: 1.2, contrast: 1 } }) });
    await primeiroFrame();
    for (let i = 0; i < 20; i++) {
      fireEvent.click(botao(i % 2 === 0 ? "Feed 1:1" : "Story 9:16"));
    }
    expect(session.load).not.toHaveBeenCalled();
    expect(img.composeWorkoutImage).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
    // Ajustes diferentes: uma troca por alternância, nunca mais que isso.
    expect(session.setAdjust).toHaveBeenCalledTimes(20);
    flushRaf();
    // O canvas da camada fixa é um só, reaproveitado.
    const alive = canvases.alive().filter((c) => !c.classList.contains("spe-canvas"));
    expect(alive.length).toBeLessThanOrEqual(3); // fonte da sessão falsa + measure + camada fixa
  });

  it("formatos com o mesmo ajuste não tocam na fonte", () => {
    const { session } = montar();
    for (let i = 0; i < 6; i++) fireEvent.click(botao(i % 2 === 0 ? "Feed 1:1" : "Story 9:16"));
    expect(session.setAdjust).not.toHaveBeenCalled();
  });
});

describe("SharePhotoEditor — saída", () => {
  it("Concluir aplica o ajuste pendente e entrega formato, edições e camadas", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { onDone, session } = montar();
    fireEvent.click(botao("Feed 1:1"));
    fireEvent.change(brilho(), { target: { value: "1.25" } });
    fireEvent.click(botao("Forte"));
    // Concluir antes do debounce: não pode exportar com o brilho antigo.
    fireEvent.click(botao("Concluir"));
    expect(onDone).toHaveBeenCalledTimes(1);
    const r = onDone.mock.calls[0][0];
    expect(r.format).toBe("square");
    expect(r.edits.square.adjust).toEqual({ brightness: 1.25, contrast: 1 });
    expect(r.edits.square.overlay).toBe("strong");
    expect(r.layers).toBe(session.layers);
    expect(r.layers.adjust).toEqual({ brightness: 1.25, contrast: 1 });
    expect(img.composeWorkoutImage).not.toHaveBeenCalled();
  });

  it("Voltar e o botão voltar do Android chamam onBack", () => {
    const { onBack } = montar();
    fireEvent.click(botao("Voltar"));
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => {
      expect(fecharTopo()).toBe(true);
    });
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("dica de gesto só na primeira abertura da sessão", () => {
    const first = montar();
    expect(screen.getByText("Pince para zoom · arraste para posicionar")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("s2core:share:gestureHintSeen")).toBe("1");
    first.unmount();
    montar();
    expect(screen.queryByText("Pince para zoom · arraste para posicionar")).not.toBeInTheDocument();
  });
});
