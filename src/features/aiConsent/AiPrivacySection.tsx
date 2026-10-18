import { COLORS } from "../../styles/colors";
import { AI_POLICY_URL } from "../../services/aiConsentApi";
import { handleExternal } from "../../lib/externalLink";
import { useAiConsent } from "./useAiConsent";

type Props = {
  /** Muda só o que é dito sobre o que sai: o aluno autoriza dados dele; o profissional, o texto do pedido. */
  audience: "aluno" | "profissional";
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

/**
 * "Privacidade › Inteligência artificial": onde o titular consulta, concede e REVOGA a autorização
 * de IA de terceiros (Spec 039). Revogar vale na hora para as próximas chamadas, e as funções que
 * não dependem de IA continuam funcionando.
 */
export function AiPrivacySection({ audience }: Props) {
  const { state, loading, busy, error, granted, grant, revoke } = useAiConsent();

  const status = (() => {
    if (loading) return "Consultando…";
    if (state == null) return "Não foi possível consultar agora.";
    if (state.granted) return `Autorizado desde ${fmt(state.grantedAt)}`;
    if (state.needsReconsent) return "A Política de IA foi atualizada — autorize de novo para continuar usando.";
    if (state.revokedAt) return `Revogado em ${fmt(state.revokedAt)}`;
    return "Não autorizado";
  })();

  const o_que_sai =
    audience === "aluno" ? (
      <>
        Com a sua autorização, enviamos ao provedor de IA (OpenAI), pelo nosso servidor: o seu score
        metabólico e os fatores do dia e, quando a interpretação por IA está ativa para você, o texto de
        refeição que você digita. Nunca enviamos nome, e-mail, telefone ou CPF. Resumos de IA que o seu
        personal ou nutricionista peça sobre você só funcionam com esta autorização.
      </>
    ) : (
      <>
        Com a sua autorização, enviamos ao provedor de IA (OpenAI) o texto que você escreve ao pedir uma
        ficha por IA. Não inclua nome nem dados pessoais de alunos nesse texto. Resumos de IA sobre um
        aluno dependem da autorização do próprio aluno, não da sua.
      </>
    );

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: "var(--radius-card)",
        background: COLORS.panel,
        padding: "var(--space-4)",
        display: "grid",
        gap: "var(--space-3)",
      }}
    >
      <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-bold)", color: COLORS.text }}>
        Privacidade · Inteligência artificial
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: COLORS.muted, lineHeight: 1.55 }}>{o_que_sai}</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: COLORS.text }} aria-live="polite">
        {status}
      </div>
      {error && (
        <div role="alert" className="badge badge-warn">
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {granted ? (
          <button type="button" className="btn btn-ghost" disabled={busy != null} onClick={() => void revoke()} style={{ minHeight: 44 }}>
            {busy === "revoke" ? "Revogando…" : "Revogar autorização"}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={busy != null || state == null} onClick={() => void grant()} style={{ minHeight: 44 }}>
            {busy === "grant" ? "Registrando…" : state?.needsReconsent ? "Autorizar de novo" : "Autorizar"}
          </button>
        )}
        <a
          href={AI_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleExternal(e, AI_POLICY_URL)}
          style={{ fontSize: "var(--text-xs)", color: COLORS.muted }}
        >
          Política de IA
        </a>
      </div>
    </div>
  );
}
