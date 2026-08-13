import { useEffect, useState } from "react";
import { isNativeApp } from "../../lib/platform";

/**
 * Registra o service worker e avisa quando há uma versão nova esperando.
 *
 * O SW não faz mais `skipWaiting()` sozinho: se fizesse, o cache antigo seria
 * apagado embaixo de uma aba já aberta, que então falharia ao carregar os
 * chunks lazy do bundle anterior (tela branca depois de cada deploy). Em vez
 * disso o SW novo fica em `waiting` e quem decide a hora é o usuário.
 *
 * No app empacotado (Capacitor) não há SW — a atualização vem pela loja.
 */
export function AppUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD || isNativeApp()) return;

    let cancelled = false;

    // Recarrega uma única vez quando o SW novo assume o controle.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;

        // Já havia uma versão nova esperando de uma visita anterior.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `controller` presente = já havia um SW ativo, ou seja, é update e
            // não a primeira instalação (nessa não queremos incomodar ninguém).
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        /* registro best-effort — não bloqueia o app */
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(var(--bottom-nav-h, 64px) + env(safe-area-inset-bottom, 0px) + 12px)",
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "min(420px, calc(100vw - 24px))",
        padding: "10px 12px 10px 16px",
        borderRadius: "var(--radius-card, 12px)",
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-lg)",
        fontSize: "var(--text-sm, 13px)",
        color: "var(--color-text)",
      }}
    >
      <span style={{ flex: 1 }}>Nova versão disponível.</span>
      <button
        type="button"
        onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
        style={{
          minHeight: 44,
          padding: "0 16px",
          borderRadius: 8,
          border: "none",
          background: "var(--action-primary)",
          color: "var(--action-primary-text)",
          fontWeight: 600,
          fontSize: "var(--text-sm, 13px)",
          cursor: "pointer",
        }}
      >
        Atualizar
      </button>
    </div>
  );
}
