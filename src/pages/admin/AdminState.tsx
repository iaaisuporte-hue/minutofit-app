import { COLORS } from "../../styles/colors";

type AdminStateType = "loading" | "error" | "empty";

type Props = {
  type: AdminStateType;
  message?: string;
  onRetry?: () => void;
};

export default function AdminState({ type, message, onRetry }: Props) {
  if (type === "loading") {
    return (
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          padding: 24,
          color: COLORS.muted,
          textAlign: "center",
          fontSize: 14,
        }}
      >
        {message ?? "Carregando..."}
      </div>
    );
  }

  if (type === "error") {
    return (
      <div
        style={{
          border: `1px solid ${COLORS.redBorder}`,
          borderRadius: 20,
          background: COLORS.redSoft,
          padding: 18,
          display: "grid",
          gap: 10,
          color: COLORS.text,
        }}
      >
        <div style={{ fontWeight: 700 }}>Não foi possível carregar</div>
        {message && <div style={{ color: COLORS.muted, fontSize: 13 }}>{message}</div>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${COLORS.redBorder}`,
              background: "#F9FAFB",
              color: COLORS.text,
              fontWeight: 700,
              cursor: "pointer",
              width: "fit-content",
              fontSize: 13,
            }}
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        padding: 24,
        color: COLORS.muted,
        textAlign: "center",
        fontSize: 14,
      }}
    >
      {message ?? "Nenhum dado para exibir."}
    </div>
  );
}
