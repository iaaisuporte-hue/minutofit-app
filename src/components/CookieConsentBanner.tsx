import { useCallback, useEffect, useRef, useState } from "react";
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
  const innerRef = useRef<HTMLDivElement | null>(null);

  const sync = useCallback(() => {
    setVisible(readCookieConsent() === null);
  }, []);

  // Reserva, no fim da página, a altura que o banner ocupa. Sem isso, em telas
  // baixas (≤360x740) o banner cobria o botão "Entrar" do login — 308px de
  // sobreposição a 320x568 — e, como a página não tinha o que rolar, o usuário
  // tocava num botão visível e nada acontecia, sem nenhuma pista do porquê
  // (QA mobile 02/ago/2026). Com o espaço reservado a página passa a rolar e a
  // ação sai de baixo do banner.
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.classList.remove("has-cookie-consent");
      root.style.removeProperty("--cookie-consent-h");
      return;
    }
    root.classList.add("has-cookie-consent");
    const el = innerRef.current;
    const medir = () => {
      const h = el?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--cookie-consent-h", `${Math.ceil(h) + 24}px`);
    };
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", medir);
      root.classList.remove("has-cookie-consent");
      root.style.removeProperty("--cookie-consent-h");
    };
  }, [visible]);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    window.addEventListener("corefit:cookie-consent-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("corefit:cookie-consent-changed", onChange);
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
      <div className="cookie-consent__inner" ref={innerRef}>
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
