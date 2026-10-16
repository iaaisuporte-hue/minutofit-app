import * as Sentry from "@sentry/react";
import { getPlatform, isNativeApp } from "../lib/platform";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL =
  configuredApiUrl ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : `${window.location.origin}/api`);

export const SESSION_EXPIRED_EVENT = "corefit:session-expired";

/**
 * No app empacotado o fallback por origem não existe: a WebView serve os assets
 * de `capacitor://localhost` (iOS) ou `https://localhost` (Android), então
 * `${origin}/api` aponta para um host que não é o backend e TODA chamada falha —
 * o app abre, o login não responde e nada na tela explica por quê.
 *
 * `VITE_API_URL` é resolvida em tempo de build; se faltou, não há como corrigir
 * em runtime. O que dá para fazer é falhar de forma visível (console + Sentry)
 * em vez de silenciosamente, que é o que acontecia antes. Na web o fallback
 * continua legítimo (app e API no mesmo host) e nada é reportado.
 */
export function reportMissingNativeApiUrl(): boolean {
  if (configuredApiUrl || !isNativeApp()) return false;

  const platform = getPlatform();
  const message =
    `[apiBase] VITE_API_URL não definida no build do app nativo (${platform}). ` +
    `As chamadas estão indo para ${API_URL}, que não é o backend — nenhuma vai responder. ` +
    "Refaça o build do app com VITE_API_URL apontando para a API.";

  console.error(message);
  Sentry.captureMessage("api_base.missing_url.native", {
    level: "error",
    tags: { platform },
    extra: { resolvedApiUrl: API_URL },
  });
  return true;
}

reportMissingNativeApiUrl();

export function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
