/** Preferências de cookies (LGPD). Não alterar a chave sem migração — afeta reexibição do banner. */
export const COOKIE_CONSENT_STORAGE_KEY = "corefit_cookie_consent_v1";

export const COOKIE_CONSENT_VERSION = 1 as const;

export type CookieConsentRecord = {
  version: typeof COOKIE_CONSENT_VERSION;
  decidedAt: string;
  /** Sempre true quando há registro — sessão e preferências mínimas da aplicação. */
  essential: true;
  /** Medições agregadas / melhoria de produto — apenas se o titular aceitar. */
  analytics: boolean;
};

export function readCookieConsent(): CookieConsentRecord | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>;
    if (parsed?.version !== COOKIE_CONSENT_VERSION || parsed.essential !== true) return null;
    if (typeof parsed.decidedAt !== "string" || typeof parsed.analytics !== "boolean") return null;
    return {
      version: COOKIE_CONSENT_VERSION,
      decidedAt: parsed.decidedAt,
      essential: true,
      analytics: parsed.analytics,
    };
  } catch {
    return null;
  }
}

export function writeCookieConsent(analytics: boolean): CookieConsentRecord {
  const record: CookieConsentRecord = {
    version: COOKIE_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    essential: true,
    analytics,
  };
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent("corefit:cookie-consent-changed", { detail: record }));
  return record;
}

export function clearCookieConsent(): void {
  localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("corefit:cookie-consent-changed"));
}

/** Para futuros scripts de analytics — só carregar se o titular aceitou. */
export function isAnalyticsConsentGranted(): boolean {
  return readCookieConsent()?.analytics === true;
}
