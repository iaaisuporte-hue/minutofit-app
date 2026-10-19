import type { ReactNode } from "react";
import { CalendarDays, Clock, Info, Pill } from "lucide-react";
import type { Supplement } from "../../../services/supplementsApi";
import { STATUS_LABELS, formatDose, formatFrequency, formatPeriod } from "./supplementLabels";

const STATUS_BADGE: Record<Supplement["status"], string> = {
  active: "badge-brand",
  suspended: "badge-warn",
  ended: "badge-neutral",
};

/**
 * Card de uma orientação de suplementação (Spec 040) — o mesmo para o aluno
 * e para o nutri. Mostra só o que o profissional registrou: nada de dose
 * sugerida, nada de texto gerado. `children` recebe a linha de uso e as
 * ações de cada lado.
 */
export function SupplementCard({
  supplement,
  showStatus = false,
  children,
}: {
  supplement: Supplement;
  showStatus?: boolean;
  children?: ReactNode;
}) {
  const period = formatPeriod(supplement.startDate, supplement.endDate);

  return (
    <article className="supplementCard" aria-label={supplement.name}>
      <div className="supplementCard__head">
        <span className="supplementCard__icon" aria-hidden="true">
          <Pill size={18} />
        </span>
        <div className="supplementCard__title">
          <h3>{supplement.name}</h3>
          <p>
            {formatDose(supplement.doseAmount, supplement.doseUnit)} · {formatFrequency(supplement.frequency, supplement.frequencyDetail)}
          </p>
        </div>
        {showStatus && <span className={`badge ${STATUS_BADGE[supplement.status]}`}>{STATUS_LABELS[supplement.status]}</span>}
      </div>

      {(supplement.timing || period) && (
        <ul className="supplementCard__meta">
          {supplement.timing && (
            <li>
              <Clock size={14} aria-hidden="true" />
              <span>{supplement.timing}</span>
            </li>
          )}
          {period && (
            <li>
              <CalendarDays size={14} aria-hidden="true" />
              <span>{period}</span>
            </li>
          )}
        </ul>
      )}

      {supplement.purpose && (
        <p className="supplementCard__purpose">
          <strong>Finalidade:</strong> {supplement.purpose}
        </p>
      )}

      {supplement.notes && (
        <p className="supplementCard__notes">
          <Info size={14} aria-hidden="true" />
          <span>
            <strong>Observações e cuidados:</strong> {supplement.notes}
          </span>
        </p>
      )}

      {children && <div className="supplementCard__footer">{children}</div>}
    </article>
  );
}
