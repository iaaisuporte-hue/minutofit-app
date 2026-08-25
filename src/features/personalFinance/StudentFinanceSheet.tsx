/**
 * Ficha financeira de um aluno: acordo vigente, cobrança corrente, histórico de
 * 12 meses e a trilha de eventos.
 *
 * A trilha existe porque dinheiro exige memória: estorno não apaga o pagamento,
 * ele acrescenta uma linha. Nada aqui edita o passado.
 */
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { SkeletonStudentList } from "../../components/feedback/Skeleton";
import {
  cancelFinanceCharge,
  createFinancePlan,
  endFinancePlan,
  fetchStudentFinance,
  formatCents,
  formatCompetence,
  formatIsoDay,
  payFinanceCharge,
  PAYMENT_METHOD_LABEL,
  PERIOD_LABEL,
  revertFinanceCharge,
  updateFinancePlan,
  waiveFinanceCharge,
  type FinanceCharge,
  type FinancePlanInput,
  type PayChargeInput,
  type StudentFinanceDetail,
  type StudentFinanceRow,
} from "../../services/personalFinanceApi";
import { ChargeStatusBadge } from "./financeStatus";
import { sendFinanceReminder } from "./financeReminder";
import { MarkPaidForm } from "./MarkPaidForm";
import { PlanForm } from "./PlanForm";

const EVENT_LABEL: Record<string, string> = {
  plan_created: "Acordo criado",
  plan_updated: "Acordo atualizado",
  plan_paused: "Acordo pausado",
  plan_ended: "Acordo encerrado",
  charge_created: "Cobrança gerada",
  payment_recorded: "Pagamento registrado",
  payment_reverted: "Pagamento estornado",
  charge_waived: "Cobrança isenta",
  charge_canceled: "Cobrança cancelada",
};

type Mode = "view" | "pay" | "plan";
type Pending = null | { kind: "revert" | "waive" | "cancel"; charge: FinanceCharge } | { kind: "end" };

/** A cobrança que pede ação: a mais antiga ainda em aberto. */
function currentCharge(detail: StudentFinanceDetail | null): FinanceCharge | null {
  if (!detail) return null;
  const open = detail.charges.filter((c) => c.status === "open" || c.status === "partial");
  if (open.length === 0) return null;
  return open.reduce((oldest, charge) => (charge.dueDate < oldest.dueDate ? charge : oldest));
}

export function StudentFinanceSheet({
  student,
  onClose,
  onChanged,
}: {
  student: StudentFinanceRow;
  onClose: () => void;
  /** Avisa a página para recarregar KPIs e lista — os números mudaram. */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<StudentFinanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const studentId = student.studentId;
  const name = student.studentName || "Aluno sem nome";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchStudentFinance(studentId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o financeiro do aluno.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Toda ação recarrega a ficha e avisa a página: nada é atualizado "no otimismo". */
  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  const plan = detail?.plan ?? null;
  const activePlan = plan && plan.status !== "ended" ? plan : null;
  const charge = currentCharge(detail);

  function confirmPending() {
    const target = pending;
    setPending(null);
    if (!target) return;
    if (target.kind === "end") return void run(() => endFinancePlan(studentId));
    if (target.kind === "revert") return void run(() => revertFinanceCharge(target.charge.id));
    if (target.kind === "waive") return void run(() => waiveFinanceCharge(target.charge.id));
    return void run(() => cancelFinanceCharge(target.charge.id));
  }

  function handleRemind() {
    const opened = sendFinanceReminder({
      studentId,
      studentName: student.studentName,
      studentPhone: student.studentPhone,
      charge,
    });
    if (!opened) setError("Aluno sem telefone válido para WhatsApp.");
  }

  function handlePlanSubmit(input: FinancePlanInput) {
    void run(() =>
      activePlan ? updateFinancePlan(studentId, input) : createFinancePlan(studentId, input),
    );
  }

  function handlePaySubmit(input: PayChargeInput) {
    if (!charge) return;
    void run(() => payFinanceCharge(charge.id, input));
  }

  return (
    <DrawerShell open onClose={onClose} ariaLabel={`Financeiro de ${name}`}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="pp-kicker">Financeiro</div>
          <div className="pp-drawer-title">{name}</div>
        </div>
        <button
          type="button"
          className="pp-btn pp-btn--icon pp-btn--ghost"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      {loading ? <SkeletonStudentList rows={3} label="Carregando financeiro" /> : null}

      {!loading && mode === "plan" ? (
        <PlanForm
          plan={activePlan}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null);
            setMode("view");
          }}
          onSubmit={handlePlanSubmit}
        />
      ) : null}

      {!loading && mode === "pay" && charge ? (
        <MarkPaidForm
          charge={charge}
          defaultMethod={activePlan?.paymentMethod ?? null}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null);
            setMode("view");
          }}
          onSubmit={handlePaySubmit}
        />
      ) : null}

      {!loading && mode === "view" ? (
        <>
          {error ? <p className="pp-fin-error">{error}</p> : null}

          {activePlan ? (
            <div className="pp-fin-card">
              <div className="pp-inline">
                <span className="pp-fin-amount">{formatCents(activePlan.priceCents)}</span>
                <span className="pp-pill pp-pill--neutral">{PERIOD_LABEL[activePlan.period]}</span>
                {activePlan.status === "paused" ? (
                  <span className="pp-pill pp-pill--warn">Pausado</span>
                ) : null}
              </div>
              <div className="pp-meta">
                {activePlan.dueDay ? `Vence todo dia ${activePlan.dueDay}` : "Cobrança única"}
                {" · "}
                {activePlan.autoRenew ? "renova automaticamente" : "sem renovação automática"}
                {activePlan.paymentMethod
                  ? ` · ${PAYMENT_METHOD_LABEL[activePlan.paymentMethod]}`
                  : ""}
              </div>
              {activePlan.notes ? <div className="pp-meta">{activePlan.notes}</div> : null}
            </div>
          ) : (
            <EmptyState
              variant="info"
              title="Sem acordo registrado"
              description="Registre quanto e de quanto em quanto tempo este aluno paga. O dinheiro continua sendo recebido por você, fora da plataforma — aqui fica o controle."
              action={
                <button
                  type="button"
                  className="pp-btn pp-btn--primary"
                  onClick={() => setMode("plan")}
                >
                  Criar acordo
                </button>
              }
            />
          )}

          {charge ? (
            <div className="pp-fin-card">
              <div className="pp-inline">
                <span className="pp-fin-amount">
                  {formatCents(charge.amountCents - charge.paidCents)}
                </span>
                <ChargeStatusBadge
                  status={charge.derivedStatus}
                  suffix={
                    charge.derivedStatus === "overdue"
                      ? `${charge.daysOverdue} dias`
                      : formatIsoDay(charge.dueDate)
                  }
                />
              </div>
              <div className="pp-meta">
                Competência de {formatCompetence(charge.competence)} · vence em{" "}
                {formatIsoDay(charge.dueDate, true)}
                {charge.paidCents > 0 ? ` · já recebido ${formatCents(charge.paidCents)}` : ""}
              </div>
              <div className="pp-actions">
                <button
                  type="button"
                  className="pp-btn pp-btn--primary"
                  onClick={() => setMode("pay")}
                  disabled={busy}
                >
                  Marcar como pago
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn--sm"
                  onClick={handleRemind}
                  disabled={busy || !student.studentPhone}
                  title={
                    student.studentPhone
                      ? "Abrir o WhatsApp com a mensagem pronta"
                      : "Aluno sem telefone cadastrado"
                  }
                >
                  <MessageCircle size={14} aria-hidden="true" />
                  <span style={{ marginLeft: 6 }}>Cobrar no WhatsApp</span>
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn--quiet pp-btn--sm"
                  onClick={() => setPending({ kind: "waive", charge })}
                  disabled={busy}
                >
                  Isentar
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn--quiet pp-btn--sm"
                  onClick={() => setPending({ kind: "cancel", charge })}
                  disabled={busy}
                >
                  Cancelar cobrança
                </button>
              </div>
            </div>
          ) : null}

          {activePlan ? (
            <div className="pp-actions">
              <button
                type="button"
                className="pp-btn pp-btn--sm"
                onClick={() => setMode("plan")}
                disabled={busy}
              >
                Editar acordo
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--quiet pp-btn--sm"
                onClick={() => setPending({ kind: "end" })}
                disabled={busy}
              >
                Encerrar acordo
              </button>
            </div>
          ) : null}

          <div>
            <div className="pp-panel__title">Cobranças (12 meses)</div>
            {detail && detail.charges.length > 0 ? (
              <ul className="pp-fin-list">
                {detail.charges.map((row) => (
                  <li key={row.id} className="pp-fin-list__item">
                    <div>
                      <div className="pp-fin-list__title">{formatCompetence(row.competence)}</div>
                      <div className="pp-meta">
                        {formatCents(row.amountCents)} · vence {formatIsoDay(row.dueDate)}
                        {row.paidMethod ? ` · ${PAYMENT_METHOD_LABEL[row.paidMethod]}` : ""}
                      </div>
                    </div>
                    <div className="pp-inline">
                      <ChargeStatusBadge status={row.derivedStatus} />
                      {row.status === "paid" || row.status === "partial" ? (
                        <button
                          type="button"
                          className="pp-btn pp-btn--quiet pp-btn--sm"
                          onClick={() => setPending({ kind: "revert", charge: row })}
                          disabled={busy}
                        >
                          Estornar
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pp-meta">Nenhuma cobrança gerada ainda.</p>
            )}
          </div>

          <div>
            <div className="pp-panel__title">Histórico de alterações</div>
            {detail && detail.events.length > 0 ? (
              <ul className="pp-fin-list">
                {detail.events.map((event) => (
                  <li key={event.id} className="pp-fin-list__item">
                    <div className="pp-fin-list__title">
                      {EVENT_LABEL[event.eventType] ?? event.eventType}
                    </div>
                    <span className="pp-meta">
                      {new Date(event.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pp-meta">Sem movimentações registradas.</p>
            )}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        danger
        title={
          pending?.kind === "end"
            ? "Encerrar o acordo deste aluno?"
            : pending?.kind === "revert"
              ? "Estornar este pagamento?"
              : pending?.kind === "waive"
                ? "Isentar esta cobrança?"
                : "Cancelar esta cobrança?"
        }
        message={
          pending?.kind === "end"
            ? "Nenhuma cobrança nova será gerada. As já emitidas continuam no histórico."
            : pending?.kind === "revert"
              ? "A cobrança volta a ficar em aberto. O registro anterior permanece no histórico."
              : "A cobrança sai do previsto do mês e não pode ser reaberta."
        }
        confirmLabel="Confirmar"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </DrawerShell>
  );
}
