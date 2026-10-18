import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AI_POLICY_URL } from "../../services/aiConsentApi";
import { handleExternal } from "../../lib/externalLink";
import { useAiConsent } from "./useAiConsent";

const DISMISSED_KEY = "corefit:ai-consent:dismissed-at";
/** "Agora não" some com o convite por este tempo; a gestão em Privacidade continua sempre disponível. */
const DISMISS_DAYS = 30;

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

type Props = {
  /** O que sai, em linguagem do usuário: "o seu score metabólico e os fatores do dia". */
  finalidade: string;
  /** `false` quando o recurso NÃO funciona sem a autorização (ex.: gerar ficha) — não oferece "Agora não". */
  dismissible?: boolean;
  onGranted?: () => void;
};

/**
 * Convite inline para autorizar o tratamento por IA de terceiros (Spec 039; Apple 5.1.2(i)).
 *
 * Aparece NO lugar do recurso, no primeiro contato — não é um modal por chamada. Nada vem marcado,
 * "Autorizar" e "Agora não" têm o mesmo peso visual, e recusar não tira nenhuma função do app: só a
 * leitura/resumo por IA. Some sozinho quando já há autorização válida.
 */
export function AiConsentCard({ finalidade, dismissible = true, onGranted }: Props) {
  const { state, loading, busy, error, granted, grant } = useAiConsent();
  const [dismissed, setDismissed] = useState(() => dismissible && wasDismissedRecently());

  // Enquanto não se sabe (ou se a leitura falhou) não se insiste nem se presume nada.
  if (loading || state == null || granted || dismissed) return null;

  async function authorize() {
    if (await grant()) onGranted?.();
  }

  function notNow() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* sem storage: some só nesta sessão */
    }
    setDismissed(true);
  }

  return (
    <section
      aria-label="Autorização de IA"
      style={{
        display: "grid",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-subtle, var(--color-surface))",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--color-text)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
        <Sparkles size={15} aria-hidden="true" />
        {state.needsReconsent ? "Atualizamos a Política de IA" : "Usar inteligência artificial com os seus dados?"}
      </div>
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
        Este recurso usa IA de um provedor externo (OpenAI). Para gerá-lo, enviamos {finalidade}, sempre pelo
        nosso servidor e sem o seu nome, e-mail, telefone ou CPF. É opcional: sem isso o app funciona
        normalmente. Você pode mudar de ideia quando quiser, em Privacidade no seu perfil.{" "}
        <a
          href={AI_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleExternal(e, AI_POLICY_URL)}
        >
          Política de IA
        </a>
        .
      </p>
      {error && (
        <div role="alert" style={{ color: "var(--color-danger)", fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {dismissible && (
          <button type="button" className="btn btn-ghost" disabled={busy != null} onClick={notNow} style={{ minHeight: 44 }}>
            Agora não
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={busy != null} onClick={authorize} style={{ minHeight: 44 }}>
          {busy === "grant" ? "Registrando…" : "Autorizar"}
        </button>
      </div>
    </section>
  );
}
