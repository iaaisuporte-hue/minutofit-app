import { getPlatform, isNativeApp } from "./platform";

/**
 * Impede o zoom automático do iOS ao focar um campo — só no app iOS.
 *
 * O WebKit amplia a página quando o campo focado tem fonte < 16px, e boa
 * parte dos nossos tem 14px (`.input`, chat, refeição, série). No Safari isso
 * é só incômodo; no app é pior: o Capacitor desliga o gesto de pinça do
 * WKWebView (`WebViewDelegationHandler.swift`, `zoomingEnabled` = false), então
 * o zoom fica PRESO — o usuário não tem como voltar.
 *
 * `maximum-scale=1` desliga só esse zoom automático. Não tira acessibilidade de
 * ninguém: no app o pinça já não existe; na web e no Android o viewport fica
 * como está (lá `maximum-scale` bloquearia o pinça de verdade, e não é
 * aplicado). O tamanho de fonte dos campos não muda — identidade visual intacta.
 */
export function applyNativeIosViewport(doc: Document = document): boolean {
  if (!isNativeApp() || getPlatform() !== "ios") return false;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return false;
  const partes = meta.content
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^maximum-scale\s*=/.test(p));
  partes.push("maximum-scale=1");
  meta.content = partes.join(", ");
  return true;
}
