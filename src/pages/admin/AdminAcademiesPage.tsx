import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../services/apiClient";
import { API_URL, parseJson } from "../../services/apiBase";
import { searchUsers, assignAcademyOwner } from "../../services/academyApi";

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
  owner_user_id?: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
}

interface OwnerForm {
  mode: "existing" | "new";
  // existing
  searchQ: string;
  userId?: number;
  userLabel?: string;
  // new
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

interface CreatedOwner {
  id: number;
  name: string;
  email: string;
  tempPassword?: string;
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

const EMPTY_OWNER: OwnerForm = {
  mode: "existing",
  searchQ: "",
  name: "",
  email: "",
  cpf: "",
  phone: "",
};

export default function AdminAcademiesPage() {
  const navigate = useNavigate();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Create form
  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState({ slug: "", legalName: "", displayName: "", primaryColor: "#22c55e" });
  const [ownerForm, setOwnerForm] = useState<OwnerForm>(EMPTY_OWNER);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [createdOwner, setCreatedOwner] = useState<CreatedOwner | null>(null);
  const [createdAcademy, setCreatedAcademy] = useState<Academy | null>(null);

  // Branding edit for existing academy
  const [brandingTargetId, setBrandingTargetId] = useState<number | null>(null);
  const [brandingColor, setBrandingColor]       = useState("#22c55e");
  const [brandingSaving, setBrandingSaving]     = useState(false);
  const [brandingError, setBrandingError]       = useState<string | null>(null);

  // Assign-owner to existing academy
  const [assignTargetId, setAssignTargetId] = useState<number | null>(null);
  const [assignForm, setAssignForm]         = useState<OwnerForm>(EMPTY_OWNER);
  const [assignError, setAssignError]       = useState<string | null>(null);
  const [assignSaving, setAssignSaving]     = useState(false);
  const [assignResult, setAssignResult]     = useState<CreatedOwner | null>(null);

  // User search suggestions
  const [suggestions, setSuggestions] = useState<{ id: number; name: string; email: string }[]>([]);
  const [assignSuggestions, setAssignSuggestions] = useState<{ id: number; name: string; email: string }[]>([]);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── User search for owner selector ──────────────────────────────────────
  async function handleSearchChange(q: string, target: "create" | "assign") {
    if (target === "create") {
      setOwnerForm((f) => ({ ...f, searchQ: q, userId: undefined, userLabel: undefined }));
    } else {
      setAssignForm((f) => ({ ...f, searchQ: q, userId: undefined, userLabel: undefined }));
    }
    if (q.length < 2) {
      if (target === "create") setSuggestions([]); else setAssignSuggestions([]);
      return;
    }
    try {
      const results = await searchUsers(q);
      if (target === "create") setSuggestions(results); else setAssignSuggestions(results);
    } catch {
      /* ignore */
    }
  }

  function selectUser(
    u: { id: number; name: string; email: string },
    target: "create" | "assign"
  ) {
    const label = `${u.name} (${u.email})`;
    if (target === "create") {
      setOwnerForm((f) => ({ ...f, searchQ: label, userId: u.id, userLabel: label }));
      setSuggestions([]);
    } else {
      setAssignForm((f) => ({ ...f, searchQ: label, userId: u.id, userLabel: label }));
      setAssignSuggestions([]);
    }
  }

  // ─── Create academy ───────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.slug || !form.legalName || !form.displayName) {
      setFormError("slug, Razão social e Nome de exibição são obrigatórios.");
      return;
    }

    const owner = buildOwnerPayload(ownerForm);

    setSaving(true);
    try {
      const res  = await authFetch(`${API_URL}/admin/academies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, owner }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao criar academia.");
      setCreatedAcademy(data.data.academy);
      setCreatedOwner(data.data.owner ?? null);
      setCreating(false);
      setForm({ slug: "", legalName: "", displayName: "", primaryColor: "#22c55e" });
      setOwnerForm(EMPTY_OWNER);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Update branding (primary color) for any academy ─────────────────────
  async function handleUpdateBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!brandingTargetId) return;
    setBrandingError(null);
    setBrandingSaving(true);
    try {
      const res  = await authFetch(`${API_URL}/admin/academies/${brandingTargetId}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: brandingColor }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar branding.");
      setBrandingTargetId(null);
      await load();
    } catch (err: any) {
      setBrandingError(err.message);
    } finally {
      setBrandingSaving(false);
    }
  }

  // ─── Assign owner to existing academy ────────────────────────────────────
  async function handleAssignOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTargetId) return;
    setAssignError(null);

    const payload = buildOwnerPayload(assignForm);
    if (!payload) {
      setAssignError("Preencha os dados do dono.");
      return;
    }

    setAssignSaving(true);
    try {
      const result = await assignAcademyOwner(assignTargetId, payload);
      setAssignResult(result);
      setAssignTargetId(null);
      setAssignForm(EMPTY_OWNER);
      await load();
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssignSaving(false);
    }
  }

  function buildOwnerPayload(f: OwnerForm) {
    if (f.mode === "existing") {
      if (!f.userId) return null;
      return { mode: "existing" as const, userId: f.userId };
    }
    if (!f.name || !f.email) return null;
    return {
      mode: "new" as const,
      name: f.name,
      email: f.email,
      cpf: f.cpf || undefined,
      phone: f.phone || undefined,
    };
  }

  // ─── Status ───────────────────────────────────────────────────────────────
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

  // ─── Owner form component ─────────────────────────────────────────────────
  function renderOwnerBlock(
    f: OwnerForm,
    setF: React.Dispatch<React.Dispatch<OwnerForm>>,
    target: "create" | "assign",
    sugList: { id: number; name: string; email: string }[]
  ) {
    return (
      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", marginTop: "var(--space-5)" }}>
        <legend style={{ padding: "0 var(--space-2)", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
          Dono da academia (opcional)
        </legend>
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", cursor: "pointer" }}>
            <input
              type="radio"
              name={`owner-mode-${target}`}
              checked={f.mode === "existing"}
              onChange={() => setF((prev: OwnerForm) => ({ ...prev, mode: "existing" }))}
            /> Usuário existente
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", cursor: "pointer" }}>
            <input
              type="radio"
              name={`owner-mode-${target}`}
              checked={f.mode === "new"}
              onChange={() => setF((prev: OwnerForm) => ({ ...prev, mode: "new" }))}
            /> Criar novo dono
          </label>
        </div>

        {f.mode === "existing" && (
          <div className="field" style={{ position: "relative" }}>
            <label className="label">Buscar por email ou nome</label>
            <input
              className="input"
              placeholder="Digite email ou nome…"
              value={f.searchQ}
              onChange={(e) => handleSearchChange(e.target.value, target)}
              autoComplete="off"
            />
            {sugList.length > 0 && (
              <ul style={{
                position: "absolute", zIndex: 10, background: "var(--color-surface)",
                border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
                listStyle: "none", padding: "var(--space-1)", margin: 0, width: "100%", top: "100%",
              }}>
                {sugList.map((u) => (
                  <li
                    key={u.id}
                    onClick={() => selectUser(u, target)}
                    style={{ padding: "var(--space-2) var(--space-3)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
                    className="list-item-hover"
                  >
                    <strong>{u.name}</strong> <span style={{ color: "var(--color-text-tertiary)" }}>{u.email}</span>
                  </li>
                ))}
              </ul>
            )}
            {f.userLabel && (
              <span className="field-hint" style={{ color: "var(--color-success)" }}>Selecionado: {f.userLabel}</span>
            )}
          </div>
        )}

        {f.mode === "new" && (
          <>
            <div className="field">
              <label className="label">Nome completo *</label>
              <input className="input" placeholder="Maria Silva" value={f.name} onChange={(e) => setF((prev: OwnerForm) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">E-mail *</label>
              <input className="input" type="email" placeholder="maria@academia.com" value={f.email} onChange={(e) => setF((prev: OwnerForm) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div className="field">
                <label className="label">CPF</label>
                <input className="input" placeholder="000.000.000-00" value={f.cpf} onChange={(e) => setF((prev: OwnerForm) => ({ ...prev, cpf: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Telefone</label>
                <input className="input" placeholder="(11) 9 0000-0000" value={f.phone} onChange={(e) => setF((prev: OwnerForm) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>
          </>
        )}
      </fieldset>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">CoreFit</div>
          <h1 className="page-title">Academias</h1>
          <p className="page-subtitle">Gerencie os tenants da plataforma.</p>
        </div>
        {!creating && (
          <button className="btn btn-primary" onClick={() => { setCreating(true); setCreatedOwner(null); setCreatedAcademy(null); }}>
            Nova academia
          </button>
        )}
      </div>

      {/* Created owner success banner */}
      {createdOwner && (
        <div className="card" style={{ marginBottom: "var(--space-5)", borderColor: "var(--color-success)", background: "var(--color-success-bg, #f0fdf4)" }}>
          <div className="card-header" style={{ paddingBottom: "var(--space-2)" }}>
            <h3 className="card-title" style={{ color: "var(--color-success)" }}>
              Academia "{createdAcademy?.display_name}" criada com sucesso
            </h3>
          </div>
          <p style={{ margin: 0 }}>
            <strong>Dono:</strong> {createdOwner.name} ({createdOwner.email})
          </p>
          {createdOwner.tempPassword && (
            <div style={{ marginTop: "var(--space-3)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
              <p style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--text-sm)", fontWeight: 600 }}>Senha temporária (compartilhe por canal seguro):</p>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <code style={{ fontSize: "var(--text-base)", letterSpacing: "0.12em", padding: "var(--space-1) var(--space-2)", background: "var(--color-bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                  {createdOwner.tempPassword}
                </code>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => navigator.clipboard.writeText(createdOwner.tempPassword!)}
                >
                  Copiar
                </button>
              </div>
            </div>
          )}
          <button className="btn btn-sm btn-ghost" style={{ marginTop: "var(--space-3)" }} onClick={() => setCreatedOwner(null)}>
            Fechar
          </button>
        </div>
      )}

      {/* Assign-owner result banner */}
      {assignResult && (
        <div className="card" style={{ marginBottom: "var(--space-5)", borderColor: "var(--color-success)", background: "var(--color-success-bg, #f0fdf4)" }}>
          <p style={{ margin: 0 }}>
            <strong>Dono atribuído:</strong> {assignResult.name} ({assignResult.email})
          </p>
          {assignResult.tempPassword && (
            <div style={{ marginTop: "var(--space-3)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
              <p style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--text-sm)", fontWeight: 600 }}>Senha temporária:</p>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <code style={{ fontSize: "var(--text-base)", letterSpacing: "0.12em", padding: "var(--space-1) var(--space-2)", background: "var(--color-bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                  {assignResult.tempPassword}
                </code>
                <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(assignResult.tempPassword!)}>
                  Copiar
                </button>
              </div>
            </div>
          )}
          <button className="btn btn-sm btn-ghost" style={{ marginTop: "var(--space-3)" }} onClick={() => setAssignResult(null)}>
            Fechar
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="card" style={{ marginBottom: "var(--space-6)", maxWidth: 560 }}>
          <div className="card-header">
            <h2 className="card-title">Nova academia</h2>
          </div>
          <form onSubmit={handleCreate} noValidate>
            {formError && (
              <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>{formError}</div>
            )}
            <div className="field">
              <label className="label" htmlFor="ac-slug">Slug</label>
              <input id="ac-slug" className="input" placeholder="ex: fit-center-sp" value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} disabled={saving} />
              <span className="field-hint">Identificador único — apenas letras minúsculas, números e hífens.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="ac-legal">Razão social</label>
              <input id="ac-legal" className="input" placeholder="ex: Fit Center Ltda" value={form.legalName}
                onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} disabled={saving} />
            </div>
            <div className="field">
              <label className="label" htmlFor="ac-display">Nome de exibição</label>
              <input id="ac-display" className="input" placeholder="ex: Fit Center SP" value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} disabled={saving} />
            </div>
            <div className="field">
              <label className="label" htmlFor="ac-color">Cor primária</label>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <input id="ac-color" type="color" value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  disabled={saving}
                  style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }} />
                <input className="input" style={{ flex: 1 }} placeholder="#22c55e" value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} disabled={saving} />
              </div>
              <span className="field-hint">Define as cores do subdomínio da academia (ex: botões, links).</span>
            </div>

            {renderOwnerBlock(ownerForm, setOwnerForm as any, "create", suggestions)}

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
              <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                {saving ? "Criando…" : "Criar academia"}
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={() => { setCreating(false); setFormError(null); setOwnerForm(EMPTY_OWNER); setSuggestions([]); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign-owner modal for existing academy */}
      {assignTargetId !== null && (
        <div className="card" style={{ marginBottom: "var(--space-6)", maxWidth: 560, borderColor: "var(--color-primary)" }}>
          <div className="card-header">
            <h2 className="card-title">Atribuir dono</h2>
          </div>
          <form onSubmit={handleAssignOwner} noValidate>
            {assignError && <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>{assignError}</div>}
            {renderOwnerBlock(assignForm, setAssignForm as any, "assign", assignSuggestions)}
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button type="submit" className="btn btn-primary" disabled={assignSaving} aria-busy={assignSaving}>
                {assignSaving ? "Salvando…" : "Atribuir dono"}
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={() => { setAssignTargetId(null); setAssignForm(EMPTY_OWNER); setAssignError(null); setAssignSuggestions([]); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="dash-skeleton-bar" style={{ height: 48, borderRadius: "var(--radius-md)", maxWidth: "100%" }} />
      )}
      {error && !loading && <div className="auth-error" role="alert">{error}</div>}
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
                <th>Dono</th>
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
                        <img src={a.logo_url} alt="" width={28} height={28}
                          style={{ borderRadius: "var(--radius-sm)", objectFit: "cover" }} />
                      ) : (
                        <span style={{
                          width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: a.primary_color ?? "var(--color-primary-soft)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "var(--color-primary)", flexShrink: 0,
                        }}>
                          {a.display_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span style={{ fontWeight: 500 }}>{a.display_name}</span>
                    </div>
                  </td>
                  <td><code style={{ fontSize: "var(--text-sm)" }}>{a.slug}</code></td>
                  <td>
                    {a.owner_name
                      ? <span>{a.owner_name}</span>
                      : (
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ color: "var(--color-warning)" }}
                          onClick={() => { setAssignTargetId(a.id); setAssignResult(null); }}
                        >
                          Definir dono
                        </button>
                      )
                    }
                  </td>
                  <td>{a.member_count ?? 0}</td>
                  <td><span className={STATUS_CLASS[a.status] ?? "badge"}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => navigate(`/app/admin/academies/${a.id}`)}
                      >
                        Detalhes
                      </button>
                      {a.status === "active" && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleStatus(a.id, "suspended")}>
                          Suspender
                        </button>
                      )}
                      {a.status === "suspended" && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleStatus(a.id, "active")}>
                          Reativar
                        </button>
                      )}
                      {a.owner_name && (
                        <button className="btn btn-sm btn-ghost"
                          onClick={() => { setAssignTargetId(a.id); setAssignResult(null); }}>
                          Trocar dono
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-ghost"
                        title="Editar cor primária"
                        onClick={() => { setBrandingTargetId(a.id); setBrandingColor(a.primary_color ?? "#22c55e"); setBrandingError(null); }}
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: a.primary_color ?? "var(--color-primary)", display: "inline-block", border: "1px solid var(--color-border)" }} />
                        Cor
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline branding color editor */}
      {brandingTargetId !== null && (
        <div className="card" style={{ marginTop: "var(--space-5)", maxWidth: 380, borderColor: "var(--color-primary)" }}>
          <div className="card-header">
            <h2 className="card-title">Cor primária da academia</h2>
          </div>
          <form onSubmit={handleUpdateBranding} noValidate>
            {brandingError && <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>{brandingError}</div>}
            <div className="field">
              <label className="label">Cor primária</label>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <input type="color" value={brandingColor} onChange={(e) => setBrandingColor(e.target.value)} disabled={brandingSaving}
                  style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }} />
                <input className="input" style={{ flex: 1 }} value={brandingColor}
                  onChange={(e) => setBrandingColor(e.target.value)} disabled={brandingSaving} placeholder="#22c55e" />
              </div>
              <span className="field-hint">Aplicada automaticamente no subdomínio da academia.</span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={brandingSaving} aria-busy={brandingSaving}>
                {brandingSaving ? "Salvando…" : "Salvar cor"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBrandingTargetId(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
