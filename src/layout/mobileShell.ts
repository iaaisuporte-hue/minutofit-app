import { useMediaQuery } from "../hooks/useMediaQuery";

/**
 * Condição ÚNICA do "shell mobile": top bar + bottom nav, sem sidebar.
 *
 * Vale até 980px de largura: celular em retrato, celular DEITADO (667–932px) e tablet em retrato. Antes o shell
 * mobile terminava em 720px e a sidebar só deixava de empilhar em 980px: entre os dois, e em todo celular deitado,
 * a sidebar inteira (~570px) ficava ACIMA do conteúdo e o `main` começava abaixo da dobra (G1, Onda 0).
 *
 * Largura apenas, de propósito: uma cláusula `(max-height: 500px) and (orientation: landscape)` trocaria o shell
 * no meio da digitação em tablet Android (com `interactive-widget=resizes-content` o teclado encolhe a viewport
 * de layout, e as media queries leem essa viewport). Se um dia for preciso cobrir celular deitado com mais de
 * 980px (~1000), cercar com largura: `(max-width: 1040px) and (max-height: 500px) and (orientation: landscape)`.
 *
 * Esta constante é a fonte de verdade: cada media query de CSS que decide a navegação carrega o comentário
 * `/* mobile-shell *\/` e o teste `mobileShell.test.ts` falha se alguma divergir daqui. Regras de CONTEÚDO
 * (colunas, tamanhos) continuam livres para usar o breakpoint que quiserem — este só decide a navegação.
 *
 * Admin e Academia usam o mesmo AppShell sem bottom nav/top bar (desktop-first por decisão do CLAUDE.md) e
 * continuam com a sidebar empilhada abaixo de 980px.
 */
export const MOBILE_SHELL_QUERY = "(max-width: 980px)";

/** `true` quando o shell mobile (top bar + bottom nav) está ativo. Mesmo critério do CSS. */
export function useMobileShell(): boolean {
  return useMediaQuery(MOBILE_SHELL_QUERY);
}
