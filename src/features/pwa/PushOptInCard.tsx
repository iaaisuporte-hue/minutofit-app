import { useState } from "react";
import { Bell } from "lucide-react";
import { enablePushNotifications, isPushSupported } from "../nutrition/usePushSubscription";

const DISMISS_KEY = "corefit:push:optin-dismissed";

/**
 * Priming da permissão de notificação: explica o para quê ANTES de abrir o
 * prompt do sistema. Só aparece quando a permissão ainda está em `default` —
 * quem já decidiu (concedeu ou negou) não é incomodado.
 */
export function PushOptInCard() {
  const [hidden, setHidden] = useState(() => {
    if (!isPushSupported()) return true;
    if (Notification.permission !== "default") return true;
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* modo privado — some só nesta sessão */
    }
    setHidden(true);
  }

  async function enable() {
    setBusy(true);
    await enablePushNotifications();
    // Concedida ou negada, a decisão foi tomada: o card sai do caminho.
    setHidden(true);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--radius-card, 12px)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-raised)",
        marginBottom: "var(--space-3, 12px)",
      }}
    >
      <Bell size={18} style={{ flexShrink: 0, color: "var(--color-primary)" }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm, 13px)", fontWeight: 600, color: "var(--color-text)" }}>
          Lembretes do seu dia
        </div>
        <div style={{ fontSize: "var(--text-xs, 12px)", color: "var(--color-text-muted)", lineHeight: 1.45 }}>
          Avisamos na hora do check-in e das refeições do seu plano. Nada de propaganda.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={dismiss}
          style={{
            minHeight: 44,
            padding: "0 10px",
            border: "none",
            background: "none",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-xs, 12px)",
            cursor: "pointer",
          }}
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          style={{
            minHeight: 44,
            padding: "0 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--action-primary)",
            color: "var(--action-primary-text)",
            fontSize: "var(--text-xs, 12px)",
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "…" : "Ativar"}
        </button>
      </div>
    </div>
  );
}
