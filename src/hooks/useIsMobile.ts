import { useMediaQuery } from "./useMediaQuery";

/**
 * Largura de CONTEÚDO (colunas, tamanhos) — ex.: `useIsMobile(720)`.
 *
 * NÃO decide navegação: quem decide se existe bottom nav/top bar/sidebar é o shell mobile
 * (`MOBILE_SHELL_QUERY` em `layout/mobileShell.ts`, `useMobileShell`). Usar este hook para perguntar "a nav
 * está visível?" reabre a divergência entre CSS e React que o G1 corrigiu.
 */
export function useIsMobile(maxWidth = 768) {
  return useMediaQuery(`(max-width: ${maxWidth}px)`, () => typeof window !== "undefined" && window.innerWidth <= maxWidth);
}
