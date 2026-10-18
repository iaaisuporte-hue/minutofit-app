import { useCallback, useEffect, useState } from "react";
import {
  AI_CONSENT_CHANGED_EVENT,
  fetchAiConsent,
  grantAiConsent,
  revokeAiConsent,
  type AiConsentState,
} from "../../services/aiConsentApi";

type Busy = "grant" | "revoke" | null;

/**
 * Estado do consentimento de IA do usuário logado, compartilhado entre telas via evento.
 *
 * `state` fica `null` até a primeira resposta (e se a leitura falhar): quem usa trata `null`
 * como "não sei" — nunca como "autorizado". O servidor é a fonte de verdade.
 */
export function useAiConsent() {
  const [state, setState] = useState<AiConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await fetchAiConsent());
      setError(null);
    } catch {
      setError("Não foi possível consultar a sua autorização de IA agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<AiConsentState | undefined>).detail;
      if (detail) setState(detail);
      else void refresh();
    };
    window.addEventListener(AI_CONSENT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(AI_CONSENT_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const run = useCallback(async (kind: Exclude<Busy, null>, action: () => Promise<AiConsentState>) => {
    setBusy(kind);
    setError(null);
    try {
      setState(await action());
      return true;
    } catch {
      setError(
        kind === "grant"
          ? "Não foi possível registrar a sua autorização. Tente novamente."
          : "Não foi possível revogar agora. Tente novamente.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const grant = useCallback(() => run("grant", grantAiConsent), [run]);
  const revoke = useCallback(() => run("revoke", revokeAiConsent), [run]);

  return { state, loading, busy, error, granted: state?.granted === true, refresh, grant, revoke };
}
