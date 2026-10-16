import { useState } from "react";
import { reportConversation, CHAT_REPORT_REASON_MAX } from "./chatReportEvents";

/**
 * "Denunciar conversa" — a mesma ação para os dois lados do chat (aluno e
 * personal). É requisito de compliance, não feature de moderação: registra o
 * relato e confirma ao usuário que alguém vai olhar.
 *
 * Sem modal de propósito. O gesto é raro e a decisão é do usuário; um painel
 * que abre no lugar do botão custa menos atenção do que uma sobreposição, e o
 * motivo continua opcional — exigir texto faria quem só quer sinalizar
 * desistir.
 *
 * Tom neutro por escolha: a tela não julga quem é denunciado nem promete
 * punição.
 */
export function ReportConversationButton({ conversationId }: { conversationId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await reportConversation(conversationId, motivo);
      setEnviado(true);
      setAberto(false);
      setMotivo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a denúncia.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div
        role="status"
        style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}
      >
        Denúncia registrada. Nossa equipe vai revisar.
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          minHeight: 32,
          padding: "0 10px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-muted)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Denunciar conversa
      </button>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-raised)",
      }}
    >
      <label
        htmlFor={`denuncia-${conversationId}`}
        style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}
      >
        Conte o que aconteceu (opcional)
      </label>
      <textarea
        id={`denuncia-${conversationId}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={CHAT_REPORT_REASON_MAX}
        rows={3}
        style={{
          resize: "vertical",
          borderRadius: 10,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text)",
          padding: "8px 10px",
          fontSize: 13,
          fontFamily: "inherit",
        }}
      />
      {erro && (
        <span role="alert" style={{ fontSize: 12, color: "var(--color-danger)" }}>
          {erro}
        </span>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 10,
            border: "none",
            background: "var(--action-primary)",
            color: "var(--color-cta-text, #FFFFFF)",
            fontSize: 13,
            fontWeight: 700,
            cursor: enviando ? "default" : "pointer",
            opacity: enviando ? 0.7 : 1,
          }}
        >
          {enviando ? "Enviando…" : "Enviar denúncia"}
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); setErro(null); }}
          disabled={enviando}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
