import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchStudent,
  fetchPlans,
  enrollStudentInPlan,
  pauseStudentApi,
  cancelStudentApi,
  reactivateStudentApi,
  type StudentDetail,
  type AcademyPlan,
  type Enrollment,
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

const AUDIT_LABEL: Record<string, string> = {
  "student.added":          "Aluno cadastrado",
  "student.status_changed": "Status atualizado",
  "student.enrolled":       "Matrícula criada",
  "student.paused":         "Pausado",
  "student.cancelled":      "Cancelado",
  "student.reactivated":    "Reativado",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="dash-eyebrow" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>{value}</div>
    </div>
  );
}

export default function AcademyStudentDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();

  const [student, setStudent]      = useState<StudentDetail | null>(null);
  const [plans, setPlans]          = useState<AcademyPlan[]>([]);
  const [loading, setLoading]      = useState(true);
  const [actionLoading, setAction] = useState<string | null>(null);
  const [error, setError]          = useState("");
  const [successMsg, setSuccess]   = useState("");

  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollPlan, setEnrollPlan] = useState("");
  const [enrollDate, setEnrollDate] = useState("");
  const [enrollLoading, setEnrollL] = useState(false);
  const [enrollError, setEnrollErr] = useState("");

  const id = Number(userId);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.all([fetchStudent(id), fetchPlans()]);
      setStudent(s);
      setPlans(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: "pause" | "cancel" | "reactivate") {
    setAction(action);
    setSuccess("");
    setError("");
    try {
      if (action === "pause")      await pauseStudentApi(id);
      if (action === "cancel")     await cancelStudentApi(id);
      if (action === "reactivate") await reactivateStudentApi(id);
      await load();
      setSuccess(action === "pause" ? "Aluno pausado." : action === "cancel" ? "Aluno cancelado." : "Aluno reativado.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAction(null);
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollPlan) { setEnrollErr("Selecione um plano."); return; }
    setEnrollL(true);
    setEnrollErr("");
    try {
      await enrollStudentInPlan(id, { planId: Number(enrollPlan), startDate: enrollDate || undefined });
      setShowEnroll(false);
      setEnrollPlan("");
      setEnrollDate("");
      setSuccess("Matrícula criada.");
      await load();
    } catch (e: any) {
      setEnrollErr(e.message);
    } finally {
      setEnrollL(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="dash-section">
          <div className="dash-skeleton">
            <div className="dash-skeleton-bar" style={{ height: 20, width: "30%" }} />
            <div className="dash-skeleton-bar" style={{ height: 14, width: "55%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="page-container">
        <div className="banner-error">{error || "Aluno não encontrado."}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/app/academy/students")}>← Voltar</button>
      </div>
    );
  }

  const status           = student.studentStatus ?? "lead";
  const activePlan       = student.activePlan;
  const activeEnrollment = student.enrollments.find((e: Enrollment) => e.status === "active");

  return (
    <div className="page-container">
      {/* Back */}
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/app/academy/students")}>
          ← Alunos
        </button>
      </div>

      {/* Feedback banners */}
      {successMsg && <div className="banner-success">{successMsg}</div>}
      {error      && <div className="banner-error">{error}</div>}

      {/* Two-column layout */}
      <div className="detail-layout">
        {/* Left — Identity column */}
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          {/* Identity card */}
          <div className="section-card" style={{ textAlign: "center" }}>
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt={student.name}
                style={{
                  width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
                  margin: "0 auto var(--space-3)", display: "block",
                  border: "2px solid var(--color-border)",
                }}
              />
            ) : (
              <span
                className="avatar-initials avatar-initials--lg"
                style={{ margin: "0 auto var(--space-3)" }}
              >
                {initials(student.name || student.email)}
              </span>
            )}
            <p style={{ fontWeight: "var(--font-bold)", fontSize: "var(--text-lg)", marginBottom: "var(--space-1)" }}>
              {student.name || "—"}
            </p>
            <p className="muted small" style={{ marginBottom: "var(--space-3)" }}>{student.email}</p>
            <span className={STATUS_BADGE[status] ?? "badge"} style={{ fontSize: "var(--text-xs)" }}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>

          {/* Info card */}
          <div className="section-card" style={{ display: "grid", gap: "var(--space-4)" }}>
            <div className="dash-eyebrow--spaced dash-eyebrow">Dados pessoais</div>
            <InfoField label="Telefone / WhatsApp" value={student.phone} />
            <InfoField label="CPF" value={student.cpf} />
            <InfoField
              label="Data de nascimento"
              value={student.birthDate ? new Date(student.birthDate + "T00:00:00").toLocaleDateString("pt-BR") : null}
            />
            <InfoField
              label="Membro desde"
              value={student.joinedAt ? new Date(student.joinedAt).toLocaleDateString("pt-BR") : null}
            />
            <InfoField label="Forma de pagamento" value={
              student.paymentMethod
                ? ({
                    pix_monthly:  "PIX mensal",
                    cash_monthly: "Dinheiro mensal",
                    card_monthly: "Cartão mensal",
                    card_annual:  "Cartão anual",
                    bank_slip:    "Boleto",
                    other:        "Outro",
                  }[student.paymentMethod] ?? student.paymentMethod)
                : null
            } />
          </div>

          {/* Ficha — goal, medical, emergency */}
          <div className="section-card" style={{ display: "grid", gap: "var(--space-4)" }}>
            <div className="dash-eyebrow--spaced dash-eyebrow">Ficha do aluno</div>
            <InfoField label="Objetivo principal" value={
              student.mainGoal
                ? ({
                    weight_loss:    "Emagrecimento",
                    muscle_gain:    "Ganho de massa",
                    conditioning:   "Condicionamento",
                    health:         "Saúde e qualidade de vida",
                    rehabilitation: "Reabilitação",
                    performance:    "Performance esportiva",
                    other:          "Outro",
                  }[student.mainGoal] ?? student.mainGoal)
                : null
            } />
            <InfoField label="Restrições médicas" value={student.medicalRestrictions} />
            {(student.emergencyContactName || student.emergencyContactPhone) && (
              <div>
                <div className="dash-eyebrow" style={{ marginBottom: 2 }}>Contato de emergência</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
                  {[student.emergencyContactName, student.emergencyContactPhone].filter(Boolean).join(" — ")}
                </div>
              </div>
            )}
            {/* Aceites */}
            <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ fontSize: 13, color: student.acceptedTermsAt ? "var(--color-success-text)" : "var(--color-text-muted)" }}>
                  {student.acceptedTermsAt ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  Termos de Uso{student.acceptedTermsAt ? ` — ${new Date(student.acceptedTermsAt).toLocaleDateString("pt-BR")}` : " — pendente"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ fontSize: 13, color: student.acceptedLgpdAt ? "var(--color-success-text)" : "var(--color-text-muted)" }}>
                  {student.acceptedLgpdAt ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  LGPD{student.acceptedLgpdAt ? ` — ${new Date(student.acceptedLgpdAt).toLocaleDateString("pt-BR")}` : " — pendente"}
                </span>
              </div>
            </div>
          </div>

          {/* Actions card */}
          <div className="section-card">
            <div className="dash-eyebrow--spaced dash-eyebrow">Ações</div>
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {status === "active" && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={actionLoading === "pause"}
                    onClick={() => handleAction("pause")}
                  >
                    {actionLoading === "pause" ? "Pausando..." : "Pausar aluno"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--color-danger-text)" }}
                    disabled={actionLoading === "cancel"}
                    onClick={() => { if (confirm("Confirmar cancelamento do aluno?")) handleAction("cancel"); }}
                  >
                    {actionLoading === "cancel" ? "Cancelando..." : "Cancelar matrícula"}
                  </button>
                </>
              )}
              {(status === "paused" || status === "lead" || status === "overdue" || status === "cancelled") && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading === "reactivate"}
                  onClick={() => handleAction("reactivate")}
                >
                  {actionLoading === "reactivate" ? "Reativando..." : "Reativar aluno"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right — Main content */}
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          {/* Enrollment */}
          <div className="section-card">
            <div className="section-card__header">
              <h2 className="section-card__title">Matrícula</h2>
              {!showEnroll && (
                <button className="btn btn-sm btn-secondary" onClick={() => setShowEnroll(true)}>
                  {activePlan ? "Trocar plano" : "Matricular"}
                </button>
              )}
            </div>

            {activePlan && activeEnrollment ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <InfoField label="Plano"   value={activePlan.name} />
                <InfoField label="Valor"   value={`R$ ${Number(activePlan.monthlyPrice).toFixed(2)}/mês`} />
                <InfoField label="Início"  value={new Date(activePlan.startDate).toLocaleDateString("pt-BR")} />
                <div>
                  <div className="dash-eyebrow" style={{ marginBottom: 4 }}>Status</div>
                  <span className="badge badge-success">Ativa</span>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                Nenhuma matrícula ativa. Selecione um plano para vincular o aluno.
              </p>
            )}

            {showEnroll && (
              <form
                onSubmit={handleEnroll}
                style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}
                className="form-grid"
              >
                <div className="field">
                  <label className="label">Plano <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <select className="input" required value={enrollPlan} onChange={(e) => setEnrollPlan(e.target.value)}>
                    <option value="">Selecionar plano</option>
                    {plans.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} — R$ {Number(p.monthlyPrice).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Data de início</label>
                  <input type="date" className="input" value={enrollDate} onChange={(e) => setEnrollDate(e.target.value)} />
                </div>
                {enrollError && <p className="field-error">{enrollError}</p>}
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={enrollLoading}>
                    {enrollLoading ? "Salvando..." : "Confirmar matrícula"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowEnroll(false); setEnrollErr(""); }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Event history */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ marginBottom: "var(--space-4)" }}>Histórico de eventos</h2>
            {student.auditHistory.length === 0 ? (
              <div className="dash-alert-empty">
                Nenhum evento registrado ainda. Os registros aparecerão conforme as ações forem realizadas.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                {student.auditHistory.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--color-primary)", marginTop: 6, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", marginBottom: 2 }}>
                        {AUDIT_LABEL[entry.action] ?? entry.action}
                      </p>
                      {entry.meta && Object.keys(entry.meta).length > 0 && (
                        <p className="small">{JSON.stringify(entry.meta)}</p>
                      )}
                    </div>
                    <p className="small" style={{ whiteSpace: "nowrap" }}>
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrollment history */}
          {student.enrollments.length > 1 && (
            <div className="section-card">
              <h2 className="section-card__title" style={{ marginBottom: "var(--space-4)" }}>Matrículas anteriores</h2>
              <div className="table-wrapper" style={{ borderRadius: "var(--radius-md)" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Plano</th>
                      <th>Início</th>
                      <th>Término</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.enrollments.map((e: Enrollment) => (
                      <tr key={e.id}>
                        <td>{e.planName ?? "—"}</td>
                        <td>{e.startDate ? new Date(e.startDate).toLocaleDateString("pt-BR") : "—"}</td>
                        <td>{e.endDate  ? new Date(e.endDate).toLocaleDateString("pt-BR")   : "—"}</td>
                        <td>
                          <span className={
                            e.status === "active"   ? "badge badge-success" :
                            e.status === "paused"   ? "badge badge-warn"    : "badge badge-danger"
                          }>
                            {e.status === "active" ? "Ativa" : e.status === "paused" ? "Pausada" : "Cancelada"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Metabolic signals placeholder */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ marginBottom: "var(--space-3)" }}>Sinais metabólicos</h2>
            <div className="dash-alert-empty--ok">
              <div className="dash-alert-ok-signal">Indicadores em formação</div>
              <p className="dash-alert-ok-detail">
                Os sinais metabólicos aparecerão após os primeiros check-ins e sessões de treino do aluno.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
