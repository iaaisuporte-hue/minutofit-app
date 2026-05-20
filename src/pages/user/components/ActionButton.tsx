import { motion } from "framer-motion";
import { SURFACE } from "./surface";

type Variant = "primary" | "secondary" | "ghost";

export function ActionButton({
  children,
  onClick,
  variant = "primary",
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: Variant;
  fullWidth?: boolean;
}) {
  const styles =
    variant === "primary"
      ? {
          background: "linear-gradient(135deg, #22C55E, #06B6D4)",
          color: "#FFFFFF",
          border: "none",
          boxShadow: "0 14px 34px rgba(34,197,94,0.18)",
        }
      : variant === "secondary"
        ? {
            background: SURFACE.card,
            color: SURFACE.text,
            border: `1px solid ${SURFACE.border}`,
            boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
          }
        : {
            background: "rgba(255,255,255,0.62)",
            color: SURFACE.text,
            border: `1px solid ${SURFACE.border}`,
            boxShadow: "none",
          };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
      className={`today-action-button today-action-button-${variant}`}
      style={{ width: fullWidth ? "100%" : "fit-content", ...styles }}
    >
      {children}
    </motion.button>
  );
}
