import { useEffect } from "react";

/**
 * Pilha de camadas dispensáveis (overlays abertos).
 *
 * ## O defeito que isto corrige
 *
 * A P0 (§32) fez o botão voltar do Android fechar o que estivesse por cima
 * antes de navegar. A implementação procurava um `[role="dialog"]` no DOM e
 * disparava `Escape`, com o comentário "é o contrato que os diálogos do app já
 * escutam".
 *
 * **Isso era falso para 16 diálogos.** Eles têm `role="dialog"`, então o back
 * os detectava e considerava a camada "fechada" — mas ninguém escutava o
 * `Escape`, e o resultado era o pior possível: a pessoa apertava voltar e
 * **nada acontecia**. O toque era engolido em silêncio.
 *
 * ## Por que registro e não evento
 *
 * Disparar um evento e torcer é adivinhação: não há como saber se alguém
 * atendeu. Aqui cada overlay REGISTRA a própria função de fechar ao montar. O
 * back chama a do topo — determinístico, e `fecharTopo()` devolve `false`
 * honestamente quando não há nada, em vez de fingir que fechou.
 *
 * LIFO porque é o que a pilha visual faz: com um diálogo de confirmação aberto
 * sobre uma folha, voltar fecha a confirmação, não a folha de baixo.
 */

type Fechar = () => void;

const pilha: Fechar[] = [];

/** Registra um overlay. Devolve a função que o remove. */
export function registrarOverlay(fechar: Fechar): () => void {
  pilha.push(fechar);
  return () => {
    const i = pilha.lastIndexOf(fechar);
    if (i >= 0) pilha.splice(i, 1);
  };
}

/**
 * Fecha a camada mais alta. `false` quando não havia nada aberto — e é esse
 * `false` que permite ao chamador seguir com a navegação em vez de engolir o
 * gesto.
 */
export function fecharTopo(): boolean {
  const fechar = pilha[pilha.length - 1];
  if (!fechar) return false;
  fechar();
  return true;
}

/** Quantos overlays estão abertos. Só para diagnóstico e teste. */
export function overlaysAbertos(): number {
  return pilha.length;
}

/** Só para teste: esvazia a pilha entre casos. */
export function __limparOverlays(): void {
  pilha.length = 0;
}

/**
 * Hook para overlays dispensáveis.
 *
 * Faz as duas coisas que todo diálogo precisa e que estavam sendo repetidas (ou
 * esquecidas): registrar na pilha do botão voltar e fechar com `Escape`. Um
 * overlay que usa este hook está coberto nas duas plataformas sem pensar nisso.
 */
export function useDismissable(onClose: Fechar, ativo = true): void {
  useEffect(() => {
    if (!ativo) return;
    const remover = registrarOverlay(onClose);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      remover();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, ativo]);
}
