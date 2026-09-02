import { useEffect } from "react";

/**
 * Mantém o campo em foco acima do teclado.
 *
 * O problema medido (QA mobile set/2026, 360×740): ao focar a carga da 4ª série
 * do treino, o campo ficava com a base em 517px enquanto o teclado deixava só
 * 410px visíveis — o campo E o botão "Concluir série" ficavam embaixo do
 * teclado, e nada rolava sozinho. A pessoa digitava às cegas ou tinha que
 * fechar o teclado para confirmar a série (SPEC §9).
 *
 * Por que em JS e não só no nativo: no Android 15+ o `adjustResize` deixou de
 * ser o mecanismo — o teclado chega como *IME inset*, e o handler de
 * edge-to-edge do Capacitor consome `systemBars() | displayCutout()`, não o
 * `ime()`. Depender do comportamento da plataforma aqui daria resultados
 * diferentes por versão de Android e por WebView. `visualViewport` é o mesmo
 * contrato nos dois sistemas e no PWA.
 *
 * O ajuste só acontece quando o campo REALMENTE está coberto — não há rolagem
 * gratuita a cada toque.
 */

/** Folga abaixo do campo para caber o rótulo/ação imediatamente seguinte. */
const FOLGA = 12;

/** Abaixo disto a diferença de altura é barra de endereço, não teclado. */
const MIN_TECLADO = 120;

function ehCampo(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * O ancestral que realmente rola. Sem ele não dá para abrir espaço no lugar
 * certo: em telas como o Modo Treino quem rola é um container interno, não o
 * documento.
 */
function scrollerDe(el: HTMLElement): HTMLElement {
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== document.body) {
    const st = getComputedStyle(p);
    const rolavel = /(auto|scroll)/.test(st.overflowY);
    if (rolavel && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : document.documentElement;
}

export function KeyboardAwareFocus() {
  useEffect(() => {
    const vv = window.visualViewport;
    let alvo: HTMLElement | null = null;

    /**
     * Traz o campo para a área ainda visível, se o teclado o cobriu.
     * `block: "center"` em vez de "nearest": no meio da tela o campo fica
     * visível junto com o botão que costuma segui-lo (concluir série, salvar).
     */
    /** Container ao qual demos espaço extra — para desfazer depois. */
    let folgado: HTMLElement | null = null;

    function limparFolga() {
      if (!folgado) return;
      folgado.style.paddingBottom = folgado.dataset.kbPrevPad ?? "";
      delete folgado.dataset.kbPrevPad;
      folgado = null;
    }

    function ajustar() {
      if (!alvo || !alvo.isConnected) return;
      // Sem visualViewport (navegador antigo), usa a altura da janela: aí o
      // cálculo só acerta quando a janela é redimensionada pelo teclado, que é
      // exatamente o caso em que a correção seria desnecessária. Sair é melhor
      // que rolar sem motivo.
      const visivel = vv ? vv.height : window.innerHeight;
      const alturaTeclado = window.innerHeight - visivel;
      const r = alvo.getBoundingClientRect();
      if (r.bottom + FOLGA <= visivel) return; // já está à vista

      // Rolar sozinho não basta quando o campo está no FIM da página: não há
      // conteúdo abaixo para onde rolar, e `scrollIntoView` para no fim do
      // scroll — foi o que aconteceu com a última série do treino, que subiu
      // 20px e continuou embaixo do teclado. Aqui abrimos espaço equivalente
      // ao teclado no container que rola, e só então rolamos.
      const sc = scrollerDe(alvo);
      if (alturaTeclado > MIN_TECLADO && folgado !== sc) {
        limparFolga();
        folgado = sc;
        sc.dataset.kbPrevPad = sc.style.paddingBottom;
        sc.style.paddingBottom = `${alturaTeclado + FOLGA}px`;
      }

      // Deslocamento calculado, e não `scrollIntoView`: aquele centraliza em
      // relação à viewport de LAYOUT (a tela cheia), que continua com a altura
      // toda enquanto o teclado cobre a metade de baixo. Medido: parava 21px
      // abaixo da linha do teclado. Aqui a conta é direta — quanto falta para o
      // campo caber na área realmente visível.
      const delta = alvo.getBoundingClientRect().bottom + FOLGA - visivel;
      if (delta > 0) sc.scrollBy({ top: delta, behavior: "smooth" });
    }

    function onFocusIn(e: FocusEvent) {
      if (!ehCampo(e.target)) return;
      alvo = e.target;
      // Dois tempos de propósito: o teclado abre DEPOIS do focus, então a
      // primeira medição ainda vê a tela inteira. O segundo ajuste é o que
      // costuma valer; o primeiro cobre o caso do teclado já aberto (pulando
      // de um campo para outro), em que não há resize e nenhum evento vem.
      window.setTimeout(ajustar, 60);
      window.setTimeout(ajustar, 350);
    }

    function onFocusOut() {
      alvo = null;
      // Devolve o espaço: deixar o padding fixo criaria um vão no fim de toda
      // tela que já teve um campo focado.
      limparFolga();
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", ajustar);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", ajustar);
      limparFolga();
    };
  }, []);

  return null;
}
