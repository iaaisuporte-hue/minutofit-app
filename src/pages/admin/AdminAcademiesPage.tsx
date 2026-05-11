import { useState, useEffect } from "react";
import { authFetch } from "../../services/apiClient";
import { API_URL, parseJson } from "../../services/apiBase";

interface Academy {
  id: number;
  slug: string;
  legal_name: string;
  display_name: string;
  status: string;
  created_at: string;
  member_count: string;
  logo_url?: string;
  primary_color?: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  trial: "Trial",
};

const STATUS_CLASS: Record<string, string> = {
  active: "badge badge-success",
  suspended: "badge badge-warn",
  cancelled: "badge badge-error",
  trial: "badge badge-info",
};

export default function AdminAcademiesPage() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState({ slug: "", legalName: "", displayName: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await authFetch(`${API_URL}/admin/academies`);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao carregar academias.");
      setAcademies(data.data.academies ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.slug || !form.legalName || !form.displayName) {
      setFormError("Todos os campos são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const res  = await authFetch(`${API_URL}/admin/academies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao criar academia.");
      setCreating(false);
      setForm({ slug: "", legalName: "", displayName: "" });
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: number, status: string) {
    try {
      const res  = await authFetch(`${API_URL}/admin/academies/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao atualizar status.");
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">MetaCore</div>
          <h1 className="page-title">Academias</h1>
          <p className="page-subtitle">Gerencie os tenants da plataforma.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          Nova academia
        </button>
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: "var(--space-6)", maxWidth: 520 }}>
          <div className="card-header">
            <h2 className="card-title">Nova academia</h2>
          </div>
          <form onSubmit={handleCreate} noValidate>
            {formError && (
              <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
                {formError}
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="ac-slug">Slug</label>
              <input
                id="ac-slug"
                className="input"
                placeholder="ex: fit-center-sp"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                disabled={saving}
              />
              <span className="field-hint">Identificador único. Apenas letras, números e hífens.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="ac-legal">Razão social</label>
              <input
                id="ac-legal"
                className="input"
                placeholder="ex: Fit Center Ltda"
                value={form.legalName}
                onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="ac-display">Nome de exibição</label>
              <input
                id="ac-display"
                className="input"
                placeholder="ex: Fit Center SP"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                {saving ? "Criando…" : "Criar academia"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); setFormError(null); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="dash-skeleton-bar" style={{ height: 48, borderRadius: "var(--radius-md)", maxWidth: "100%" }} />
      )}

      {error && !loading && (
        <div className="auth-error" role="alert">{error}</div>
      )}

      {!loading && !error && academies.length === 0 && (
        <div className="dash-alert-empty--ok">
          <span className="dash-alert-ok-signal" />
          <span className="dash-alert-ok-detail">Nenhuma academia cadastrada ainda.</span>
        </div>
      )}

      {!loading && academies.length > 0 && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Academia</th>
                <th>Slug</th>
                <th>Membros</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {academies.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      {a.logo_url ? (
                        <img src={a.logo_url} alt="" width={28} height={28} style={{ borderRadius: "var(--radius-sm)", objectFit: "cover" }} />
                      ) : (
                        <span
                          style={{
                            width: 28, height: 28, borderRadius: "var(--radius-sm)",
                            background: a.primary_color ?? "var(--color-primary-soft)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "var(--color-primary)", flexShrink: 0,
                          }}
                        >
                          {a.display_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span style={{ fontWeight: 500 }}>{a.display_name}</span>
                    </div>
                  </td>
                  <td><code style={{ fontSize: "var(--text-sm)" }}>{a.slug}</code></td>
                  <td>{a.member_count ?? 0}</td>
                  <td><span className={STATUS_CLASS[a.status] ?? "badge"}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      {a.status === "active" && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleStatus(a.id, "suspended")}
                        >
                          Suspender
                        </button>
                      )}
                      {a.status === "suspended" && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleStatus(a.id, "active")}
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
