import { useSyncExternalStore } from "react";

/**
 * `matchMedia` como estado React.
 *
 * Mesmo mecanismo das media queries do CSS: a pergunta é respondida pelo navegador, não por uma conta paralela
 * em JS (`innerWidth <= N`), então CSS e React não divergem em zoom, barra de rolagem ou rotação.
 *
 * `fallback` só entra quando `matchMedia` não existe (jsdom nos testes, SSR): nesse caso a resposta vem do
 * callback e o estado é reavaliado no evento `resize`.
 */
export function useMediaQuery(query: string, fallback: () => boolean = () => false): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined") return () => {};
      if (typeof window.matchMedia !== "function") {
        window.addEventListener("resize", notify);
        return () => window.removeEventListener("resize", notify);
      }
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => {
      if (typeof window === "undefined") return false;
      return typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback();
    },
    () => false,
  );
}
