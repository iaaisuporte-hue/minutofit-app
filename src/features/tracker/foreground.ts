import { App } from "@capacitor/app";
import { isNativeApp } from "../../lib/platform";

/**
 * "O app voltou para o primeiro plano."
 *
 * Duas fontes, porque nenhuma sozinha cobre os dois mundos:
 *
 *  - `visibilitychange` é o sinal do navegador. Chega no PWA, no desktop e
 *    também no WebView — mas em WebView ele nem sempre dispara quando a tela é
 *    apagada e reacesa sem trocar de app.
 *  - `appStateChange` do `@capacitor/app` é o sinal do sistema operacional, e
 *    é o que realmente marca `onResume` no Android. Só existe no empacotado.
 *
 * As duas juntas disparam em duplicidade no app instalado, então o `janelaMs`
 * colapsa avisos próximos: reconciliar duas vezes seguidas não quebraria nada,
 * mas gastaria trabalho à toa a cada retomada.
 *
 * Por que isso importa aqui: com o WebView suspenso o JavaScript PARA. Nenhum
 * `setInterval` corre, nenhum callback de GPS chega. Quando volta, o estado da
 * tela está velho — e é neste instante, e só nele, que dá para reconciliá-lo
 * com o que de fato aconteceu.
 */
export function aoVoltarAoPrimeiroPlano(cb: () => void, janelaMs = 400): () => void {
  let ultimo = 0;
  const disparar = () => {
    const agora = Date.now();
    if (agora - ultimo < janelaMs) return;
    ultimo = agora;
    cb();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") disparar();
  };
  document.addEventListener("visibilitychange", onVisibility);

  let removerNativo: (() => void) | null = null;
  if (isNativeApp()) {
    // `addListener` é assíncrono no Capacitor 7: a remoção pode chegar antes do
    // handle, e sem esta guarda um desmonte rápido deixaria o ouvinte vivo.
    let cancelado = false;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) disparar();
    }).then((h) => {
      if (cancelado) void h.remove();
      else removerNativo = () => void h.remove();
    });
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", onVisibility);
      removerNativo?.();
    };
  }

  return () => document.removeEventListener("visibilitychange", onVisibility);
}
