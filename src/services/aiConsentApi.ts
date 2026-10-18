import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

/**
 * Consentimento do titular para tratamento de dados por IA de terceiros (Spec 039).
 *
 * É do TITULAR e independe de cookies/analytics (`corefit_cookie_consent_v1`, no navegador) e dos
 * consentimentos por profissional (Minha equipe). O servidor é quem barra a IA sem consentimento —
 * esta camada só informa e coleta a decisão.
 */
export type AiConsentState = {
  /** Vale agora: concedido, na versão vigente da política e não revogado. */
  granted: boolean;
  grantedAt: string | null;
  version: string | null;
  revokedAt: string | null;
  currentVersion: string;
  /** Houve aceite, mas de uma versão antiga da política — pede novo aceite. */
  needsReconsent: boolean;
};

/** Emitido a cada concessão/revogação, para que as telas já abertas se atualizem juntas. */
export const AI_CONSENT_CHANGED_EVENT = "corefit:ai-consent-changed";

/** Política de IA publicada no site institucional (não existe página equivalente no SPA). */
export const AI_POLICY_URL = "https://s2core.com.br/politica-ia";

async function request(method: "GET" | "POST" | "DELETE"): Promise<AiConsentState> {
  const res = await authFetch(`${API_URL}/user/ai-consent`, {
    method,
    ...(method === "POST"
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted: true }) }
      : {}),
  });
  const payload = await parseJson(res);
  if (!res.ok || !payload?.data) throw new Error(payload?.error || "ai_consent_failed");
  return payload.data as AiConsentState;
}

export const fetchAiConsent = () => request("GET");

export async function grantAiConsent(): Promise<AiConsentState> {
  const state = await request("POST");
  window.dispatchEvent(new CustomEvent(AI_CONSENT_CHANGED_EVENT, { detail: state }));
  return state;
}

export async function revokeAiConsent(): Promise<AiConsentState> {
  const state = await request("DELETE");
  window.dispatchEvent(new CustomEvent(AI_CONSENT_CHANGED_EVENT, { detail: state }));
  return state;
}
