import { MapPin } from "lucide-react";

/**
 * Aviso que precede o pedido de localização ao sistema.
 *
 * A política do Google Play exige "prominent disclosure": explicar dentro do app
 * qual dado será acessado e para quê ANTES do diálogo de permissão, com opção de
 * recusar. Antes disto o Tracker chamava `watchPosition` na montagem da tela — o
 * usuário abria a página e o diálogo do sistema aparecia sem nenhum contexto.
 */
export function LocationDisclosure({
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
      aria-labelledby="loc-disclosure-title"
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
          <MapPin size={20} style={{ color: "var(--color-accent)" }} aria-hidden />
          <h2
            id="loc-disclosure-title"
            style={{ margin: 0, fontSize: "var(--text-lg, 17px)", fontWeight: 700, color: "var(--color-text)" }}
          >
            Usar sua localização
          </h2>
        </div>

        <p style={{ margin: 0, fontSize: "var(--text-sm, 13px)", color: "var(--color-text-muted)", lineHeight: 1.55 }}>
          Para registrar o trajeto, a distância e o ritmo da sua atividade, o S2Core precisa acessar
          a localização do aparelho <strong>enquanto o treino está em andamento</strong>.
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
          <li>Só coletamos com a atividade iniciada por você — nunca em segundo plano.</li>
          <li>O trajeto fica na sua conta e não é compartilhado sem o seu consentimento.</li>
          <li>Você pode recusar e usar o restante do app normalmente.</li>
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
            Permitir localização
          </button>
        </div>
      </div>
    </div>
  );
}
