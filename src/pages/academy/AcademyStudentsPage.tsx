import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "../../components/EmptyState";
import { useNavigate } from "react-router-dom";
import {
  fetchStudents,
  fetchPlans,
  addStudentDirect,
  inviteStudent,
  type Student,
  type StudentsStats,
  type AcademyPlan,
} from "../../services/academyApi";

const STATUS_LABELS: Record<string, string> = {
  lead:      "Lead",
  active:    "Ativo",
  overdue:   "Em risco",
  paused:    "Pausado",
  cancelled: "Cancelado",
};

const STATUS_BADGE: Record<string, string> = {
  lead:      "badge badge-info",
  active:    "badge badge-success",
  overdue:   "badge badge-warn",
  paused:    "badge",
  cancelled: "badge badge-danger",
};

const PAYMENT_OPTIONS = [
  { value: "",              label: "Selecionar"         },
  { value: "pix_monthly",   label: "PIX mensal"         },
  { value: "cash_monthly",  label: "Dinheiro mensal"    },
  { value: "card_monthly",  label: "Cartão mensal"      },
  { value: "card_annual",   label: "Cartão anual"       },
  { value: "bank_slip",     label: "Boleto"             },
  { value: "other",         label: "Outro"              },
];

const GOAL_OPTIONS = [
  { value: "",               label: "Selecionar"             },
  { value: "weight_loss",    label: "Emagrecimento"          },
  { value: "muscle_gain",    label: "Ganho de massa"         },
  { value: "conditioning",   label: "Condicionamento"        },
  { value: "health",         label: "Saúde e qualidade de vida" },
  { value: "rehabilitation", label: "Reabilitação"           },
  { value: "performance",    label: "Performance esportiva"  },
  { value: "other",          label: "Outro"                  },
];

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

type AddMode = "direct" | "invite";

interface AddForm {
  mode:                  AddMode;
  // Dados pessoais
  name:                  string;
  email:                 string;
  cpf:                   string;
  birthDate:             string;
  phone:                 string;
  avatarUrl:             string;
  // Matrícula
  planId:                string;
  startDate:             string;
  paymentMethod:         string;
  // Ficha
  mainGoal:              string;
  medicalRestrictions:   string;
  // Emergência
  emergencyContactName:  string;
  emergencyContactPhone: string;
  // Aceites
  acceptedTerms:         boolean;
  acceptedLgpd:          boolean;
}

const DEFAULT_ADD: AddForm = {
  mode: "direct",
  name: "", email: "", cpf: "", birthDate: "", phone: "", avatarUrl: "",
  planId: "", startDate: "", paymentMethod: "",
  mainGoal: "", medicalRestrictions: "",
  emergencyContactName: "", emergencyContactPhone: "",
  acceptedTerms: false, acceptedLgpd: false,
};

export default function AcademyStudentsPage() {
  const navigate = useNavigate();

  const [students, setStudents]   = useState<Student[]>([]);
  const [stats, setStats]         = useState<StudentsStats | null>(null);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFilter] = useState("");
  const [search, setSearch]       = useState("");
  const [searchInput, setInput]   = useState("");

  const [plans, setPlans]           = useState<AcademyPlan[]>([]);
  const [showAdd, setShowAdd]       = useState(false);
  const [addForm, setAddForm]       = useState<AddForm>(DEFAULT_ADD);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]     = useState("");
  const [addResult, setAddResult]   = useState<{ tempPassword?: string; inviteUrl?: string } | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStudents({ status: filterStatus || undefined, q: search || undefined, page, pageSize: PAGE_SIZE });
      setStudents(res.students);
      setTotal(res.total);
      setStats(res.stats);
    } catch { /* keep */ }
    finally { setLoading(false); }
  }, [filterStatus, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchPlans().then(setPlans).catch(() => {}); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addForm.mode === "direct") {
      if (!addForm.acceptedTerms || !addForm.acceptedLgpd) {
        setAddError("Os aceites obrigatórios (Termos de Uso e LGPD) são necessários para prosseguir.");
        return;
      }
    }
    setAddError("");
    setAddResult(null);
    setAddLoading(true);
    try {
      if (addForm.mode === "direct") {
        const res = await addStudentDirect({
          name:                  addForm.name,
          email:                 addForm.email,
          cpf:                   addForm.cpf    || undefined,
          phone:                 addForm.phone  || undefined,
          birthDate:             addForm.birthDate || undefined,
          avatarUrl:             addForm.avatarUrl || undefined,
          planId:                addForm.planId     ? Number(addForm.planId)  : undefined,
          startDate:             addForm.startDate  || undefined,
          paymentMethod:         addForm.paymentMethod  || undefined,
          mainGoal:              addForm.mainGoal        || undefined,
          medicalRestrictions:   addForm.medicalRestrictions   || undefined,
          emergencyContactName:  addForm.emergencyContactName  || undefined,
          emergencyContactPhone: addForm.emergencyContactPhone || undefined,
          acceptedTerms:         addForm.acceptedTerms,
          acceptedLgpd:          addForm.acceptedLgpd,
        });
        setAddResult({ tempPassword: res.tempPassword });
      } else {
        const res = await inviteStudent({ email: addForm.email });
        setAddResult({ inviteUrl: res.inviteUrl });
      }
      load();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  function setField<K extends keyof AddForm>(key: K, value: AddForm[K]) {
    setAddForm((f) => ({ ...f, [key]: value }));
  }

  function resetAdd() { setAddForm(DEFAULT_ADD); setAddError(""); setAddResult(null); }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Academia</div>
          <h1 className="page-title">Alunos</h1>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); resetAdd(); }}>
          + Adicionar aluno
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="dash-kpi-grid">
          {[
            { label: "Ativos",   value: stats.active,  cls: "dash-kpi-item-value--ok"   },
            { label: "Leads",    value: stats.leads,   cls: ""                          },
            { label: "Em risco", value: stats.overdue, cls: "dash-kpi-item-value--warn" },
            { label: "Pausados", value: stats.paused,  cls: ""                          },
            { label: "Total",    value: stats.total,   cls: ""                          },
          ].map(({ label, value, cls }) => (
            <div key={label} className="dash-kpi-item">
              <div className="dash-kpi-item-label">{label}</div>
              <div className={`dash-kpi-item-value ${cls}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="section-card" style={{ padding: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "var(--space-2)", flex: 1, minWidth: 200 }}>
            <input
              className="input"
              placeholder="Buscar por nome ou e-mail..."
              value={searchInput}
              onChange={(e) => setInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-sm btn-secondary" type="submit">Buscar</button>
          </form>
          <select
            className="input"
            value={filterStatus}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            style={{ width: 160, flexShrink: 0 }}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table or empty */}
      {loading ? (
        <div className="dash-section">
          <div className="dash-skeleton">
            {[1, 2, 3].map((i) => <div key={i} className="dash-skeleton-bar" style={{ height: 48 }} />)}
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="section-card">
          <EmptyState
            eyebrow="Base de alunos"
            title="Sinais metabólicos em formação"
            description="Adicione o primeiro aluno por cadastro direto ou convite por e-mail. Os indicadores de aderência, risco e evolução aparecerão após as primeiras matrículas."
            action={
              <button className="btn btn-primary" onClick={() => { setShowAdd(true); resetAdd(); }}>
                Adicionar primeiro aluno
              </button>
            }
          />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Status</th>
                <th>Plano ativo</th>
                <th>Membro desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.userId}>
                  <td>
                    <div className="identity-row">
                      {s.avatarUrl ? (
                        <img
                          src={s.avatarUrl} alt={s.name}
                          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <span className="avatar-initials avatar-initials--sm">
                          {initials(s.name || s.email)}
                        </span>
                      )}
                      <div>
                        <div className="identity-row__name">{s.name || "—"}</div>
                        <div className="identity-row__sub">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={STATUS_BADGE[s.studentStatus ?? "lead"] ?? "badge"}>
                      {STATUS_LABELS[s.studentStatus ?? "lead"] ?? s.studentStatus}
                    </span>
                  </td>
                  <td>
                    {s.activePlan
                      ? <span style={{ fontSize: "var(--text-sm)" }}>{s.activePlan.name} — <strong>R$ {s.activePlan.monthlyPrice.toFixed(2)}</strong></span>
                      : <span className="muted small">Sem plano</span>
                    }
                  </td>
                  <td className="small">{s.joinedAt ? new Date(s.joinedAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/app/academy/students/${s.userId}`)}>
                      Ver perfil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--space-3)" }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Anterior
          </button>
          <span className="small" style={{ color: "var(--color-text-muted)" }}>Página {page} de {totalPages}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Próxima
          </button>
        </div>
      )}

      {/* ── Add Student Modal (full registration form) ── */}
      {showAdd && (
        <div
          className="drawer-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAdd(false); resetAdd(); } }}
        >
          <div className="drawer-panel" style={{ maxWidth: 600 }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)" }}>
                Adicionar aluno
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); resetAdd(); }}>✕</button>
            </div>

            <div className="mode-toggle" style={{ marginBottom: "var(--space-5)" }}>
              {(["direct", "invite"] as AddMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`mode-toggle__btn${addForm.mode === m ? " mode-toggle__btn--active" : ""}`}
                  onClick={() => setField("mode", m)}
                >
                  {m === "direct" ? "Cadastro completo" : "Convite por e-mail"}
                </button>
              ))}
            </div>

            {addResult ? (
              /* ── Success state ── */
              <div style={{ display: "grid", gap: "var(--space-4)" }}>
                {addResult.tempPassword && (
                  <div className="banner-success">
                    <p style={{ fontWeight: "var(--font-semibold)", marginBottom: "var(--space-2)" }}>Aluno cadastrado com sucesso!</p>
                    <p className="small" style={{ marginBottom: "var(--space-2)" }}>Senha temporária — copie e envie ao aluno:</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <code style={{
                        background: "var(--color-success-soft)", border: "1px solid var(--color-success-border)",
                        padding: "4px 10px", borderRadius: "var(--radius-sm)", fontWeight: 700,
                      }}>
                        {addResult.tempPassword}
                      </code>
                      <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(addResult.tempPassword!)}>
                        Copiar
                      </button>
                    </div>
                  </div>
                )}
                {addResult.inviteUrl && (
                  <div className="banner-success" style={{ background: "var(--color-info-soft)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)" }}>
                    <p style={{ fontWeight: "var(--font-semibold)", marginBottom: "var(--space-2)" }}>Convite gerado!</p>
                    <p className="small" style={{ marginBottom: "var(--space-2)" }}>Link para o aluno acessar:</p>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <input className="input" readOnly value={addResult.inviteUrl} style={{ flex: 1, fontSize: "var(--text-xs)" }} />
                      <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(addResult.inviteUrl!)}>
                        Copiar
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <button className="btn btn-primary" onClick={resetAdd}>Adicionar outro</button>
                  <button className="btn btn-ghost" onClick={() => { setShowAdd(false); resetAdd(); }}>Fechar</button>
                </div>
              </div>
            ) : addForm.mode === "invite" ? (
              /* ── Invite mode ── */
              <form onSubmit={handleAdd} className="form-grid">
                <div className="field">
                  <label className="label">E-mail do aluno <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <input className="input" type="email" required value={addForm.email} onChange={(e) => setField("email", e.target.value)} placeholder="aluno@email.com" />
                  <span className="field-hint">O aluno receberá um link para criar sua conta e acessar a academia.</span>
                </div>
                {addError && <p className="field-error">{addError}</p>}
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <button className="btn btn-primary" type="submit" disabled={addLoading}>
                    {addLoading ? "Enviando..." : "Enviar convite"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowAdd(false); resetAdd(); }}>Cancelar</button>
                </div>
              </form>
            ) : (
              /* ── Direct mode — full form ── */
              <form onSubmit={handleAdd} className="form-grid">
                {/* SECTION: Dados pessoais */}
                <div>
                  <div className="dash-eyebrow" style={{ marginBottom: "var(--space-3)" }}>Dados pessoais</div>
                  <div className="form-grid" style={{ gap: "var(--space-3)" }}>
                    <div className="field">
                      <label className="label">Nome completo <span style={{ color: "var(--color-danger)" }}>*</span></label>
                      <input className="input" required value={addForm.name} onChange={(e) => setField("name", e.target.value)} placeholder="João da Silva" />
                    </div>
                    <div className="form-grid form-grid--2col">
                      <div className="field">
                        <label className="label">CPF</label>
                        <input className="input" value={addForm.cpf} onChange={(e) => setField("cpf", e.target.value)} placeholder="000.000.000-00" />
                      </div>
                      <div className="field">
                        <label className="label">Data de nascimento</label>
                        <input type="date" className="input" value={addForm.birthDate} onChange={(e) => setField("birthDate", e.target.value)} />
                      </div>
                    </div>
                    <div className="form-grid form-grid--2col">
                      <div className="field">
                        <label className="label">Telefone / WhatsApp</label>
                        <input className="input" value={addForm.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(00) 90000-0000" />
                      </div>
                      <div className="field">
                        <label className="label">E-mail <span style={{ color: "var(--color-danger)" }}>*</span></label>
                        <input className="input" type="email" required value={addForm.email} onChange={(e) => setField("email", e.target.value)} placeholder="aluno@email.com" />
                      </div>
                    </div>
                    <div className="field">
                      <label className="label">Foto (URL da imagem)</label>
                      <input className="input" type="url" value={addForm.avatarUrl} onChange={(e) => setField("avatarUrl", e.target.value)} placeholder="https://..." />
                      <span className="field-hint">Link público de uma imagem. Upload direto disponível em breve.</span>
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: 0 }} />

                {/* SECTION: Matrícula */}
                <div>
                  <div className="dash-eyebrow" style={{ marginBottom: "var(--space-3)" }}>Matrícula</div>
                  <div className="form-grid" style={{ gap: "var(--space-3)" }}>
                    <div className="form-grid form-grid--2col">
                      <div className="field">
                        <label className="label">Plano</label>
                        <select className="input" value={addForm.planId} onChange={(e) => setField("planId", e.target.value)}>
                          <option value="">Sem plano agora</option>
                          {plans.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name} — R$ {Number(p.monthlyPrice).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="label">Data de início</label>
                        <input type="date" className="input" value={addForm.startDate} onChange={(e) => setField("startDate", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label className="label">Forma de pagamento</label>
                      <select className="input" value={addForm.paymentMethod} onChange={(e) => setField("paymentMethod", e.target.value)}>
                        {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: 0 }} />

                {/* SECTION: Ficha do aluno */}
                <div>
                  <div className="dash-eyebrow" style={{ marginBottom: "var(--space-3)" }}>Ficha do aluno</div>
                  <div className="form-grid" style={{ gap: "var(--space-3)" }}>
                    <div className="field">
                      <label className="label">Objetivo principal</label>
                      <select className="input" value={addForm.mainGoal} onChange={(e) => setField("mainGoal", e.target.value)}>
                        {GOAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label">Restrições médicas</label>
                      <textarea
                        className="input" rows={2}
                        value={addForm.medicalRestrictions}
                        onChange={(e) => setField("medicalRestrictions", e.target.value)}
                        placeholder="Problemas articulares, cardíacos, alergias… ou deixe em branco"
                      />
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: 0 }} />

                {/* SECTION: Contato de emergência */}
                <div>
                  <div className="dash-eyebrow" style={{ marginBottom: "var(--space-3)" }}>Contato de emergência</div>
                  <div className="form-grid form-grid--2col">
                    <div className="field">
                      <label className="label">Nome</label>
                      <input className="input" value={addForm.emergencyContactName} onChange={(e) => setField("emergencyContactName", e.target.value)} placeholder="Nome do contato" />
                    </div>
                    <div className="field">
                      <label className="label">Telefone</label>
                      <input className="input" value={addForm.emergencyContactPhone} onChange={(e) => setField("emergencyContactPhone", e.target.value)} placeholder="(00) 90000-0000" />
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: 0 }} />

                {/* SECTION: Aceites */}
                <div>
                  <div className="dash-eyebrow" style={{ marginBottom: "var(--space-3)" }}>Aceites obrigatórios</div>
                  <div className="form-grid" style={{ gap: "var(--space-3)" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={addForm.acceptedTerms}
                        onChange={(e) => setField("acceptedTerms", e.target.checked)}
                        style={{ marginTop: 3, flexShrink: 0, accentColor: "var(--color-primary)", width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                        O aluno declara que leu e aceita os <strong>Termos de Uso</strong> da academia.
                        <span style={{ color: "var(--color-danger)" }}> *</span>
                      </span>
                    </label>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={addForm.acceptedLgpd}
                        onChange={(e) => setField("acceptedLgpd", e.target.checked)}
                        style={{ marginTop: 3, flexShrink: 0, accentColor: "var(--color-primary)", width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                        O aluno autoriza o tratamento de seus dados conforme a <strong>Lei Geral de Proteção de Dados (LGPD)</strong>.
                        <span style={{ color: "var(--color-danger)" }}> *</span>
                      </span>
                    </label>
                    {(!addForm.acceptedTerms || !addForm.acceptedLgpd) && (
                      <p className="field-hint">Os dois aceites são obrigatórios para concluir o cadastro.</p>
                    )}
                  </div>
                </div>

                {addError && <p className="field-error">{addError}</p>}

                <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-1)" }}>
                  <button className="btn btn-primary" type="submit" disabled={addLoading}>
                    {addLoading ? "Cadastrando..." : "Cadastrar aluno"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowAdd(false); resetAdd(); }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
