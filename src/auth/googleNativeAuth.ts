import { SocialLogin } from "@capgo/capacitor-social-login";
import { ensureSocialLoginInitialized } from "./socialLoginNative";

/**
 * Login com Google dentro do app empacotado (Capacitor).
 *
 * O botão do Google Identity Services não funciona aqui: o Google **bloqueia**
 * OAuth em WebView embarcada por política de segurança, então no APK o usuário
 * ficava só com e-mail e senha. Este caminho usa a conta já logada no aparelho
 * (Credential Manager no Android, Google Sign-In no iOS) e devolve o mesmo
 * `idToken` que o backend já valida em `POST /auth/oauth/google/callback` —
 * nenhuma rota nova.
 *
 * A configuração dos client IDs (web, Android, iOS) e os pré-requisitos de
 * portal estão em `socialLoginNative.ts`, compartilhados com o Apple.
 */

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function isGoogleNativeConfigured(): boolean {
  return Boolean(WEB_CLIENT_ID);
}

/**
 * Abre o seletor de conta do sistema e devolve o ID token do Google.
 * `null` quando o usuário desiste ou o provedor não está configurado no
 * aparelho — o chamador deve tratar como "não logou", não como erro.
 */
export async function signInWithGoogleNative(): Promise<string | null> {
  if (!WEB_CLIENT_ID) return null;

  await ensureSocialLoginInitialized();
  // SEM `scopes` aqui de propósito: o provider Android do plugin já adiciona
  // email/profile/openid como padrão internamente (GoogleProvider.java). Passar
  // um array de scopes — mesmo pedindo exatamente os mesmos — força o plugin a
  // exigir que a Activity implemente `ModifiedMainActivityForSocialLoginPlugin`
  // (fluxo de autorização estendida, para APIs além de login), e rejeita com
  // "You CANNOT use scopes without modifying the main activity" sem isso. Não
  // precisamos de autorização estendida — só da identidade (ID token) — então
  // omitir o campo usa o caminho padrão, sem tocar em MainActivity.
  const result = await SocialLogin.login({
    provider: "google",
    options: {},
  });

  // O modo online devolve idToken; offline devolve só o authorization code, que
  // este fluxo não usa (o backend valida ID token).
  const payload = result.result as { idToken?: string | null };
  return payload?.idToken ?? null;
}
