/**
 * Acordo financeiro do aluno: quanto, de quanto em quanto tempo, vencendo quando.
 *
 * As regras de coerência são as mesmas do backend (dia de vencimento só existe
 * em acordo recorrente; sessões só em pacote) — repetidas aqui para o personal
 * não descobrir o erro depois de salvar. A validação que vale continua sendo a
 * do servidor.
 */
import { useState, type FormEvent } from "react";
import { dayKey } from "../../lib/appDay";
import {
  FINANCE_PERIODS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PERIOD_LABEL,
  type FinancePeriod,
  type FinancePlan,
  type FinancePlanInput,
  type PaymentMethod,
} from "../../services/personalFinanceApi";

const RECURRING: FinancePeriod[] = ["monthly", "quarterly", "semiannual", "annual"];

export function PlanForm({
  plan,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  plan: FinancePlan | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: FinancePlanInput) => void;
}) {
  const [price, setPrice] = useState(plan ? (plan.priceCents / 100).toFixed(2) : "");
  const [period, setPeriod] = useState<FinancePeriod>(plan?.period ?? "monthly");
  const [dueDay, setDueDay] = useState(String(plan?.dueDay ?? 5));
  const [sessions, setSessions] = useState(plan?.packageSessions ? String(plan.packageSessions) : "");
  const [autoRenew, setAutoRenew] = useState(plan?.autoRenew ?? true);
  const [method, setMethod] = useState<PaymentMethod | "">(plan?.paymentMethod ?? "");
  const [startsOn, setStartsOn] = useState(plan?.startsOn ?? dayKey());
  const [notes, setNotes] = useState(plan?.notes ?? "");

  const recurring = RECURRING.includes(period);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    onSubmit({
      priceCents: Math.round(Number(price.replace(",", ".")) * 100),
      period,
      dueDay: recurring ? Number(dueDay) : null,
      packageSessions: period === "package" && sessions ? Number(sessions) : null,
      autoRenew,
      paymentMethod: method || null,
      startsOn,
      notes: notes.trim() || null,
    });
  }

  return (
    <form className="pp-fin-form" onSubmit={handleSubmit}>
      <div className="pp-fin-form__row">
        <label className="pp-fin-field">
          <span>Valor</span>
          <input
            className="pp-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0,00"
            required
          />
          <small className="pp-meta">Zero registra um acordo de cortesia.</small>
        </label>

        <label className="pp-fin-field">
          <span>Periodicidade</span>
          <select
            className="pp-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as FinancePeriod)}
          >
            {FINANCE_PERIODS.map((option) => (
              <option key={option} value={option}>
                {PERIOD_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pp-fin-form__row">
        {recurring ? (
          <label className="pp-fin-field">
            <span>Dia de vencimento</span>
            <input
              className="pp-input"
              type="number"
              min="1"
              max="28"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              required
            />
            <small className="pp-meta">Até 28, para valer em qualquer mês.</small>
          </label>
        ) : null}

        {period === "package" ? (
          <label className="pp-fin-field">
            <span>Sessões do pacote (opcional)</span>
            <input
              className="pp-input"
              type="number"
              min="1"
              max="1000"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </label>
        ) : null}

        <label className="pp-fin-field">
          <span>Início</span>
          <input
            className="pp-input"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="pp-fin-form__row">
        <label className="pp-fin-field">
          <span>Forma de pagamento habitual</span>
          <select
            className="pp-select"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
          >
            <option value="">Não definir</option>
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_METHOD_LABEL[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="pp-fin-toggle">
          <input
            type="checkbox"
            checked={autoRenew}
            onChange={(e) => setAutoRenew(e.target.checked)}
          />
          <span>
            Renovar automaticamente
            <small className="pp-meta">
              Desligado, o acordo termina no ciclo atual e entra em “Próximas renovações”.
            </small>
          </span>
        </label>
      </div>

      <label className="pp-fin-field">
        <span>Observações (opcional)</span>
        <textarea
          className="pp-quick-msg-textarea"
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: combinado de pagar sempre no dia 5, via PIX."
        />
      </label>

      {error ? <p className="pp-fin-error">{error}</p> : null}

      <div className="pp-quick-msg-actions">
        <button type="button" className="pp-btn pp-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="pp-btn pp-btn--primary" disabled={busy}>
          {busy ? "Salvando…" : plan ? "Salvar acordo" : "Criar acordo"}
        </button>
      </div>
    </form>
  );
}
