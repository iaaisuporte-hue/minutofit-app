import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "./platform";

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
 * aberto: `canGoBack` continua true, então a versão anterior NAVEGAVA para trás
 * com o diálogo na tela — o modal ficava órfão ou a pessoa saía da tela sem
 * fechar o que abriu (SPEC §32). A ordem aqui é a de empilhamento: primeiro o
 * que está por cima.
 *
 * Emitimos `Escape`, que é o contrato que os diálogos do app já escutam
 * (`ConfirmDialog`, sheets, seletores) — não é preciso registrar cada um.
 * Retorna true quando havia algo para fechar.
 */
function fecharCamadaAberta(): boolean {
  if (typeof document === "undefined") return false;
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

    // O WebView carrega de https://localhost, então só aproveitamos o caminho da
    // URL recebida — o host original (app.s2core.com.br) não serve para navegar.
    CapApp.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        navigate(`${parsed.pathname}${parsed.search}`);
      } catch {
        /* URL fora do formato esperado — ignora e mantém a tela atual */
      }
    }).then((handle) => {
      removers.push(() => void handle.remove());
    });

    return () => removers.forEach((remove) => remove());
  }, [navigate]);

  return null;
}
