import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_KEY, getTheme, setTheme, useTheme } from "./useTheme";

/**
 * O tema precisa ser um valor só, compartilhado. Enquanto cada `useTheme()`
 * tinha o seu `useState`, quem lia o tema em JS (cor de traçado, URL de tile)
 * ficava com o valor do mount para sempre — o defeito que deixava o mapa do
 * Tracker fora do tema depois da troca.
 */

function Sonda({ nome }: { nome: string }) {
  const { theme, isDark } = useTheme();
  return <div data-testid={nome}>{`${theme}:${isDark}`}</div>;
}

function Interruptor() {
  const { toggle } = useTheme();
  return <button onClick={toggle}>trocar</button>;
}

beforeEach(() => {
  localStorage.clear();
  act(() => setTheme("light"));
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("useTheme — um valor, todos os assinantes", () => {
  it("componentes irmãos veem a mesma troca, sem remontar", () => {
    render(
      <>
        <Sonda nome="a" />
        <Sonda nome="b" />
        <Interruptor />
      </>,
    );
    expect(screen.getByTestId("a").textContent).toBe("light:false");
    expect(screen.getByTestId("b").textContent).toBe("light:false");

    act(() => {
      screen.getByText("trocar").click();
    });

    // O irmão que NÃO disparou a troca é o que provava o defeito antigo.
    expect(screen.getByTestId("a").textContent).toBe("dark:true");
    expect(screen.getByTestId("b").textContent).toBe("dark:true");
  });

  it("um componente montado DEPOIS da troca não volta ao valor antigo", () => {
    act(() => setTheme("dark"));
    render(<Sonda nome="tarde" />);
    expect(screen.getByTestId("tarde").textContent).toBe("dark:true");
  });

  it("escreve html[data-theme] — é o que faz a cascata de tokens reagir", () => {
    act(() => setTheme("dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    act(() => setTheme("light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("acompanha a barra de status do sistema", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
    act(() => setTheme("dark"));
    expect(meta.getAttribute("content")).toBe("#121212");
    act(() => setTheme("light"));
    expect(meta.getAttribute("content")).toBe("#7B9919");
    meta.remove();
  });

  it("persiste a escolha", () => {
    act(() => setTheme("dark"));
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("troca em outra aba chega neste documento", () => {
    render(<Sonda nome="aba" />);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: "dark" }));
    });
    expect(screen.getByTestId("aba").textContent).toBe("dark:true");
    expect(getTheme()).toBe("dark");
  });

  it("evento de storage de outra chave não mexe no tema", () => {
    render(<Sonda nome="outra" />);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "qualquer_coisa", newValue: "dark" }));
    });
    expect(screen.getByTestId("outra").textContent).toBe("light:false");
  });
});
