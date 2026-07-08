import { usePlan } from "./usePlan";
import type { PersonalPlan } from "../../services/personalPlanApi";

const LABEL: Record<PersonalPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

const STYLE: Record<PersonalPlan, React.CSSProperties> = {
  free: {
    background: "rgba(148,163,184,0.12)",
    color: "var(--color-text-muted)",
    border: "1px solid rgba(148,163,184,0.25)",
  },
  starter: {
    background: "rgba(99,102,241,0.1)",
    color: "rgb(99,102,241)",
    border: "1px solid rgba(99,102,241,0.25)",
  },
  pro: {
    background: "rgba(123,153,25,0.1)",
    color: "rgb(21,128,61)",
    border: "1px solid rgba(123,153,25,0.3)",
  },
};

export function PlanBadge() {
  const plan = usePlan();

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 999,
        lineHeight: 1.6,
        ...STYLE[plan.plan],
      }}
    >
      {LABEL[plan.plan]}
    </span>
  );
}
