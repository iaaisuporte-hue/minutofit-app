import { usePlan } from "./usePlan";
import { UpgradeToProButton } from "./UpgradeToProButton";
import { isNativeApp } from "../../lib/platform";

interface Props {
  studentCount: number;
}

export function StudentLimitBanner({ studentCount }: Props) {
  const plan = usePlan();

  if (plan.studentLimit === null) return null;

  const ratio = studentCount / plan.studentLimit;
  if (ratio < 0.8) return null;

  const atLimit = studentCount >= plan.studentLimit;
  // No app empacotado o aviso continua (explica por que o convite não sai), mas
  // sem nome de plano pago nem botão de compra (Apple 3.1.1).
  const nomePlano = isNativeApp() ? "do seu plano atual" : `no plano ${plan.plan === "free" ? "Free" : "Starter"}`;

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
          ? `Limite atingido: ${studentCount} de ${plan.studentLimit} alunos ${nomePlano}.`
          : `Você está usando ${studentCount} de ${plan.studentLimit} alunos ${nomePlano}.`}
      </span>
      <UpgradeToProButton variant="link" label="Assinar Pro · R$ 89/mês" />
    </div>
  );
}
