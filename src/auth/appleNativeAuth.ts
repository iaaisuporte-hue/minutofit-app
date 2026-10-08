import { SocialLogin } from "@capgo/capacitor-social-login";
import { ensureSocialLoginInitialized } from "./socialLoginNative";

/**
 * Login com Apple dentro do app empacotado (Capacitor).
 *
 * Espelha `googleNativeAuth.ts`: abre o fluxo nativo do sistema e devolve o
 * `identityToken`, que o backend já valida em
 * `POST /auth/oauth/apple/callback` — nenhuma rota nova.
 *
 * ## Nome e e-mail só vêm UMA vez
 *
 * A Apple entrega `givenName`/`familyName`/`email` apenas na PRIMEIRA
 * autorização daquele Apple ID para este app. Nas seguintes o payload vem só
 * com o identificador. Por isso o retorno carrega o perfil junto do token: quem
 * chama repassa ao backend na mesma requisição, que é a única chance de
 * gravá-lo. Com "Ocultar meu e-mail" o endereço é o relay `@privaterelay.
 * appleid.com` — endereço legítimo e o único que teremos.
 */

export interface AppleNativeCredential {
  identityToken: string;
  name?: string;
  email?: string;
}

/**
 * Abre o Sign in with Apple do sistema.
 *
 * `null` quando o usuário cancela — o chamador deve tratar como "não logou",
 * nunca como erro.
 */
export async function signInWithAppleNative(): Promise<AppleNativeCredential | null> {
  await ensureSocialLoginInitialized();

  const result = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["name", "email"] },
  });

  const payload = result.result as {
    idToken?: string | null;
    profile?: { email?: string | null; givenName?: string | null; familyName?: string | null };
  };

  if (!payload?.idToken) return null;

  const nome = [payload.profile?.givenName, payload.profile?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    identityToken: payload.idToken,
    name: nome || undefined,
    email: payload.profile?.email ?? undefined,
  };
}
