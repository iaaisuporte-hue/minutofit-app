import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
