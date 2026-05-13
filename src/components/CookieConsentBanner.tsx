import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  readCookieConsent,
  writeCookieConsent,
} from "../lib/cookieConsent";
import "../styles/cookieConsent.css";

/**
 * Banner LGPD: informa cookies essenciais e oferece opção explícita para cookies de medição.
 * Preferências em `localStorage` (chave em `cookieConsent.ts`).
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const sync = useCallback(() => {
    setVisible(readCookieConsent() === null);
  }, []);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    window.addEventListener("metacore:cookie-consent-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("metacore:cookie-consent-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [sync]);

  if (!visible) return null;

  function save(nextAnalytics: boolean) {
    writeCookieConsent(nextAnalytics);
    setVisible(false);
    setAnalytics(false);
  }

  return (
    <div
      className="cookie-consent"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="cookie-consent__inner">
        <div className="cookie-consent__text">
          <h2 id="cookie-consent-title" className="cookie-consent__title">
            Cookies e privacidade (LGPD)
          </h2>
          <p id="cookie-consent-desc" className="cookie-consent__desc">
            Usamos cookies e armazenamento local estritamente necessários para autenticação, segurança e preferências
            (ex.: modo de cores). Opcionalmente, com o seu consentimento, podemos usar medições agregadas para melhorar
            o produto. Você pode alterar a escolha a qualquer momento na página de{" "}
            <Link to="/privacidade" className="cookie-consent__link">
              Privacidade
            </Link>
            .
          </p>
          <label className="cookie-consent__check">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
            />
            <span>Aceitar cookies opcionais de medição de audiência (dados agregados)</span>
          </label>
          <p className="cookie-consent__meta">
            A decisão fica registrada apenas neste dispositivo (armazenamento local), sem envio automático desta escolha
            para o servidor.
          </p>
        </div>
        <div className="cookie-consent__actions">
          <button type="button" className="cookie-consent__btn cookie-consent__btn--secondary" onClick={() => save(false)}>
            Recusar opcionais
          </button>
          <button type="button" className="cookie-consent__btn cookie-consent__btn--primary" onClick={() => save(analytics)}>
            Salvar preferências
          </button>
        </div>
      </div>
    </div>
  );
}
