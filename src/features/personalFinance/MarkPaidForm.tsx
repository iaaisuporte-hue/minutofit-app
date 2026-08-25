/**
 * Registro manual de pagamento.
 *
 * A plataforma não recebe dinheiro: isto é o personal anotando que recebeu por
 * fora. Valor e data vêm preenchidos com o caso comum (o que falta, hoje) para
 * que o fluxo normal seja um toque em "Confirmar".
 */
import { useState, type FormEvent } from "react";
import { dayKey } from "../../lib/appDay";
import {
  formatCents,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type FinanceCharge,
  type PayChargeInput,
  type PaymentMethod,
} from "../../services/personalFinanceApi";

/**
 * 'YYYY-MM-DD' → instante do MEIO-DIA local.
 *
 * Enviar a data pura viraria meia-noite UTC, que no horário de Brasília é o dia
 * anterior — o pagamento de hoje apareceria como o de ontem no extrato.
 */
function isoAtLocalNoon(day: string): string {
  return new Date(`${day}T12:00:00`).toISOString();
}

export function MarkPaidForm({
  charge,
  defaultMethod,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  charge: FinanceCharge;
  defaultMethod: PaymentMethod | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: PayChargeInput) => void;
}) {
  const remaining = charge.amountCents - charge.paidCents;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [paidOn, setPaidOn] = useState(dayKey());
  const [method, setMethod] = useState<PaymentMethod>(charge.paidMethod ?? defaultMethod ?? "pix");
  const [notes, setNotes] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    onSubmit({
      paidCents: Number.isFinite(cents) ? cents : null,
      paidAt: isoAtLocalNoon(paidOn),
      paidMethod: method,
      notes: notes.trim() || null,
    });
  }

  return (
    <form className="pp-fin-form" onSubmit={handleSubmit}>
      <div className="pp-fin-form__row">
        <label className="pp-fin-field">
          <span>Valor recebido</span>
          <input
            className="pp-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <small className="pp-meta">Falta pagar: {formatCents(remaining)}</small>
        </label>

        <label className="pp-fin-field">
          <span>Data</span>
          <input
            className="pp-input"
            type="date"
            value={paidOn}
            max={dayKey()}
            onChange={(e) => setPaidOn(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="pp-fin-field">
        <span>Como recebeu</span>
        <select
          className="pp-select"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        >
          {PAYMENT_METHODS.map((option) => (
            <option key={option} value={option}>
              {PAYMENT_METHOD_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <label className="pp-fin-field">
        <span>Observação (opcional)</span>
        <input
          className="pp-input"
          type="text"
          maxLength={200}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: pagou adiantado"
        />
      </label>

      {error ? <p className="pp-fin-error">{error}</p> : null}

      <div className="pp-quick-msg-actions">
        <button type="button" className="pp-btn pp-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="pp-btn pp-btn--primary" disabled={busy}>
          {busy ? "Registrando…" : "Confirmar pagamento"}
        </button>
      </div>
    </form>
  );
}
