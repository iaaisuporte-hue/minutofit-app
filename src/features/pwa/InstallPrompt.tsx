import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isNativeApp } from "../../lib/platform";

/**
 * Faixa de "Instalar o app" — APENAS Android/Chrome, onde o evento
 * beforeinstallprompt permite o diálogo nativo de instalação (1 toque real).
 *
 * iOS foi removido de propósito: o Safari não permite instalação por código
 * (só manual via barra do Safari), então qualquer dica ali passa mensagem
 * enganosa ao usuário. Instalação no iOS fica para o app nativo futuro.
 *
 * Some quando já instalado (standalone) ou já dispensado (localStorage).
 */

const DISMISS_KEY = "corefit:pwa:install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // No app empacotado (Capacitor) não existe instalação de PWA — banner inerte.
    if (isNativeApp()) return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }

    // Android/Chrome: o evento chega quando a instalação está disponível.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    dismiss();
  }

  // Só renderiza quando há um prompt real disponível (Android/Chrome).
  if (!deferred) return null;

  return (
    <div
      role="region"
      aria-label="Instalar o app"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        fontSize: 13,
        color: "var(--color-text)",
      }}
    >
      <div
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 9,
          background: "rgba(29,185,84,0.1)",
          color: "var(--color-primary, #7B9919)",
          flexShrink: 0,
        }}
      >
        <Download size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
        <b>Instale o S2Core</b> na tela inicial — acesso rápido e lembretes de check-in.
      </div>

      <button
        type="button"
        onClick={install}
        style={{
          flexShrink: 0,
          padding: "7px 14px",
          borderRadius: 8,
          background: "var(--action-primary, #5E7412)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Instalar
      </button>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          padding: 4,
          cursor: "pointer",
          color: "var(--color-text-muted)",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
