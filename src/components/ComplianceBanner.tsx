import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useNeonTheme } from "../theme/minutofitNeonTheme";

export default function ComplianceBanner() {
  const { user, role } = useAuth();
  const neon = useNeonTheme();
  if (role !== "user" || !user?.id) return null;
  if (user.studentComplianceComplete) return null;

  return (
    <div
      className="compliance-banner-root"
      style={{
        margin: "0 0 12px",
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${neon.accentBorderStrong}`,
        background: `linear-gradient(90deg, ${neon.accentSoft}, rgba(255,255,255,.04))`,
        color: neon.text,
        fontSize: 14,
        lineHeight: 1.45,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        justifyContent: "space-between",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <b>Obrigatório:</b> complete triagem de saúde, preferências de treino e PAR-Q com assinatura em{" "}
        <strong>Configurações</strong> antes de usar o app com segurança jurídica e de saúde.
      </span>
      <Link
        to="/app/user/settings#compliance"
        className="compliance-banner-cta"
        style={{
          color: neon.ctaText,
          background: neon.ctaGradient,
          fontWeight: 800,
          padding: "10px 14px",
          borderRadius: 10,
          textDecoration: "none",
          whiteSpace: "nowrap",
          minHeight: 44,
          boxSizing: "border-box",
        }}
      >
        Abrir Configurações
      </Link>
    </div>
  );
}
