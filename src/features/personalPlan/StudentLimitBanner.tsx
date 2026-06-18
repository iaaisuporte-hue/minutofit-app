import { usePlan } from "./usePlan";

interface Props {
  studentCount: number;
}

export function StudentLimitBanner({ studentCount }: Props) {
  const plan = usePlan();

  if (plan.studentLimit === null) return null;

  const ratio = studentCount / plan.studentLimit;
  if (ratio < 0.8) return null;

  const atLimit = studentCount >= plan.studentLimit;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: atLimit ? "rgba(239,68,68,0.06)" : "rgba(251,191,36,0.08)",
        border: `1px solid ${atLimit ? "rgba(239,68,68,0.25)" : "rgba(251,191,36,0.3)"}`,
        fontSize: 13,
        color: atLimit ? "var(--color-danger, #dc2626)" : "var(--color-warn-text, #92400e)",
        marginBottom: 4,
      }}
    >
      <span>
        {atLimit
          ? `Limite atingido: ${studentCount} de ${plan.studentLimit} alunos no plano ${plan.plan === "free" ? "Free" : "Starter"}.`
          : `Você está usando ${studentCount} de ${plan.studentLimit} alunos no plano ${plan.plan === "free" ? "Free" : "Starter"}.`}
      </span>
      <a
        href="mailto:suporte@minutofit.com.br?subject=Upgrade%20de%20plano"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "inherit",
          textDecoration: "underline",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Fazer upgrade
      </a>
    </div>
  );
}
