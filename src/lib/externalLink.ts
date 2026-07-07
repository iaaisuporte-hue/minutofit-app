import { Browser } from "@capacitor/browser";
import { isNativeApp } from "./platform";

/**
 * Abre uma URL EXTERNA (YouTube, política de privacidade etc.) sem tirar o
 * usuário do app. No app empacotado usa o navegador do sistema via Capacitor
 * (Custom Tab / SFSafariViewController); na web, nova aba.
 *
 * Uso em anchors: onClick={(e) => handleExternal(e, url)} — só intercepta no
 * nativo, deixando o comportamento web (target=_blank) intacto.
 */
export function openExternalLink(url: string): void {
  if (isNativeApp()) {
    void Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function handleExternal(e: React.MouseEvent, url: string): void {
  if (isNativeApp()) {
    e.preventDefault();
    void Browser.open({ url });
  }
  // Na web: não previne — o <a target="_blank"> abre normalmente.
}
