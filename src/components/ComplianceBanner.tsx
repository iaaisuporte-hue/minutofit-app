import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { useNeonTheme } from "../theme/minutofitNeonTheme";

const MotionLink = motion(Link);

export default function ComplianceBanner() {
  const { user, role } = useAuth();
  const neon = useNeonTheme();
  const shouldReduceMotion = useReducedMotion();
  if (role !== "user" || !user?.id) return null;
  if (user.studentComplianceComplete) return null;

  return (
    <motion.div
      className="compliance-banner-root"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
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
      <MotionLink
        to="/app/user/settings?focus=compliance#compliance"
        className="compliance-banner-cta"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        animate={
          shouldReduceMotion
            ? undefined
            : { boxShadow: ["0 8px 18px rgba(29,185,84,.20)", "0 10px 22px rgba(124,255,107,.32)", "0 8px 18px rgba(29,185,84,.20)"] }
        }
        transition={shouldReduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
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
      </MotionLink>
    </motion.div>
  );
}
