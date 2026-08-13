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

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

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

// O registro do service worker vive em features/pwa/AppUpdateBanner (montado no
// App): registrar e detectar atualização são o mesmo fluxo, e separá-los deixava
// o app sem aviso de versão nova.