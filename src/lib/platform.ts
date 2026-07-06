import { Capacitor } from "@capacitor/core";

/**
 * Detecção de plataforma para gates de UI/comportamento.
 *
 * `isNativeApp()` = rodando dentro do app empacotado (Capacitor iOS/Android).
 * Usado para: ocultar fluxos de pagamento (política das lojas), não registrar
 * o service worker / InstallPrompt (redundantes no WebView), e futuramente
 * escolher push nativo vs web push. Na web/PWA retorna false.
 *
 * Envolto em try/catch porque em SSR/testes o global do Capacitor pode não existir.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export type Platform = "ios" | "android" | "web";

export function getPlatform(): Platform {
  try {
    return Capacitor.getPlatform() as Platform;
  } catch {
    return "web";
  }
}
