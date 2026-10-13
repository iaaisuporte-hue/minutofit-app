import { useLayoutEffect, type RefObject } from "react";

/**
 * Publica a altura REAL (border-box) de um elemento fixo como variável CSS em
 * `:root`, para que a reserva de espaço das páginas e a pilha de elementos fixos
 * (nav, mini-player, banners) somem valores medidos e não números mágicos.
 *
 * - `useLayoutEffect`: publica antes do primeiro paint (sem salto duplo);
 * - `ResizeObserver` em border-box + `resize`: o safe-area muda só o padding;
 * - remove a variável ao desmontar / desativar — nenhuma reserva residual;
 * - consumidores devem usar sempre `var(--nome, 0px)`.
 */
export function useLayoutVar(
  ref: RefObject<HTMLElement | null>,
  name: `--${string}`,
  active = true,
): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!active || !el) {
      root.style.removeProperty(name);
      return;
    }
    let last = "";
    const publish = () => {
      const next = `${Math.ceil(el.getBoundingClientRect().height)}px`;
      if (next === last) return;
      last = next;
      root.style.setProperty(name, next);
    };
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    ro?.observe(el, { box: "border-box" });
    window.addEventListener("resize", publish);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty(name);
    };
  }, [ref, name, active]);
}
