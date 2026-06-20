import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * Faixa discreta de "Instalar o app".
 * - Android/Chrome: usa o evento beforeinstallprompt → botão nativo de instalar.
 * - iOS Safari: sem beforeinstallprompt → mostra a dica "Compartilhar → Adicionar à Tela de Início".
 * Some quando já instalado (standalone) ou já dispensado (localStorage).
 */

const DISMISS_KEY = "metacore:pwa:install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window as any).MSStream;
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  // Safari no iOS (exclui Chrome/Firefox iOS, que não suportam "Adicionar à Tela de Início" pelo share)
  return isIos() && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

function initialMode(): "hidden" | "ios" {
  if (isStandalone()) return "hidden";
  try {
    if (localStorage.getItem(DISMISS_KEY)) return "hidden";
  } catch {
    /* ignore */
  }
  // iOS não dispara beforeinstallprompt — mostra a dica manual já no primeiro render.
  return isIosSafari() ? "ios" : "hidden";
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">(initialMode);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }

    // Android/Chrome: o evento pode chegar após o mount → eleva para "android".
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setMode("hidden");
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

  if (mode === "hidden") return null;

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
          color: "var(--color-primary, #1DB954)",
          flexShrink: 0,
        }}
      >
        {mode === "ios" ? <Share size={18} /> : <Download size={18} />}
      </div>

      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
        {mode === "android" ? (
          <>
            <b>Instale o MetaCore</b> na tela inicial — acesso rápido e lembretes de check-in.
          </>
        ) : (
          <>
            <b>Adicione à tela inicial:</b> toque em{" "}
            <Share size={13} style={{ verticalAlign: "-2px" }} aria-label="Compartilhar" /> e depois
            em <b>"Adicionar à Tela de Início"</b>.
          </>
        )}
      </div>

      {mode === "android" && (
        <button
          type="button"
          onClick={install}
          style={{
            flexShrink: 0,
            padding: "7px 14px",
            borderRadius: 8,
            background: "var(--color-primary, #1DB954)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Instalar
        </button>
      )}

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
