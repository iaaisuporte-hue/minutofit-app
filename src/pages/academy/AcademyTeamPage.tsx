import { useState, useEffect } from "react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import {
  fetchTeam,
  addMemberDirect,
  inviteMember,
  updateMember,
  fetchInvitations,
  revokeInvitation,
  fetchAcademyAudit,
  type TeamMember,
  type PendingInvitation,
  type AcademyAuditRow,
} from "../../services/academyApi";

const ROLE_OPTIONS = [
  { value: "academy_owner",     label: "Dono" },
  { value: "academy_manager",   label: "Gestor" },
  { value: "academy_finance",   label: "Financeiro" },
  { value: "academy_reception", label: "Recepção" },
  { value: "academy_personal",  label: "Personal" },
  { value: "academy_nutri",     label: "Nutri" },
];

const ROLE_GROUP_ORDER = [
  "academy_owner",
  "academy_manager",
  "academy_finance",
  "academy_reception",
  "academy_personal",
  "academy_nutri",
  "academy_student",
];

type Tab = "team" | "invitations" | "history";

const ACTION_LABELS: Record<string, string> = {
  "student.enroll":       "Aluno matriculado",
  "student.pause":        "Aluno pausado",
  "student.cancel":       "Aluno cancelado",
  "student.reactivate":   "Aluno reativado",
  "student.password_reset": "Senha redefinida",
  "team.add_member":      "Membro adicionado",
  "team.role_update":     "Papel atualizado",
  "team.remove_member":   "Membro removido",
  "invitation.create":    "Convite enviado",
  "invitation.revoke":    "Convite revogado",
  "invitation.accept":    "Convite aceito",
  "branding.update":      "Identidade visual atualizada",
  "auth.switch_academy":  "Academia acessada",
};

const ACTION_DOT: Record<string, string> = {
  "student.enroll":     "var(--color-success)",
  "student.reactivate": "var(--color-success)",
  "invitation.accept":  "var(--color-success)",
  "team.add_member":    "var(--color-info)",
  "invitation.create":  "var(--color-info)",
  "branding.update":    "var(--color-info)",
  "student.pause":      "var(--color-warn)",
  "student.cancel":     "var(--color-danger)",
  "team.remove_member": "var(--color-danger)",
  "invitation.revoke":  "var(--color-danger)",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  const h    = Math.floor(diff / 3_600_000);
  const d    = Math.floor(diff / 86_400_000);
  if (min < 2)  return "agora";
  if (min < 60) return `há ${min}min`;
  if (h < 24)   return `há ${h}h`;
  if (d < 30)   return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function AcademyTeamPage() {
  const [tab, setTab] = useState<Tab>("team");
  const [members, setMembers]         = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [auditRows, setAuditRows]     = useState<AcademyAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Add-member panel
  const [panelOpen, setPanelOpen]   = useState(false);
  const [mode, setMode]             = useState<"direct" | "invite">("direct");
  const [roleSlug, setRoleSlug]     = useState("academy_reception");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [cpf, setCpf]               = useState("");
  const [phone, setPhone]           = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelSaving, setPanelSaving] = useState(false);
  const [result, setResult]         = useState<{ tempPassword?: string; inviteUrl?: string } | null>(null);

  // Inline role edit
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, inv] = await Promise.all([fetchTeam(), fetchInvitations()]);
      setMembers(m);
      setInvitations(inv);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== "history" || auditRows.length > 0) return;
    setAuditLoading(true);
    fetchAcademyAudit(50, 0)
      .then(setAuditRows)
      .catch(() => setAuditRows([]))
      .finally(() => setAuditLoading(false));
  }, [tab, auditRows.length]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPanelError(null);
    if (!email) { setPanelError("E-mail obrigatório."); return; }
    if (mode === "direct" && !name) { setPanelError("Nome obrigatório para cadastro direto."); return; }

    setPanelSaving(true);
    try {
      if (mode === "direct") {
        const res = await addMemberDirect({ roleSlug, name, email, cpf: cpf || undefined, phone: phone || undefined });
        setResult({ tempPassword: res.tempPassword });
      } else {
        const res = await inviteMember({ roleSlug, email });
        setResult({ inviteUrl: res.inviteUrl });
      }
      await load();
      setName(""); setEmail(""); setCpf(""); setPhone("");
    } catch (err: any) {
      setPanelError(err.message);
    } finally {
      setPanelSaving(false);
    }
  }

  async function handleToggleActive(m: TeamMember) {
    if (!confirm(`${m.isActive ? "Desativar" : "Reativar"} ${m.name}?`)) return;
    try {
      await updateMember(m.userId, { isActive: !m.isActive });
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    try {
      await updateMember(userId, { roleSlug: newRole });
      setEditingUserId(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm("Revogar este convite?")) return;
    try {
      await revokeInvitation(id);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Group members by role
  const grouped = ROLE_GROUP_ORDER.map((slug) => ({
    slug,
    label: ROLE_OPTIONS.find((r) => r.value === slug)?.label ?? slug,
    members: members.filter((m) => m.roleSlug === slug),
  })).filter((g) => g.members.length > 0);

  const pendingCount = invitations.filter((i) => !i.acceptedAt && new Date(i.expiresAt) > new Date()).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Academia</div>
          <h1 className="page-title">Equipe</h1>
          <p className="page-subtitle">
            {members.length} {members.length === 1 ? "membro" : "membros"} &middot;{" "}
            {pendingCount} {pendingCount === 1 ? "convite pendente" : "convites pendentes"}
          </p>
        </div>
        {!panelOpen && (
          <button className="btn btn-primary" onClick={() => { setPanelOpen(true); setResult(null); setPanelError(null); }}>
            Adicionar membro
          </button>
        )}
      </div>

      {/* Result banner */}
      {result && (
        <div className="card" style={{ marginBottom: "var(--space-5)", borderColor: "var(--color-success)", background: "var(--color-success-soft)" }}>
          {result.tempPassword && (
            <>
              <p style={{ margin: "0 0 var(--space-2) 0", fontWeight: 600 }}>Membro cadastrado. Compartilhe a senha por canal seguro:</p>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <code style={{ fontSize: "var(--text-base)", letterSpacing: "0.12em", padding: "var(--space-1) var(--space-2)", background: "var(--color-bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                  {result.tempPassword}
                </code>
                <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(result.tempPassword!)}>
                  Copiar
                </button>
              </div>
            </>
          )}
          {result.inviteUrl && (
            <>
              <p style={{ margin: "0 0 var(--space-2) 0", fontWeight: 600 }}>Convite criado. Compartilhe o link:</p>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <code style={{ fontSize: "var(--text-sm)", padding: "var(--space-1) var(--space-2)", background: "var(--color-bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", wordBreak: "break-all" }}>
                  {result.inviteUrl}
                </code>
                <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(result.inviteUrl!)}>
                  Copiar
                </button>
              </div>
            </>
          )}
          <button className="btn btn-sm btn-ghost" style={{ marginTop: "var(--space-3)" }} onClick={() => setResult(null)}>
            Fechar
          </button>
        </div>
      )}

      {/* Add member panel */}
      {panelOpen && (
        <div className="card" style={{ marginBottom: "var(--space-6)", maxWidth: 500 }}>
          <div className="card-header">
            <h2 className="card-title">Adicionar membro</h2>
          </div>
          <form onSubmit={handleAdd} noValidate>
            {panelError && <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>{panelError}</div>}

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              {(["direct", "invite"] as const).map((m) => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", cursor: "pointer" }}>
                  <input type="radio" name="mode" checked={mode === m} onChange={() => { setMode(m); setPanelError(null); }} />
                  {m === "direct" ? "Cadastro direto" : "Convite por link"}
                </label>
              ))}
            </div>

            <div className="field">
              <label className="label">Papel</label>
              <select className="input" value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {mode === "direct" && (
              <div className="field">
                <label className="label">Nome completo *</label>
                <input className="input" placeholder="João da Silva" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label className="label">E-mail *</label>
              <input className="input" type="email" placeholder="joao@academia.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {mode === "direct" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label className="label">CPF</label>
                  <input className="input" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Telefone</label>
                  <input className="input" placeholder="(11) 9 0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button type="submit" className="btn btn-primary" disabled={panelSaving} aria-busy={panelSaving}>
                {panelSaving ? "Enviando…" : mode === "direct" ? "Cadastrar" : "Enviar convite"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setPanelOpen(false); setPanelError(null); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
        {(["team", "invitations", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "var(--space-2) var(--space-4)",
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--color-primary)" : "var(--color-text-secondary)",
              borderBottom: tab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: -1, transition: "color .15s",
            }}
          >
            {t === "team"        ? "Membros"
             : t === "invitations" ? `Convites${pendingCount > 0 ? ` (${pendingCount})` : ""}`
             : "Histórico"}
          </button>
        ))}
      </div>

      {loading && <div className="dash-skeleton-bar" style={{ height: 100, borderRadius: "var(--radius-md)" }} />}
      {error && <div className="auth-error" role="alert">{error}</div>}

      {/* Members tab */}
      {!loading && tab === "team" && (
        <>
          {grouped.length === 0 ? (
            <EmptyState
              variant="ok"
              title="Equipe pronta para crescer"
              description="Convide o primeiro membro da equipe por e-mail. Os papéis (personal, nutricionista, recepção) aparecem após o aceite do convite."
            />
          ) : (
            grouped.map((group) => (
              <div key={group.slug} style={{ marginBottom: "var(--space-6)" }}>
                <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-2)" }}>
                  {group.label} ({group.members.length})
                </h3>
                <div className="table-wrapper">
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
                      {group.members.map((m) => (
                        <tr key={m.userId} style={{ opacity: m.isActive ? 1 : 0.5 }}>
                          <td style={{ fontWeight: 500 }}>{m.name || "—"}</td>
                          <td style={{ color: "var(--color-text-secondary)" }}>{m.email}</td>
                          <td>
                            {editingUserId === m.userId ? (
                              <select
                                className="input"
                                style={{ padding: "2px 4px", fontSize: "var(--text-sm)" }}
                                defaultValue={m.roleSlug}
                                onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                                onBlur={() => setEditingUserId(null)}
                                autoFocus
                              >
                                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            ) : (
                              <span
                                style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                                title="Clique para editar papel"
                                onClick={() => setEditingUserId(m.userId)}
                              >
                                {m.roleLabel}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={m.isActive ? "badge badge-success" : "badge"}>
                              {m.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleToggleActive(m)}
                            >
                              {m.isActive ? "Desativar" : "Reativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Invitations tab */}
      {!loading && tab === "invitations" && (
        <>
          {invitations.length === 0 ? (
            <EmptyState
              variant="ok"
              title="Nenhum convite pendente"
              description="Use o formulário acima para convidar membros da equipe. Os convites aceitos aparecem na aba Time."
            />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Expira em</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => {
                    const expired  = new Date(inv.expiresAt) < new Date();
                    const accepted = !!inv.acceptedAt;
                    const status   = accepted ? "Aceito" : expired ? "Expirado" : "Pendente";
                    const cls      = accepted ? "badge badge-success" : expired ? "badge badge-error" : "badge badge-info";
                    return (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td>{inv.roleLabel}</td>
                        <td style={{ color: expired ? "var(--color-danger)" : undefined }}>
                          {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td><span className={cls}>{status}</span></td>
                        <td>
                          {!accepted && (
                            <button className="btn btn-sm btn-ghost" onClick={() => handleRevoke(inv.id)}>
                              Revogar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {tab === "history" && (
        <>
          {auditLoading && <LoadingSkeleton variant="list" lines={6} />}
          {!auditLoading && auditRows.length === 0 && (
            <EmptyState
              eyebrow="Histórico de ações"
              title="Nenhuma ação registrada ainda"
              description="Toda alteração feita na academia — matrículas, convites, edições de equipe — aparece aqui como linha do tempo."
            />
          )}
          {!auditLoading && auditRows.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              {auditRows.map((row) => (
                <li key={row.id} style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-border)",
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: 8, height: 8,
                    borderRadius: "50%",
                    marginTop: 6,
                    background: ACTION_DOT[row.action] ?? "var(--color-text-muted)",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                    {row.meta && (row.meta as any).email && (
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", marginLeft: 4 }}>
                        · {(row.meta as any).email}
                      </span>
                    )}
                    {row.meta && (row.meta as any).name && (
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", marginLeft: 4 }}>
                        · {(row.meta as any).name}
                      </span>
                    )}
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>
                      {timeAgo(row.created_at)}
                      {row.actor_name && <span> · por {row.actor_name}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
