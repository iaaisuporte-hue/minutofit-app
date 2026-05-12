import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "../../components/EmptyState";
import {
  fetchPlans,
  createPlan,
  updatePlan,
  archivePlan,
  type AcademyPlan,
} from "../../services/academyApi";

interface PlanForm {
  name: string;
  description: string;
  monthlyPrice: string;
  billingCycleDays: string;
}

const DEFAULT_FORM: PlanForm = { name: "", description: "", monthlyPrice: "", billingCycleDays: "30" };

export default function AcademyPlansPage() {
  const [plans, setPlans]           = useState<AcademyPlan[]>([]);
  const [showArchived, setArchived] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [form, setForm]             = useState<PlanForm>(DEFAULT_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [archiving, setArchiving]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await fetchPlans(true));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startCreate() { setForm(DEFAULT_FORM); setEditingId(null); setError(""); setShowForm(true); }

  function startEdit(plan: AcademyPlan) {
    setForm({
      name:             plan.name,
      description:      plan.description ?? "",
      monthlyPrice:     String(plan.monthlyPrice),
      billingCycleDays: String(plan.billingCycleDays),
    });
    setEditingId(plan.id);
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const price = Number(form.monthlyPrice);
    if (isNaN(price) || price < 0) { setError("Preço inválido."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updatePlan(editingId, {
          name: form.name || undefined,
          description: form.description || undefined,
          monthlyPrice: price,
          billingCycleDays: Number(form.billingCycleDays) || undefined,
        });
        setSuccess("Plano atualizado.");
      } else {
        await createPlan({
          name: form.name,
          description: form.description || undefined,
          monthlyPrice: price,
          billingCycleDays: Number(form.billingCycleDays) || 30,
        });
        setSuccess("Plano criado.");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(planId: number) {
    if (!confirm("Arquivar este plano? Matrículas existentes não serão afetadas.")) return;
    setArchiving(planId);
    setError("");
    try {
      await archivePlan(planId);
      setSuccess("Plano arquivado.");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(null);
    }
  }

  const activePlans   = plans.filter((p) => p.status === "active");
  const archivedPlans = plans.filter((p) => p.status === "archived");

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Academia</div>
          <h1 className="page-title">Planos</h1>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>+ Novo plano</button>
      </div>

      {success && <div className="banner-success">{success}</div>}
      {error   && <div className="banner-error">{error}</div>}

      {/* Inline form */}
      {showForm && (
        <div className="section-card">
          <h2 className="section-card__title" style={{ marginBottom: "var(--space-4)" }}>
            {editingId ? "Editar plano" : "Novo plano"}
          </h2>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field">
              <label className="label">Nome <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <input
                className="input" required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Mensal Premium"
              />
            </div>
            <div className="form-grid form-grid--2col">
              <div className="field">
                <label className="label">Preço/mês (R$) <span style={{ color: "var(--color-danger)" }}>*</span></label>
                <input
                  className="input" required type="number" min="0" step="0.01"
                  value={form.monthlyPrice}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="field">
                <label className="label">Ciclo (dias)</label>
                <input
                  className="input" type="number" min="1"
                  value={form.billingCycleDays}
                  onChange={(e) => setForm((f) => ({ ...f, billingCycleDays: e.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label className="label">Descrição</label>
              <textarea
                className="input" rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Benefícios, acesso, condições..."
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar plano"}
              </button>
              <button
                type="button" className="btn btn-ghost"
                onClick={() => { setShowForm(false); setEditingId(null); setError(""); }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plans list */}
      {loading ? (
        <div className="dash-section">
          <div className="dash-skeleton">
            {[1, 2].map((i) => <div key={i} className="dash-skeleton-bar" style={{ height: 48 }} />)}
          </div>
        </div>
      ) : activePlans.length === 0 && !showForm ? (
        <div className="section-card">
          <EmptyState
            eyebrow="Planos da academia"
            title="Nenhum plano configurado ainda"
            description="Crie o primeiro plano para definir ciclos de cobrança e começar a matricular alunos. Os dados de adesão e receita aparecerão após as primeiras matrículas."
            action={
              <button className="btn btn-primary" onClick={startCreate}>Criar primeiro plano</button>
            }
          />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preço/mês</th>
                <th>Ciclo</th>
                <th>Descrição</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activePlans.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: "var(--font-semibold)" }}>{p.name}</td>
                  <td>R$ {Number(p.monthlyPrice).toFixed(2)}</td>
                  <td className="small">{p.billingCycleDays} dias</td>
                  <td>
                    <span className="muted small" style={{ maxWidth: 220, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.description || "—"}
                    </span>
                  </td>
                  <td><span className="badge badge-success">Ativo</span></td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => startEdit(p)}>Editar</button>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ color: "var(--color-text-subtle)" }}
                        disabled={archiving === p.id}
                        onClick={() => handleArchive(p.id)}
                      >
                        {archiving === p.id ? "..." : "Arquivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archived */}
      {archivedPlans.length > 0 && (
        <div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--color-text-muted)" }}
            onClick={() => setArchived((v) => !v)}
          >
            {showArchived ? "Ocultar arquivados" : `${archivedPlans.length} plano(s) arquivado(s)`}
          </button>
          {showArchived && (
            <div className="table-wrapper" style={{ marginTop: "var(--space-3)", opacity: 0.7 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Preço/mês</th>
                    <th>Ciclo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedPlans.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>R$ {Number(p.monthlyPrice).toFixed(2)}</td>
                      <td className="small">{p.billingCycleDays} dias</td>
                      <td><span className="badge">Arquivado</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
