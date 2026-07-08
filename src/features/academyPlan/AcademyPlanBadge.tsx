import type { AcademySaasPlan } from "../../services/academyApi";

/** Badge compacto do plano SaaS da academia (Free / Pro). */
export function AcademyPlanBadge({ plan }: { plan: AcademySaasPlan }) {
  const isPro = plan === "pro";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: isPro ? "var(--color-success-text, #5E7412)" : "var(--color-text-muted)",
        background: isPro ? "var(--color-success-soft, rgba(123,153,25,.12))" : "var(--color-surface-2, rgba(0,0,0,.05))",
        border: `1px solid ${isPro ? "var(--color-success-border, rgba(123,153,25,.3))" : "var(--color-border)"}`,
      }}
    >
      {isPro ? "Pro" : "Free"}
    </span>
  );
}
