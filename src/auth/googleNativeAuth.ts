import { SocialLogin } from "@capgo/capacitor-social-login";

/**
 * Login com Google dentro do app empacotado (Capacitor).
 *
 * O botão do Google Identity Services não funciona aqui: o Google **bloqueia**
 * OAuth em WebView embarcada por política de segurança, então no APK o usuário
 * ficava só com e-mail e senha. Este caminho usa a conta já logada no aparelho
 * (Credential Manager no Android) e devolve o mesmo `idToken` que o backend já
 * valida em `POST /auth/oauth/google/callback` — nenhuma rota nova.
 *
 * PRÉ-REQUISITO DE CONFIGURAÇÃO: além do `VITE_GOOGLE_CLIENT_ID` (client web),
 * o Google Cloud Console precisa de um **client OAuth do tipo Android** com o
 * package `com.s2core.app` e a impressão SHA-1 do certificado de assinatura.
 * Sem ele o login falha em runtime com DEVELOPER_ERROR, mesmo com o código
 * correto. Ver o runbook de publicação.
 */

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

let initialized: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initialized) {
    initialized = SocialLogin.initialize({
      google: { webClientId: WEB_CLIENT_ID },
    });
  }
  return initialized;
}

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

  await ensureInitialized();
  const result = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"] },
  });

  // O modo online devolve idToken; offline devolve só o authorization code, que
  // este fluxo não usa (o backend valida ID token).
  const payload = result.result as { idToken?: string | null };
  return payload?.idToken ?? null;
}
