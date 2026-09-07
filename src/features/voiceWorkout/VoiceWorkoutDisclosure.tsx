import { Mic } from "lucide-react";

/**
 * Aviso que precede o pedido de microfone ao sistema (P5A).
 *
 * Mesmo motivo do `LocationDisclosure`: a política das lojas exige explicar
 * dentro do app o que será acessado e para quê ANTES do diálogo do sistema,
 * com opção de recusar — e o microfone é dado ainda mais sensível que
 * localização.
 */
export function VoiceWorkoutDisclosure({
  onAllow,
  onDecline,
}: {
  onAllow: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-disclosure-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: "var(--radius-card, 12px)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "var(--space-5, 20px)",
          display: "grid",
          gap: "var(--space-3, 12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Mic size={20} style={{ color: "var(--color-accent)" }} aria-hidden />
          <h2
            id="voice-disclosure-title"
            style={{ margin: 0, fontSize: "var(--text-lg, 17px)", fontWeight: 700, color: "var(--color-text)" }}
          >
            Usar o microfone
          </h2>
        </div>

        <p style={{ margin: 0, fontSize: "var(--text-sm, 13px)", color: "var(--color-text-muted)", lineHeight: 1.55 }}>
          Com o Voice Workout ativo, o S2Core usa o microfone para registrar comandos como
          "fiz 12 com 28" <strong>enquanto você treina</strong> — sem precisar tocar na tela.
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.1rem",
            fontSize: "var(--text-xs, 12px)",
            color: "var(--color-text-muted)",
            lineHeight: 1.6,
          }}
        >
          <li>Nenhum áudio é gravado ou armazenado — só o comando é reconhecido.</li>
          <li>O microfone só liga quando você ativa o modo, dentro de um treino.</li>
          <li>Pode desligar a qualquer momento e continuar registrando pela tela.</li>
        </ul>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={onDecline}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "none",
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm, 13px)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={onAllow}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--action-primary)",
              color: "var(--action-primary-text)",
              fontSize: "var(--text-sm, 13px)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ativar Voice Workout
          </button>
        </div>
      </div>
    </div>
  );
}
