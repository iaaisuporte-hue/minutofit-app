import { Link } from "react-router-dom";
import { useFeatureFlags } from "../../../auth/FeatureFlagsContext";
import { COLORS } from "../../../styles/colors";

// Porta de entrada do Lab de Movimento (beta). Renderiza nada quando a flag
// `movement_lab` está desligada — a flag é o kill-switch do beta. `source`
// vira query param `?from=` para o Lab reportar de onde o usuário chegou.
export function MovementLabEntryCard({ source }: { source: "today" | "treino" }) {
  const { hasFeature } = useFeatureFlags();
  if (!hasFeature("movement_lab")) return null;

  return (
    <Link
      to={`/app/user/movement-lab?from=${source}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${COLORS.primaryBorder}`,
        borderRadius: 12,
        background: COLORS.primarySoft,
        padding: "12px 14px",
        color: COLORS.text,
        textDecoration: "none",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface)",
          color: COLORS.primary,
        }}
        aria-hidden
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
        </svg>
      </span>

      <div style={{ minWidth: 0, flex: "1 1 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Lab de Movimento</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: COLORS.primary,
              border: `1px solid ${COLORS.primaryBorder}`,
              borderRadius: 999,
              padding: "1px 6px",
            }}
          >
            Beta
          </span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
          Use a câmera para contar repetições e ver a qualidade da execução.
        </div>
      </div>

      <span style={{ flexShrink: 0, color: COLORS.primary, fontWeight: 700, fontSize: 13 }}>→</span>
    </Link>
  );
}
