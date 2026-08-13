import { useEffect, useState } from "react";

/**
 * Avisa que o aparelho está sem rede.
 *
 * Sem isso, o aluno na academia com sinal ruim via só o erro genérico do
 * ErrorBoundary ("Algo saiu do esperado") ao tentar registrar um treino — sem
 * pista de que o problema era conexão, e sem saber que valia tentar de novo.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine === false : false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 950,
        padding: "calc(env(safe-area-inset-top, 0px) + 6px) 12px 6px",
        textAlign: "center",
        background: "var(--color-warn-soft, #FEF3C7)",
        color: "var(--color-warn-text, #92400E)",
        fontSize: "var(--text-xs, 12px)",
        fontWeight: 600,
      }}
    >
      Sem conexão — o que você registrar agora pode não ser salvo.
    </div>
  );
}
