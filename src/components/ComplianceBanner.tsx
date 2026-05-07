import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";

const MotionLink = motion(Link);

export default function ComplianceBanner() {
  const { user, role } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  if (role !== "user" || !user?.id) return null;
  if (user.studentComplianceComplete) return null;

  return (
    <motion.div
      className="compliance-banner-root"
      initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        margin: "0 0 var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-warn-border)",
        background: "var(--color-warn-soft)",
        color: "var(--color-warn-text-strong)",
        fontSize: "var(--text-base)",
        lineHeight: 1.5,
        display: "flex",
        flexWrap: "wrap" as const,
        alignItems: "center",
        gap: "var(--space-3)",
        justifyContent: "space-between",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <b style={{ color: "var(--color-warn-text)" }}>Antes de começar:</b> reserve cerca de{" "}
        <strong>2 minutos</strong> para personalizar seu treino com segurança. Complete sua
        triagem de saúde, preferências e PAR-Q em <strong>Configurações</strong>.
      </span>
      <MotionLink
        to="/app/user/settings?focus=compliance#compliance"
        className="compliance-banner-cta btn btn-primary"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        style={{
          padding: "9px var(--space-4)",
          borderRadius: "var(--radius-sm)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          minHeight: 40,
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          fontSize: "var(--text-sm)",
        }}
      >
        Completar agora →
      </MotionLink>
    </motion.div>
  );
}
