import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchStudent,
  fetchPlans,
  enrollStudentInPlan,
  pauseStudentApi,
  cancelStudentApi,
  reactivateStudentApi,
  resetStudentPasswordApi,
  type StudentDetail,
  type AcademyPlan,
  type Enrollment,
  type StudentActivity,
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
  "student.password_reset": "Senha redefinida pela equipe",
};

/** Resumo legível de `meta` do audit log (evita JSON bruto na UI). */
function formatAuditMetaLine(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.email === "string") parts.push(`E-mail: ${m.email}`);
  if (typeof m.roleSlug === "string") parts.push(`Papel: ${m.roleSlug}`);
  if (typeof m.mode === "string") parts.push(`Modo: ${m.mode}`);
  if (m.planId != null && m.planId !== "") parts.push(`Plano: ${String(m.planId)}`);
  if (typeof m.newStatus === "string") parts.push(`Novo status: ${m.newStatus}`);
  if (typeof m.isActive === "boolean") parts.push(m.isActive ? "Membro ativo" : "Membro inativo");
  if (typeof m.primaryColor === "string" && m.primaryColor) parts.push("Identidade visual (cores) atualizada");
  if (typeof m.name === "string") parts.push(`Nome: ${m.name}`);
  if (typeof m.monthlyPrice === "number") parts.push(`Valor: R$ ${m.monthlyPrice.toFixed(2)}`);
  if (typeof m.productKey === "string") parts.push(`Produto: ${m.productKey}`);
  if (parts.length > 0) return parts.join(" · ");
  const keys = Object.keys(m);
  if (keys.length === 0) return null;
  return keys
    .slice(0, 6)
    .map((k) => `${k}: ${String(m[k])}`)
    .join(" · ");
}

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

function dateRelative(iso: string | null) {
  if (!iso) return "Nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

function ActivityBlock({ activity }: { activity?: StudentActivity }) {
  if (!activity) return null;

  const adherence = activity.adherence30dPct;
  const barColor =
    adherence == null ? "var(--color-border)"
    : adherence >= 70 ? "var(--color-success, #22c55e)"
    : adherence >= 40 ? "var(--color-warning, #f59e0b)"
    : "var(--color-danger, #ef4444)";

  return (
    <div className="section-card">
      <h2 className="section-card__title" style={{ marginBottom: "var(--space-4)" }}>Atividade</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div>
          <div className="dash-eyebrow" style={{ marginBottom: 4 }}>Último treino</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
            {dateRelative(activity.lastWorkout)}
          </div>
          {activity.lastWorkout && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)", marginTop: 2 }}>
              {new Date(activity.lastWorkout).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>

        <div>
          <div className="dash-eyebrow" style={{ marginBottom: 4 }}>Último check-in</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
            {dateRelative(activity.lastCheckin)}
          </div>
          {activity.lastCheckin && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)", marginTop: 2 }}>
              {new Date(activity.lastCheckin).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>

        <div>
          <div className="dash-eyebrow" style={{ marginBottom: 4 }}>Treinos em 30d</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
            {activity.workouts30d}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)", marginTop: 2 }}>
            {activity.checkins30d} check-in{activity.checkins30d !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Adherence bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)" }}>Aderência 30 dias</span>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: barColor }}>
            {adherence != null ? `${adherence}%` : "Sem dados"}
          </span>
        </div>
        <div style={{
          height: 6,
          background: "var(--color-surface-2, rgba(0,0,0,.06))",
          borderRadius: 99,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.min(adherence ?? 0, 100)}%`,
            height: "100%",
            background: barColor,
            borderRadius: 99,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
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

  const [tempPassword, setTempPassword] = useState<string | null>(null);

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

  async function handleResetPassword() {
    if (!confirm(`Redefinir a senha de ${student?.name || student?.email}? Uma senha temporária será gerada para você compartilhar com o aluno.`)) return;
    setAction("reset-password");
    setSuccess("");
    setError("");
    setTempPassword(null);
    try {
      const pwd = await resetStudentPasswordApi(id);
      setTempPassword(pwd);
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

              <button
                className="btn btn-ghost btn-sm"
                disabled={actionLoading === "reset-password"}
                onClick={handleResetPassword}
                style={{ marginTop: "var(--space-1)" }}
              >
                {actionLoading === "reset-password" ? "Gerando senha..." : "Redefinir senha"}
              </button>
            </div>

            {tempPassword && (
              <div style={{
                marginTop: "var(--space-3)",
                padding: "var(--space-3)",
                background: "var(--color-surface-2, rgba(0,0,0,.04))",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}>
                <div className="dash-eyebrow" style={{ marginBottom: 6 }}>Senha temporária — compartilhe com o aluno</div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <code style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--font-bold)",
                    letterSpacing: "0.05em",
                    flex: 1,
                  }}>
                    {tempPassword}
                  </code>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { navigator.clipboard.writeText(tempPassword); }}
                    style={{ flexShrink: 0 }}
                  >
                    Copiar
                  </button>
                </div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
                  O aluno deve trocar a senha após o primeiro login.
                </p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTempPassword(null)}
                  style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)" }}
                >
                  Fechar
                </button>
              </div>
            )}
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

          {/* Activity block */}
          <ActivityBlock activity={student.activity} />

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
                      {(() => {
                        const line = formatAuditMetaLine(entry.meta);
                        return line ? (
                        <p className="small" style={{ color: "var(--color-text-muted)" }}>
                          {line}
                        </p>
                        ) : null;
                      })()}
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
