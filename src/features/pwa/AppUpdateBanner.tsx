import { useEffect } from "react";
import { isNativeApp } from "../../lib/platform";

/**
 * Registra o service worker. Não renderiza nada.
 *
 * O SW não faz `skipWaiting()` sozinho: se fizesse, o cache antigo seria
 * apagado embaixo de uma aba já aberta, que então falharia ao carregar os
 * chunks lazy do bundle anterior (tela branca depois de cada deploy). Sem o
 * aviso na tela, a versão nova fica em `waiting` e entra quando todas as abas
 * do app forem fechadas — comportamento padrão de PWA.
 *
 * No app empacotado (Capacitor) não há SW — a atualização vem pela loja.
 */
export function AppUpdateBanner() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD || isNativeApp()) return;

    // Recarrega uma única vez quando um SW novo assume o controle.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* registro best-effort — não bloqueia o app */
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
