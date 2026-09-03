import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "./platform";
import { traduzirDeepLink } from "./deepLinks";
import { fecharTopo } from "./overlayStack";
import { postActivityEvent } from "../features/tracker/activityEvents";

/**
 * Ponte de comportamento nativo (Capacitor). Só ativa no app empacotado.
 * - Botão voltar do Android: fecha o que estiver aberto por cima da tela antes
 *   de navegar; volta na navegação se houver histórico; na raiz, minimiza o app
 *   (em vez de fechar). Sem isso, o back fecha o app na 1ª tela.
 * - App Links: link de convite aberto fora do app (WhatsApp) entra no router.
 *
 * Renderiza null — é só efeito colateral. Montar uma vez (perto da raiz).
 */

/**
 * Fecha a camada mais alta da interface, se houver.
 *
 * O back do Android é um botão só, e o WebView não sabe que existe um modal
 * aberto: `canGoBack` continua true, então a primeira versão NAVEGAVA para trás
 * com o diálogo na tela (SPEC P0 §32).
 *
 * ## Correção do fechamento da trilha
 *
 * A versão da P0 procurava `[role="dialog"]` no DOM, disparava `Escape` e
 * devolvia `true`, com o comentário de que os diálogos "já escutam" esse
 * contrato. **A auditoria do fechamento mostrou que 16 deles NÃO escutavam.**
 * O back os detectava, considerava a camada fechada e engolia o gesto: a pessoa
 * apertava voltar e nada acontecia.
 *
 * Agora a fonte é a pilha explícita (`overlayStack`): cada overlay registra a
 * própria função de fechar. Não há adivinhação, e o `false` é honesto.
 *
 * O disparo de `Escape` permanece como SEGUNDA tentativa, para os overlays
 * baseados em `DrawerShell`, que tratam a tecla por conta própria e não passam
 * pela pilha. Mas ele só conta como "fechei alguma coisa" se houver mesmo um
 * diálogo na tela — e é por isso que a checagem do DOM ficou depois, e não antes.
 */
function fecharCamadaAberta(): boolean {
  if (typeof document === "undefined") return false;

  // 1) Pilha explícita — determinística.
  if (fecharTopo()) return true;

  // 2) Overlays que tratam Escape sozinhos (DrawerShell e afins).
  const aberto = document.querySelector(
    '[role="dialog"], [aria-modal="true"], [data-native-back="close"]',
  );
  if (!aberto) return false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return true;
}

/**
 * Há um treino em andamento nesta tela?
 *
 * Durante a execução o back não pode simplesmente sair: o rascunho sobrevive,
 * mas a pessoa perde o cronômetro de descanso, o contexto e — pela leitura dela
 * — "o treino". A tela de sessão marca `data-workout-live` e trata o próprio
 * back oferecendo a saída com progresso salvo.
 */
function temTreinoAoVivo(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector("[data-workout-live]") !== null;
}

export function NativeAppBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    const removers: Array<() => void> = [];

    CapApp.addListener("backButton", ({ canGoBack }) => {
      // 1) Algo aberto por cima? Fecha e para por aqui.
      if (fecharCamadaAberta()) return;

      // 2) Treino em andamento: a própria tela pergunta antes de sair.
      if (temTreinoAoVivo()) {
        window.dispatchEvent(new CustomEvent("s2core:native-back"));
        return;
      }

      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.minimizeApp();
      }
    }).then((handle) => {
      removers.push(() => void handle.remove());
    });

    /**
     * Links que chegam de fora: App Link (https), esquema próprio (widget,
     * Quick Action) e notificação.
     *
     * A tradução é do `deepLinks.ts` (SPEC P2 §11) — antes, o caminho recebido
     * ia direto ao router, o que fazia de qualquer link uma navegação
     * arbitrária dentro da sessão autenticada e não distinguia origem nenhuma.
     */
    CapApp.addListener("appUrlOpen", ({ url }) => {
      const destino = traduzirDeepLink(url);
      // "Quanto o widget é utilizado?" (§71) sem mecanismo de rastreio novo: a
      // origem viaja no próprio link.
      if (destino.origem === "widget") {
        postActivityEvent("widget.workout_started");
      }
      navigate(destino.rota);
    }).then((handle) => {
      removers.push(() => void handle.remove());
    });

    return () => removers.forEach((remove) => remove());
  }, [navigate]);

  return null;
}
