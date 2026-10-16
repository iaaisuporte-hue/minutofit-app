import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import App from "./App";
// S2CORE type system: Manrope (interface) + Exo 2 (marca/score/display)
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/exo-2/500.css";
import "@fontsource/exo-2/600.css";
import "@fontsource/exo-2/700.css";
import "./styles/globals.css";
import "./styles/components.css";
import { setupSentryConsentGate } from "./lib/sentryConsent";
import { hydrateTokenStorage } from "./lib/tokenStorage";
import { isNativeApp } from "./lib/platform";
import { applyNativeIosViewport } from "./lib/nativeViewport";

setupSentryConsentGate();
applyNativeIosViewport();

function montar() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <Sentry.ErrorBoundary
          fallback={
            <div style={{ padding: 24, fontFamily: "Inter, sans-serif", textAlign: "center", maxWidth: 420, margin: "64px auto" }}>
              <h2 style={{ marginBottom: 8 }}>Algo saiu do esperado</h2>
              <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>Recarregue a página para continuar — já fomos avisados.</p>
              <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--color-border)", cursor: "pointer", fontWeight: 600 }}>
                Recarregar
              </button>
            </div>
          }
        >
          <App />
        </Sentry.ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// No app empacotado a sessão vem de um storage nativo assíncrono, e o
// `AuthProvider` lê o token de forma síncrona já no primeiro render — montar
// antes da hidratação mandaria para o login quem tem sessão válida. Na web a
// leitura é síncrona (`localStorage`), então nada muda: monta na hora.
if (isNativeApp()) {
  void hydrateTokenStorage().then(montar, montar);
} else {
  montar();
}

// O registro do service worker vive em features/pwa/AppUpdateBanner (montado no
// App): registrar e detectar atualização são o mesmo fluxo, e separá-los deixava
// o app sem aviso de versão nova.