import { useEffect } from "react";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "./platform";

/**
 * Ponte de comportamento nativo (Capacitor). Só ativa no app empacotado.
 * - Botão voltar do Android: volta na navegação se houver histórico; na raiz,
 *   minimiza o app (em vez de fechar). Sem isso, o back fecha o app na 1ª tela.
 *
 * Renderiza null — é só efeito colateral. Montar uma vez (perto da raiz).
 */
export function NativeAppBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.minimizeApp();
      }
    }).then((handle) => {
      remove = () => void handle.remove();
    });
    return () => remove?.();
  }, []);

  return null;
}
