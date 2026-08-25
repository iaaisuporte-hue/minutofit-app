/**
 * "Próximas renovações" — acordos que ACABAM nos próximos 14 dias.
 *
 * Mensalidade com renovação automática não entra: ela não termina. Entram os
 * acordos sem renovação automática e os de pacote/avulso, que se esgotam na
 * última cobrança — é aí que existe uma conversa a ter com o aluno.
 */
import {
  formatCents,
  formatIsoDay,
  PERIOD_LABEL,
  type FinanceRenewalItem,
} from "../../services/personalFinanceApi";

export function RenewalsSection({
  renewals,
  onSelect,
}: {
  renewals: FinanceRenewalItem[];
  onSelect: (studentId: number) => void;
}) {
  if (renewals.length === 0) return null;

  return (
    <div className="pp-panel">
      <div className="pp-panel__header">
        <div>
          <div className="pp-panel__title">Próximas renovações</div>
          <div className="pp-panel__subtitle">
            {renewals.length === 1
              ? "1 acordo termina nos próximos 14 dias."
              : `${renewals.length} acordos terminam nos próximos 14 dias.`}
          </div>
        </div>
      </div>
      <div className="pp-panel__body">
        <ul className="pp-fin-renewals">
          {renewals.map((item) => (
            <li key={`${item.studentId}-${item.dueDate}`} className="pp-fin-renewal">
              <button
                type="button"
                className="pp-name"
                onClick={() => onSelect(item.studentId)}
              >
                {item.studentName || "Aluno sem nome"}
              </button>
              <span className="pp-meta">
                {PERIOD_LABEL[item.period]} · termina em {formatIsoDay(item.dueDate)} ·{" "}
                <b>{formatCents(item.amountCents)}</b>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
