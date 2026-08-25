/**
 * Vocabulário visual do status de cobrança.
 *
 * O status vem derivado do servidor (`derivedStatus`) — aqui só se escolhe
 * rótulo e tom. Nada de recalcular vencimento no cliente: o dia de referência
 * é o do backend, e duas contas independentes divergiriam na virada do dia.
 */
import type { DerivedChargeStatus } from "../../services/personalFinanceApi";

type Tone = { label: string; className: string };

const TONES: Record<DerivedChargeStatus, Tone> = {
  paid: { label: "Pago", className: "pp-pill pp-pill--success" },
  partial: { label: "Parcial", className: "pp-pill pp-pill--warn" },
  overdue: { label: "Vencido", className: "pp-pill pp-pill--risk" },
  upcoming: { label: "A vencer", className: "pp-pill pp-pill--neutral" },
  waived: { label: "Isento", className: "pp-pill pp-pill--neutral" },
  canceled: { label: "Cancelado", className: "pp-pill pp-pill--neutral" },
};

const NO_PLAN: Tone = { label: "Sem acordo", className: "pp-pill pp-pill--neutral" };

function chargeStatusTone(status: DerivedChargeStatus | null): Tone {
  return status ? TONES[status] : NO_PLAN;
}

export function ChargeStatusBadge({
  status,
  suffix,
}: {
  status: DerivedChargeStatus | null;
  /** Complemento do rótulo — ex.: "12d" de atraso ou a data de vencimento. */
  suffix?: string | null;
}) {
  const tone = chargeStatusTone(status);
  return (
    <span className={tone.className}>
      {tone.label}
      {suffix ? ` · ${suffix}` : ""}
    </span>
  );
}
