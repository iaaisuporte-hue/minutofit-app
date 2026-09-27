import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardAwareFocus } from "./KeyboardAwareFocus";

/**
 * P0.5 — a barra de séries do Modo Treino é `position: fixed; bottom: 0` e
 * ficava ATRÁS do teclado. A correção não pode ser um padding arbitrário: a
 * altura do teclado varia por aparelho, idioma e barra de sugestões. Estes
 * testes travam o contrato de que `--kb-inset` reflete a medida real.
 */

type VV = {
  height: number;
  offsetTop: number;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
};

let ouvintes: Array<() => void> = [];
let vv: VV;

function emitir() {
  act(() => {
    ouvintes.forEach((f) => f());
  });
}

beforeEach(() => {
  ouvintes = [];
  vv = {
    height: 740,
    offsetTop: 0,
    addEventListener: (_t, f) => { ouvintes.push(f); },
    removeEventListener: (_t, f) => { ouvintes = ouvintes.filter((x) => x !== f); },
  };
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", { value: 740, configurable: true, writable: true });
});

afterEach(() => {
  document.documentElement.style.removeProperty("--kb-inset");
  document.documentElement.classList.remove("kb-open");
});

const inset = () => document.documentElement.style.getPropertyValue("--kb-inset");
const aberto = () => document.documentElement.classList.contains("kb-open");

describe("--kb-inset", () => {
  it("é zero com o teclado fechado", () => {
    render(<KeyboardAwareFocus />);
    expect(inset()).toBe("0px");
    expect(aberto()).toBe(false);
  });

  it("publica a altura MEDIDA do teclado, não um valor fixo", () => {
    render(<KeyboardAwareFocus />);
    vv.height = 420; // teclado de ~320px
    emitir();
    expect(inset()).toBe("320px");
    expect(aberto()).toBe(true);

    vv.height = 380; // outro aparelho / barra de sugestões aberta
    emitir();
    expect(inset()).toBe("360px");
  });

  it("desconta o deslocamento da viewport (iOS empurra em vez de encolher)", () => {
    render(<KeyboardAwareFocus />);
    vv.height = 420;
    vv.offsetTop = 40;
    emitir();
    expect(inset()).toBe("280px");
  });

  it("não confunde a barra de endereço com teclado", () => {
    render(<KeyboardAwareFocus />);
    vv.height = 680; // 60px — some ao rolar, não é teclado
    emitir();
    expect(inset()).toBe("0px");
    expect(aberto()).toBe(false);
  });

  it("devolve o rodapé quando o teclado fecha", () => {
    render(<KeyboardAwareFocus />);
    vv.height = 420;
    emitir();
    expect(aberto()).toBe(true);
    vv.height = 740;
    emitir();
    expect(inset()).toBe("0px");
    expect(aberto()).toBe(false);
  });

  it("limpa a variável ao desmontar — não deixa vão em outras telas", () => {
    const { unmount } = render(<KeyboardAwareFocus />);
    vv.height = 420;
    emitir();
    unmount();
    expect(inset()).toBe("");
    expect(aberto()).toBe(false);
  });
});

/**
 * P0 (set/2026) — o campo focado não rolava NUNCA no Modo Treino.
 *
 * A decisão de "dá para resolver rolando?" perguntava se existia algum
 * ancestral `position: fixed` e desistia se existisse. Só que a tela de treino
 * inteira vive dentro de `.ws-root { position: fixed; inset: 0 }`, então todo
 * campo caía na saída — inclusive os de carga/reps da lista de séries, que
 * rolam dentro de `.ws-body`. Estes testes travam a regra certa: vale quem vem
 * PRIMEIRO subindo a partir do campo, rolável ou fixo.
 */
describe("rolagem do campo focado", () => {
  /** Teclado de 320px: 740 de janela, 420 de viewport visível. */
  const TECLADO = 320;
  const RECT_BOTTOM = 600; // campo abaixo da linha do teclado (420)
  const DELTA = RECT_BOTTOM + 12 - 420; // FOLGA = 12 → 192

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  /**
   * Monta a hierarquia real da tela de treino: shell fixo por fora, container
   * de rolagem no meio (ou não), campo dentro.
   */
  function montarTela({ comRolagem }: { comRolagem: boolean }) {
    const shell = document.createElement("div"); // .ws-root
    shell.style.position = "fixed";

    const meio = document.createElement("div"); // .ws-body
    if (comRolagem) meio.style.overflowY = "auto";
    Object.defineProperty(meio, "scrollHeight", { value: comRolagem ? 2000 : 0, configurable: true });
    Object.defineProperty(meio, "clientHeight", { value: comRolagem ? 600 : 0, configurable: true });
    meio.scrollBy = vi.fn();

    const campo = document.createElement("input");
    campo.getBoundingClientRect = () =>
      ({ bottom: RECT_BOTTOM, top: RECT_BOTTOM - 40, height: 40 }) as DOMRect;

    meio.appendChild(campo);
    shell.appendChild(meio);
    document.body.appendChild(shell);
    return { meio, campo };
  }

  function focar(campo: HTMLElement) {
    act(() => {
      campo.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      vi.advanceTimersByTime(400); // cobre os dois tempos (60ms e 350ms)
    });
  }

  it("rola o campo para cima do teclado mesmo dentro de um shell fixo", () => {
    render(<KeyboardAwareFocus />);
    const { meio, campo } = montarTela({ comRolagem: true });
    vv.height = 740 - TECLADO;
    emitir();

    focar(campo);

    expect(meio.scrollBy).toHaveBeenCalledWith({ top: DELTA, behavior: "smooth" });
  });

  it("abre espaço do tamanho do teclado no container que rola", () => {
    render(<KeyboardAwareFocus />);
    const { meio, campo } = montarTela({ comRolagem: true });
    vv.height = 740 - TECLADO;
    emitir();

    focar(campo);

    expect(meio.style.paddingBottom).toBe(`${TECLADO + 12}px`);
  });

  it("devolve o espaço ao sair do campo — sem vão no fim da tela", () => {
    render(<KeyboardAwareFocus />);
    const { meio, campo } = montarTela({ comRolagem: true });
    vv.height = 740 - TECLADO;
    emitir();
    focar(campo);
    expect(meio.style.paddingBottom).toBe(`${TECLADO + 12}px`);

    act(() => {
      campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(meio.style.paddingBottom).toBe("");
  });

  it("não rola campo de barra ancorada — ali quem resolve é --kb-inset", () => {
    render(<KeyboardAwareFocus />);
    const { meio, campo } = montarTela({ comRolagem: false });
    vv.height = 740 - TECLADO;
    emitir();

    focar(campo);

    expect(meio.scrollBy).not.toHaveBeenCalled();
    expect(meio.style.paddingBottom).toBe("");
  });

  it("não rola quando o campo já está visível acima do teclado", () => {
    render(<KeyboardAwareFocus />);
    const { meio, campo } = montarTela({ comRolagem: true });
    campo.getBoundingClientRect = () => ({ bottom: 300, top: 260, height: 40 }) as DOMRect;
    vv.height = 740 - TECLADO;
    emitir();

    focar(campo);

    expect(meio.scrollBy).not.toHaveBeenCalled();
  });
});
