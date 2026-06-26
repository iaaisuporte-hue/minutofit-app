import { useState } from "react";
import { startAcademyCheckout } from "../../services/academyApi";

/** Botão que inicia o checkout do Pro e redireciona para o Mercado Pago. */
export function AcademyUpgradeButton({
  label = "Assinar o Pro",
  variant = "solid",
}: {
  label?: string;
  variant?: "solid" | "link";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const initPoint = await startAcademyCheckout();
      window.location.href = initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout indisponível no momento");
      setLoading(false);
    }
  }

  if (variant === "link") {
    return (
      <button type="button" className="btn-link" onClick={handleClick} disabled={loading}>
        {loading ? "Abrindo checkout…" : label}
        {error && <span style={{ display: "block", fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
      </button>
    );
  }

  return (
    <div>
      <button type="button" className="btn btn-primary" onClick={handleClick} disabled={loading}>
        {loading ? "Abrindo checkout…" : label}
      </button>
      {error && <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}
    </div>
  );
}
