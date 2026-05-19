import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  fetchBillingPlans,
  createBillingPlan,
  deactivateBillingPlan,
  type BillingPlan,
  type BillingPeriod,
} from "../../services/personalBillingApi";

type Props = {
  onClose: () => void;
};

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BillingPlansModal({ onClose }: Props) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priceStr: "", period: "monthly" as BillingPeriod });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingPlans()
      .then((p) => setPlans(p.filter((x) => x.active)))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const priceCents = Math.round(parseFloat(form.priceStr.replace(",", ".")) * 100);
    if (!form.title || isNaN(priceCents) || priceCents <= 0) {
      setError("Título e valor são obrigatórios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createBillingPlan({
        title: form.title,
        description: form.description || undefined,
        priceCents,
        period: form.period,
      });
      setPlans((prev) => [created, ...prev]);
      setAdding(false);
      setForm({ title: "", description: "", priceStr: "", period: "monthly" });
    } catch (e: any) {
      setError(e.message || "Erro ao criar plano");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await deactivateBillingPlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // noop
    }
  }

  return (
    <div className="pp-quick-msg-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-quick-msg-modal" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="pp-quick-msg-title">Planos de cobrança</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Carregando...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plans.length === 0 && !adding && (
              <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
                Nenhum plano ativo. Crie um para começar a cobrar alunos.
              </p>
            )}
            {plans.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.title}</p>
                  <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 12 }}>
                    {formatBrl(p.priceCents)} · {PERIOD_LABELS[p.period]}
                  </p>
                </div>
                <button
                  onClick={() => handleDeactivate(p.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)", padding: 4 }}
                  title="Desativar plano"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="pp-quick-msg-textarea"
              style={{ minHeight: "auto", height: 36 }}
              placeholder="Nome do plano"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <input
              className="pp-quick-msg-textarea"
              style={{ minHeight: "auto", height: 36 }}
              placeholder="Descrição (opcional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="pp-quick-msg-textarea"
                style={{ minHeight: "auto", height: 36, flex: 1 }}
                placeholder="Valor (ex: 199,90)"
                value={form.priceStr}
                onChange={(e) => setForm((f) => ({ ...f, priceStr: e.target.value }))}
              />
              <select
                className="pp-quick-msg-textarea"
                style={{ minHeight: "auto", height: 36, flex: 1 }}
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as BillingPeriod }))}
              >
                {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {error && <p style={{ color: "var(--color-danger)", fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="pp-btn pp-btn--ghost" onClick={() => setAdding(false)} disabled={saving}>Cancelar</button>
              <button className="pp-btn pp-btn--primary" onClick={handleCreate} disabled={saving}>
                {saving ? "Salvando..." : "Criar plano"}
              </button>
            </div>
          </div>
        ) : (
          <button className="pp-btn pp-btn--ghost" onClick={() => setAdding(true)}>
            <Plus size={14} /> Novo plano
          </button>
        )}
      </div>
    </div>
  );
}
