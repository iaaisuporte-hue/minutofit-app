import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { usePhysicalActivityClearance } from "../auth/usePhysicalActivityClearance";

const MotionLink = motion(Link);

export default function ComplianceBanner() {
  const { user, role } = useAuth();
  const clearance = usePhysicalActivityClearance();
  const shouldReduceMotion = useReducedMotion();

  if (role !== "user" || !user?.id) return null;

  // Nada a mostrar: já assinado e válido
  if (clearance.valid) return null;

  const isExpired = clearance.reason === "expired";

  const borderColor = isExpired ? "var(--color-danger-border, #fca5a5)" : "var(--color-warn-border)";
  const bgColor = isExpired ? "var(--color-danger-soft, var(--color-danger-soft))" : "var(--color-warn-soft)";
  const textStrong = isExpired ? "var(--color-danger, #dc2626)" : "var(--color-warn-text)";
  const textBody = isExpired ? "var(--color-danger-text-strong, #991b1b)" : "var(--color-warn-text-strong)";

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
        border: `1px solid ${borderColor}`,
        background: bgColor,
        color: textBody,
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
        {isExpired ? (
          <>
            <b style={{ color: textStrong }}>Liberação PAR-Q expirada:</b> sua assinatura de saúde e aptidão física venceu.
            Reassine para retomar os treinos.
          </>
        ) : (
          <>
            <b style={{ color: textStrong }}>Antes de começar:</b> reserve cerca de{" "}
            <strong>2 minutos</strong> para personalizar seu treino com segurança. Complete sua
            triagem de saúde, preferências e PAR-Q.
          </>
        )}
      </span>
      <MotionLink
        to="/app/user/parq"
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
          background: isExpired ? "var(--color-danger, #dc2626)" : undefined,
        }}
      >
        {isExpired ? "Reassinar PAR-Q →" : "Assinar PAR-Q →"}
      </MotionLink>
    </motion.div>
  );
}
