import * as Sentry from "@sentry/react";
import { COOKIE_CONSENT_CHANGED_EVENT, isAnalyticsConsentGranted } from "./cookieConsent";

/**
 * Sentry só sobe com consentimento de analytics.
 *
 * Antes o `Sentry.init` rodava sempre que a DSN existisse — a função
 * `isAnalyticsConsentGranted()` estava escrita e não tinha consumidor nenhum.
 * Na prática, quem recusava medição no banner continuava enviando evento de
 * erro (com URL, user agent e breadcrumbs) para um processador terceiro: recusa
 * registrada e ignorada, que é o pior dos dois mundos para LGPD e para a
 * guideline 5.1.2 da Apple.
 *
 * O consentimento é decidido DEPOIS do boot (o banner aparece com o app já na
 * tela), então não basta checar uma vez: a função também escuta a mudança e
 * liga o Sentry no mesmo instante em que o titular aceita, sem exigir reload.
 * Na revogação o cliente é fechado — o que já foi enviado não volta, mas nada
 * novo sai.
 *
 * Vale igual para web e app empacotado.
 *
 * Devolve o descadastro do listener. O app chama uma vez e ignora; quem usa é
 * o teste, que monta e desmonta o gate várias vezes na mesma janela.
 */
export function setupSentryConsentGate(): () => void {
  aplicar();
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, aplicar);
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, aplicar);
}

let ativo = false;

function aplicar(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const consentido = isAnalyticsConsentGranted();

  if (consentido && !ativo) {
    ativo = true;
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
    return;
  }

  if (!consentido && ativo) {
    ativo = false;
    void Sentry.close();
  }
}
