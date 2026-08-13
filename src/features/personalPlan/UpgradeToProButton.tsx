import { useState } from "react";
import { startPersonalCheckout } from "../../services/personalPlanApi";
import { isNativeApp } from "../../lib/platform";

interface Props {
  /** Estilo: botão sólido (CTA) ou link inline (banner). */
  variant?: "solid" | "link";
  label?: string;
  plan?: "pro" | "starter";
}

/**
 * Dispara o checkout self-serve do plano pago e redireciona ao Mercado Pago.
 * Substitui o antigo mailto de upgrade manual.
 */
export function UpgradeToProButton({ variant = "solid", label = "Assinar Pro", plan = "pro" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // App empacotado (Capacitor): nenhum caminho de compra, preço ou link externo.
  // Bem digital consumido no app exige o billing da loja (Play Billing / Apple 3.1.1);
  // levar o usuário ao Mercado Pago daqui é motivo de reprovação.
  if (isNativeApp()) {
    return (
      <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        Gerencie seu plano na versão web do S2Core.
      </span>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const initPoint = await startPersonalCheckout(plan);
      window.location.href = initPoint;
    } catch (e: any) {
      setError(e?.message || "Falha ao iniciar pagamento");
      setLoading(false);
    }
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: 12,
          fontWeight: 600,
          color: "inherit",
          textDecoration: "underline",
          whiteSpace: "nowrap",
          flexShrink: 0,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Abrindo…" : error ? "Tentar de novo" : label}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          alignSelf: "center",
          padding: "8px 18px",
          borderRadius: 8,
          background: "rgb(99,102,241)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Abrindo pagamento…" : label}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: "var(--color-danger, #dc2626)" }}>{error}</span>
      )}
    </div>
  );
}
