import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "./platform";

/**
 * Ponte de comportamento nativo (Capacitor). Só ativa no app empacotado.
 * - Botão voltar do Android: volta na navegação se houver histórico; na raiz,
 *   minimiza o app (em vez de fechar). Sem isso, o back fecha o app na 1ª tela.
 * - App Links: link de convite aberto fora do app (WhatsApp) entra no router.
 *
 * Renderiza null — é só efeito colateral. Montar uma vez (perto da raiz).
 */
export function NativeAppBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    const removers: Array<() => void> = [];

    CapApp.addListener("backButton", ({ canGoBack }) => {
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
