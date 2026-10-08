import { SocialLogin } from "@capgo/capacitor-social-login";

/**
 * Inicialização única do `@capgo/capacitor-social-login`.
 *
 * Google e Apple compartilham o MESMO `initialize`: o plugin registra os
 * provedores a partir do objeto recebido, então duas chamadas separadas — uma
 * por provedor — fariam a segunda apagar o registro da primeira. Daí este
 * módulo existir em vez de cada `*NativeAuth.ts` inicializar o seu.
 *
 * PRÉ-REQUISITOS DE CONFIGURAÇÃO (nenhum deles é código):
 * - Android/Google: client OAuth do tipo **Android** no Google Cloud Console,
 *   com package `com.s2core.app` e a SHA-1 do certificado de assinatura.
 * - iOS/Google: client OAuth do tipo **iOS** (`VITE_GOOGLE_IOS_CLIENT_ID`) e o
 *   esquema reverso correspondente em `CFBundleURLTypes` do `Info.plist`.
 * - iOS/Apple: capability "Sign in with Apple" no App ID.
 * Sem eles o login falha em runtime mesmo com o código correto.
 */

const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined;
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;

let initialized: Promise<void> | null = null;

export function ensureSocialLoginInitialized(): Promise<void> {
  if (!initialized) {
    initialized = SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
      },
      apple: {
        clientId: APPLE_CLIENT_ID,
        // No iOS o fluxo é nativo (ASAuthorization) e não redireciona; a doc do
        // plugin manda usar string vazia justamente para desligar o redirect.
        redirectUrl: "",
      },
    });
  }
  return initialized;
}
