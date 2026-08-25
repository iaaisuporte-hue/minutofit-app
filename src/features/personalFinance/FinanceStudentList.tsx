/**
 * A carteira sob a lente financeira — uma linha por aluno, inclusive quem
 * ainda não tem acordo (é justamente quem precisa de um).
 *
 * A cobrança mostrada é a que o backend elegeu como corrente: a mais antiga em
 * aberto quando existe atraso, senão a próxima a vencer.
 */
import { MessageCircle } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import {
  formatCents,
  formatCompetence,
  formatIsoDay,
  PERIOD_LABEL,
  type StudentFinanceRow,
} from "../../services/personalFinanceApi";
import { ChargeStatusBadge } from "./financeStatus";

function chargeSuffix(row: StudentFinanceRow): string | null {
  const charge = row.currentCharge;
  if (!charge) return null;
  if (charge.derivedStatus === "overdue") {
    return charge.daysOverdue === 1 ? "1 dia" : `${charge.daysOverdue} dias`;
  }
  if (charge.derivedStatus === "upcoming" || charge.derivedStatus === "partial") {
    return formatIsoDay(charge.dueDate);
  }
  return null;
}

export function FinanceStudentList({
  rows,
  emptyHint,
  onSelect,
  onRemind,
}: {
  rows: StudentFinanceRow[];
  emptyHint: string;
  onSelect: (row: StudentFinanceRow) => void;
  onRemind: (row: StudentFinanceRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState variant="info" title="Nenhum aluno com esse filtro" description={emptyHint} />
    );
  }

  return (
    <div className="pp-fin-students">
      {rows.map((row) => {
        const charge = row.currentCharge;
        const name = row.studentName || "Aluno sem nome";
        return (
          <div key={row.studentId} className="pp-student-row">
            <div className="pp-student-main">
              <div className="pp-inline">
                <button type="button" className="pp-name" onClick={() => onSelect(row)}>
                  {name}
                </button>
                <ChargeStatusBadge
                  status={charge?.derivedStatus ?? null}
                  suffix={chargeSuffix(row)}
                />
              </div>

              <div className="pp-meta">
                {row.plan ? (
                  <>
                    <b>{formatCents(row.plan.priceCents)}</b> · {PERIOD_LABEL[row.plan.period]}
                    {charge ? ` · cobrança de ${formatCompetence(charge.competence)}` : ""}
                  </>
                ) : (
                  "Sem acordo registrado — nenhum valor previsto para este aluno."
                )}
              </div>
            </div>

            <div className="pp-actions">
              <button
                type="button"
                className="pp-btn pp-btn--quiet pp-btn--sm"
                onClick={() => onRemind(row)}
                disabled={!row.studentPhone}
                title={
                  row.studentPhone
                    ? "Abrir o WhatsApp com a mensagem pronta"
                    : "Aluno sem telefone cadastrado"
                }
              >
                <MessageCircle size={14} aria-hidden="true" />
                <span style={{ marginLeft: 6 }}>Cobrar</span>
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--primary pp-btn--sm"
                onClick={() => onSelect(row)}
              >
                {row.plan ? "Abrir" : "Criar acordo"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
