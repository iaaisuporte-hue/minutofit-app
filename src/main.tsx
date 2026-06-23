import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import App from "./App";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
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
            <p style={{ color: "#6B7280", marginBottom: 16 }}>Recarregue a página para continuar — já fomos avisados.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #D1D5DB", cursor: "pointer", fontWeight: 600 }}>
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

// PWA — registra o service worker no boot (instalável + offline shell),
// independente do push. O fluxo de push (usePushSubscription) reusa o mesmo SW.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* registro best-effort — não bloqueia o app */
    });
  });
}