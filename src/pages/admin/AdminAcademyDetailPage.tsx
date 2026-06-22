import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authFetch } from "../../services/apiClient";
import { API_URL, parseJson } from "../../services/apiBase";
import { assignAcademyOwner, searchUsers } from "../../services/academyApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AcademyDetail {
  id: number;
  slug: string;
  legal_name: string;
  display_name: string;
  status: string;
  created_at: string;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
}

interface TeamMember {
  user_id: number;
  name: string;
  email: string;
  phone?: string;
  role_slug: string;
  role_label: string;
  is_active: boolean;
  status: string;
  joined_at: string | null;
}

interface ResetResult {
  userId: number;
  name: string;
  email: string;
  tempPassword: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa", suspended: "Suspensa", cancelled: "Cancelada", trial: "Trial",
};
const STATUS_CLASS: Record<string, string> = {
  active: "badge badge-success", suspended: "badge badge-warn",
  cancelled: "badge badge-error", trial: "badge badge-info",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminAcademyDetailPage() {
  const { academyId } = useParams<{ academyId: string }>();
  const navigate = useNavigate();
  const id = Number(academyId);

  const [academy, setAcademy]   = useState<AcademyDetail | null>(null);
  const [team, setTeam]         = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Reset password
  const [resetResult, setResetResult]   = useState<ResetResult | null>(null);
  const [resetting, setResetting]       = useState<number | null>(null);

  // Change owner panel
  const [ownerPanelOpen, setOwnerPanelOpen]   = useState(false);
  const [ownerMode, setOwnerMode]             = useState<"existing" | "new">("existing");
  const [ownerSearchQ, setOwnerSearchQ]       = useState("");
  const [ownerUserId, setOwnerUserId]         = useState<number | undefined>();
  const [ownerUserLabel, setOwnerUserLabel]   = useState("");
  const [ownerName, setOwnerName]             = useState("");
  const [ownerEmail, setOwnerEmail]           = useState("");
  const [ownerCpf, setOwnerCpf]               = useState("");
  const [ownerPhone, setOwnerPhone]           = useState("");
  const [ownerSaving, setOwnerSaving]         = useState(false);
  const [ownerError, setOwnerError]           = useState<string | null>(null);
  const [ownerResult, setOwnerResult]         = useState<{ name: string; email: string; tempPassword?: string } | null>(null);
  const [suggestions, setSuggestions]         = useState<{ id: number; name: string; email: string }[]>([]);

  const load = useCallback(async () => {
    if (!id) { setError("ID inválido."); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res  = await authFetch(`${API_URL}/admin/academies/${id}`);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao carregar academia.");
      setAcademy(data.data.academy);
      setTeam(data.data.team ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Reset password ───────────────────────────────────────────────────────
  async function handleResetPassword(userId: number) {
    if (!confirm("Gerar nova senha temporária para este usuário?")) return;
    setResetting(userId);
    setResetResult(null);
    try {
      const res  = await authFetch(`${API_URL}/admin/users/${userId}/reset-password`, { method: "POST" });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao redefinir senha.");
      setResetResult(data.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(null);
    }
  }

  // ─── Change owner ─────────────────────────────────────────────────────────
  async function handleSearchOwner(q: string) {
    setOwnerSearchQ(q);
    setOwnerUserId(undefined);
    setOwnerUserLabel("");
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      setSuggestions(await searchUsers(q));
    } catch { /* ignore */ }
  }

  function selectUser(u: { id: number; name: string; email: string }) {
    setOwnerUserId(u.id);
    setOwnerUserLabel(`${u.name} (${u.email})`);
    setOwnerSearchQ(`${u.name} (${u.email})`);
    setSuggestions([]);
  }

  async function handleAssignOwner(e: React.FormEvent) {
    e.preventDefault();
    setOwnerError(null);
    if (ownerMode === "existing" && !ownerUserId) {
      setOwnerError("Selecione um usuário da lista."); return;
    }
    if (ownerMode === "new" && (!ownerName || !ownerEmail)) {
      setOwnerError("Nome e e-mail obrigatórios."); return;
    }

    const payload =
      ownerMode === "existing"
        ? { mode: "existing" as const, userId: ownerUserId }
        : { mode: "new" as const, name: ownerName, email: ownerEmail, cpf: ownerCpf || undefined, phone: ownerPhone || undefined };

    setOwnerSaving(true);
    try {
      const result = await assignAcademyOwner(id, payload);
      setOwnerResult({ name: result.name, email: result.email, tempPassword: result.tempPassword });
      setOwnerPanelOpen(false);
      resetOwnerForm();
      await load();
    } catch (err: any) {
      setOwnerError(err.message);
    } finally {
      setOwnerSaving(false);
    }
  }

  function resetOwnerForm() {
    setOwnerMode("existing"); setOwnerSearchQ(""); setOwnerUserId(undefined);
    setOwnerUserLabel(""); setOwnerName(""); setOwnerEmail("");
    setOwnerCpf(""); setOwnerPhone(""); setSuggestions([]);
  }

  // ─── Status change ────────────────────────────────────────────────────────
  async function handleStatus(status: string) {
    if (!confirm(`Alterar status da academia para "${STATUS_LABEL[status] ?? status}"?`)) return;
    try {
      const res  = await authFetch(`${API_URL}/admin/academies/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro.");
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-container">
        <div className="dash-skeleton-bar" style={{ height: 200, borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (error || !academy) {
    return (
      <div className="page-container">
        <div className="auth-error" role="alert">{error ?? "Academia não encontrada."}</div>
        <button className="btn btn-ghost" style={{ marginTop: "var(--space-4)" }} onClick={() => navigate(-1)}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-ghost"
            style={{ marginBottom: "var(--space-2)", padding: "0", fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}
            onClick={() => navigate("/app/admin/academies")}
          >
            ← Academias
          </button>
          <div className="dash-eyebrow">CoreFit</div>
          <h1 className="page-title">{academy.display_name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-1)" }}>
            <span className={STATUS_CLASS[academy.status] ?? "badge"}>{STATUS_LABEL[academy.status] ?? academy.status}</span>
            <code style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>{academy.slug}</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {academy.status === "active" && (
            <button className="btn btn-ghost" onClick={() => handleStatus("suspended")}>Suspender</button>
          )}
          {academy.status === "suspended" && (
            <button className="btn btn-ghost" onClick={() => handleStatus("active")}>Reativar</button>
          )}
        </div>
      </div>

      {/* Reset password result */}
      {resetResult && (
        <div className="card" style={{ marginBottom: "var(--space-5)", borderColor: "var(--color-success)", background: "var(--color-success-bg, #f0fdf4)" }}>
          <p style={{ margin: "0 0 var(--space-2) 0", fontWeight: 600 }}>
            Nova senha gerada para {resetResult.name} ({resetResult.email})
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <code style={{
              fontSize: "var(--text-lg)", letterSpacing: "0.14em",
              padding: "var(--space-2) var(--space-3)", background: "var(--color-bg)",
              borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
            }}>
              {resetResult.tempPassword}
            </code>
            <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(resetResult.tempPassword)}>
              Copiar
            </button>
          </div>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>
            Compartilhe por canal seguro. A senha é imediata — o login com a anterior não funcionará mais.
          </p>
          <button className="btn btn-sm btn-ghost" style={{ marginTop: "var(--space-3)" }} onClick={() => setResetResult(null)}>
            Fechar
          </button>
        </div>
      )}

      {/* Owner result after assign */}
      {ownerResult && (
        <div className="card" style={{ marginBottom: "var(--space-5)", borderColor: "var(--color-success)", background: "var(--color-success-bg, #f0fdf4)" }}>
          <p style={{ margin: "0 0 var(--space-1) 0", fontWeight: 600 }}>Dono atribuído: {ownerResult.name} ({ownerResult.email})</p>
          {ownerResult.tempPassword && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              <code style={{ fontSize: "var(--text-lg)", letterSpacing: "0.14em", padding: "var(--space-2) var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                {ownerResult.tempPassword}
              </code>
              <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(ownerResult.tempPassword!)}>Copiar</button>
            </div>
          )}
          <button className="btn btn-sm btn-ghost" style={{ marginTop: "var(--space-3)" }} onClick={() => setOwnerResult(null)}>Fechar</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-6)", alignItems: "start" }}>

        {/* Left col — owner + info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

          {/* Owner card */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="card-title">Dono da academia</h2>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => { setOwnerPanelOpen((o) => !o); setOwnerError(null); }}
              >
                {academy.owner_user_id ? "Trocar dono" : "Atribuir dono"}
              </button>
            </div>

            {ownerPanelOpen && (
              <form onSubmit={handleAssignOwner} noValidate style={{ marginBottom: "var(--space-4)" }}>
                {ownerError && <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>{ownerError}</div>}
                <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  {(["existing", "new"] as const).map((m) => (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", cursor: "pointer", fontSize: "var(--text-sm)" }}>
                      <input type="radio" name="owner-mode" checked={ownerMode === m} onChange={() => setOwnerMode(m)} />
                      {m === "existing" ? "Usuário existente" : "Criar novo"}
                    </label>
                  ))}
                </div>

                {ownerMode === "existing" && (
                  <div className="field" style={{ position: "relative" }}>
                    <label className="label">Buscar por nome ou e-mail</label>
                    <input className="input" placeholder="Digite…" value={ownerSearchQ}
                      onChange={(e) => handleSearchOwner(e.target.value)} autoComplete="off" />
                    {suggestions.length > 0 && (
                      <ul style={{
                        position: "absolute", zIndex: 10, background: "var(--color-surface)",
                        border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
                        listStyle: "none", padding: "var(--space-1)", margin: 0, width: "100%", top: "100%",
                      }}>
                        {suggestions.map((u) => (
                          <li key={u.id} onClick={() => selectUser(u)}
                            style={{ padding: "var(--space-2) var(--space-3)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}>
                            <strong style={{ fontSize: "var(--text-sm)" }}>{u.name}</strong>{" "}
                            <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)" }}>{u.email}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {ownerUserLabel && (
                      <span className="field-hint" style={{ color: "var(--color-success)" }}>Selecionado: {ownerUserLabel}</span>
                    )}
                  </div>
                )}

                {ownerMode === "new" && (
                  <>
                    <div className="field">
                      <label className="label">Nome *</label>
                      <input className="input" placeholder="Maria Silva" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label">E-mail *</label>
                      <input className="input" type="email" placeholder="maria@academia.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                      <div className="field">
                        <label className="label">CPF</label>
                        <input className="input" placeholder="000.000.000-00" value={ownerCpf} onChange={(e) => setOwnerCpf(e.target.value)} />
                      </div>
                      <div className="field">
                        <label className="label">Telefone</label>
                        <input className="input" placeholder="(11) 9 …" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                  <button type="submit" className="btn btn-primary" disabled={ownerSaving} aria-busy={ownerSaving}>
                    {ownerSaving ? "Salvando…" : "Confirmar"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setOwnerPanelOpen(false); resetOwnerForm(); }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {academy.owner_name ? (
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{academy.owner_name}</p>
                <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  {academy.owner_email}
                </p>
                {academy.owner_phone && (
                  <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>
                    {academy.owner_phone}
                  </p>
                )}
                <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={resetting === academy.owner_user_id}
                    onClick={() => handleResetPassword(academy.owner_user_id!)}
                  >
                    {resetting === academy.owner_user_id ? "Gerando…" : "Redefinir senha"}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
                Nenhum dono atribuído.
              </p>
            )}
          </div>

          {/* Info card */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Informações</h2></div>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)", margin: 0 }}>
              <dt style={{ color: "var(--color-text-tertiary)", fontWeight: 500 }}>Razão social</dt>
              <dd style={{ margin: 0 }}>{academy.legal_name}</dd>
              <dt style={{ color: "var(--color-text-tertiary)", fontWeight: 500 }}>Slug</dt>
              <dd style={{ margin: 0 }}><code>{academy.slug}</code></dd>
              <dt style={{ color: "var(--color-text-tertiary)", fontWeight: 500 }}>Criada em</dt>
              <dd style={{ margin: 0 }}>{new Date(academy.created_at).toLocaleDateString("pt-BR")}</dd>
              <dt style={{ color: "var(--color-text-tertiary)", fontWeight: 500 }}>Status</dt>
              <dd style={{ margin: 0 }}>
                <span className={STATUS_CLASS[academy.status] ?? "badge"}>{STATUS_LABEL[academy.status] ?? academy.status}</span>
              </dd>
            </dl>
          </div>
        </div>

        {/* Right col — team */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Equipe ({team.length})</h2>
          </div>

          {team.length === 0 ? (
            <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
              Nenhum membro ainda.
            </p>
          ) : (
            <div className="table-wrapper" style={{ margin: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.user_id} style={{ opacity: m.is_active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 500 }}>{m.name || "—"}</td>
                      <td style={{ color: "var(--color-text-secondary)" }}>{m.email}</td>
                      <td>{m.role_label}</td>
                      <td>
                        <span className={m.is_active ? "badge badge-success" : "badge"}>
                          {m.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled={resetting === m.user_id}
                          onClick={() => handleResetPassword(m.user_id)}
                        >
                          {resetting === m.user_id ? "Gerando…" : "Redefinir senha"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
