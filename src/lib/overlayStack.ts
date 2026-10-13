import { useEffect, useRef } from "react";

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
  instalarEscape();
  return () => {
    const i = pilha.lastIndexOf(fechar);
    if (i >= 0) pilha.splice(i, 1);
    if (pilha.length === 0) removerEscape();
  };
}

/**
 * UM ouvinte de Escape para a pilha inteira (instalado com o primeiro overlay,
 * removido com o último). Com um ouvinte por overlay, o Escape fechava a camada
 * do topo e, no mesmo evento, o ouvinte seguinte fechava a debaixo.
 */
function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape") fecharTopo();
}
function instalarEscape() {
  if (typeof window !== "undefined") window.addEventListener("keydown", onEscape);
}
function removerEscape() {
  if (typeof window !== "undefined") window.removeEventListener("keydown", onEscape);
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
  removerEscape();
}

/**
 * Hook para overlays dispensáveis.
 *
 * Faz as duas coisas que todo diálogo precisa e que estavam sendo repetidas (ou
 * esquecidas): registrar na pilha do botão voltar e fechar com `Escape`. Um
 * overlay que usa este hook está coberto nas duas plataformas sem pensar nisso.
 */
export function useDismissable(onClose: Fechar, ativo = true): void {
  // Ref para o `onClose` mais recente: com `onClose` na lista de dependências, um
  // callback inline (`() => setX(false)`) re-registrava o overlay a CADA render e
  // o levava ao topo da pilha — um overlay de baixo que re-renderizava passava a
  // fechar antes do de cima. Registra uma vez por abertura; a ordem é a da abertura.
  const ultimo = useRef(onClose);
  useEffect(() => {
    ultimo.current = onClose;
  });
  useEffect(() => {
    if (!ativo) return;
    return registrarOverlay(() => ultimo.current());
  }, [ativo]);
}

/* ── Comportamento comum de overlay: scroll lock e foco ─────────────────── */

let travas = 0;
let overflowOriginal = "";

/**
 * Trava a rolagem do body enquanto houver ao menos um overlay aberto.
 *
 * Com contagem de referências: dois overlays empilhados que guardam e
 * restauram `body.style.overflow` cada um por conta própria se atropelam —
 * fechar o de baixo primeiro restaura "" e o de cima fica aberto com o fundo
 * rolando. Aqui só o último a sair restaura o valor original.
 */
export function useBodyScrollLock(ativo = true): void {
  useEffect(() => {
    if (!ativo) return;
    if (travas === 0) overflowOriginal = document.body.style.overflow;
    travas += 1;
    document.body.style.overflow = "hidden";
    return () => {
      travas -= 1;
      if (travas <= 0) {
        travas = 0;
        document.body.style.overflow = overflowOriginal;
      }
    };
  }, [ativo]);
}

/** Só para teste. */
export function __travasAtivas(): number {
  return travas;
}

/**
 * Foco previsível: ao abrir, memoriza o elemento que o tinha (o gatilho); ao
 * fechar, devolve o foco a ele se ainda estiver no documento. Não move o foco
 * inicial — cada overlay sabe qual controle merece recebê-lo (ver `autoFocus`).
 */
export function useRestoreFocus(ativo = true): void {
  useEffect(() => {
    if (!ativo) return;
    const gatilho = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (gatilho && gatilho.isConnected && typeof gatilho.focus === "function") gatilho.focus();
    };
  }, [ativo]);
}

/** Tudo que um overlay dispensável precisa: voltar/Escape, scroll lock e foco. */
export function useOverlay(onClose: Fechar, ativo = true): void {
  useDismissable(onClose, ativo);
  useBodyScrollLock(ativo);
  useRestoreFocus(ativo);
}
