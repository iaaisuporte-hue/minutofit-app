import { useEffect, useRef, useState } from "react";
import { useLayoutVar } from "../../hooks/useLayoutVar";

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

  const ref = useRef<HTMLDivElement | null>(null);
  // Publica a altura real: top bar, conteúdo, toasts e Modo Treino descem por ela.
  useLayoutVar(ref, "--offline-banner-h", offline);
  useEffect(() => {
    if (!offline) return;
    const root = document.documentElement;
    root.classList.add("is-offline");
    return () => root.classList.remove("is-offline");
  }, [offline]);

  if (!offline) return null;

  return (
    <div
      ref={ref}
      role="status"
      className="offline-banner"
    >
      Sem conexão — o que você registrar agora pode não ser salvo.
    </div>
  );
}
