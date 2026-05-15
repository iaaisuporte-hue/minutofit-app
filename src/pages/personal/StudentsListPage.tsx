import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import {
  addStudentDirect,
  fetchPersonalDashboard,
  type PersonalDashboardStudent,
} from "../../services/personalDashboardApi";
import {
  createDirectInvite,
  listDirectInvites,
  revokeDirectInvite,
  type DirectInvite,
} from "../../services/personalDirectInvitesApi";
import { COLORS } from "../../styles/colors";
import StudentProfileModal from "./StudentProfileModal";
import "./personalPremium.css";

type Plan = PersonalDashboardStudent["plan"];
type Student = PersonalDashboardStudent;

const PLAN_LABEL: Record<Plan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

const PERSONAL_BASE = "/app/personal" as const;
const routes = {
  workoutBuilder: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}/workouts/builder`,
} as const;

function pillStyle(opts: { bg: string; border: string; color?: string }): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 650,
    border: `1px solid ${opts.border}`,
    background: opts.bg,
    color: opts.color ?? COLORS.text,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    letterSpacing: 0.2,
    lineHeight: "12px",
    whiteSpace: "nowrap",
  };
}

function planPillStyle(plan: Plan): React.CSSProperties {
  const map: Record<Plan, { bg: string; border: string }> = {
    basic: { bg: "#F9FAFB", border: "#E5E7EB" },
    silver: { bg: "rgba(120,160,255,.12)", border: "rgba(120,160,255,.35)" },
    gold: { bg: "rgba(255,200,0,.12)", border: "rgba(255,200,0,.35)" },
    black: { bg: COLORS.orangeSoft, border: COLORS.orangeBorder },
  };
  return pillStyle({ bg: map[plan].bg, border: map[plan].border });
}

function statusPill(status: Student["engagementStatus"]) {
  const tone =
    status === "evolving"
      ? { bg: COLORS.successBg, border: COLORS.successBorder, label: "Evoluindo" }
      : status === "on_track"
        ? { bg: COLORS.primarySoft, border: COLORS.borderStrong, label: "No ritmo" }
        : status === "attention"
          ? { bg: COLORS.warnBg, border: COLORS.warnBorder, label: "Atenção" }
          : status === "fading"
            ? { bg: COLORS.warnBg, border: COLORS.warnBorder, label: "Sumindo" }
            : { bg: COLORS.dangerBg, border: COLORS.dangerBorder, label: "Em risco" };

  return (
    <span style={pillStyle({ bg: tone.bg, border: tone.border })}>{tone.label}</span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="pp-btn pp-btn--primary pp-btn--sm"
      onMouseDown={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
      }}
    >
      {label}
    </Link>
  );
}

export default function StudentsListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  // ── Direct registration ────────────────────────────────────────────
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<{ name: string; isNew: boolean; matchedBy: string | null } | null>(null);

  function openRegisterModal() {
    setRegName(""); setRegEmail(""); setRegPhone(""); setRegCpf("");
    setRegError(null); setRegSuccess(null);
    setShowRegisterModal(true);
  }

  async function handleRegister() {
    setRegLoading(true); setRegError(null);
    try {
      const result = await addStudentDirect({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        cpf: regCpf.trim() || undefined,
      });
      setRegSuccess({ name: result.student.name, isNew: result.isNew, matchedBy: result.matchedBy });
      // Refresh student list
      const dash = await fetchPersonalDashboard();
      if (dash) setStudents(dash.students);
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      setRegError(err.code === "ALREADY_ASSIGNED"
        ? "Este aluno já está na sua carteira."
        : (err.message || "Não foi possível cadastrar o aluno."));
    } finally {
      setRegLoading(false);
    }
  }

  // ── Direct invites ─────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [invites, setInvites] = useState<DirectInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const inviteUrlRef = useRef<HTMLInputElement>(null);

  function loadInvites() {
    setInvitesLoading(true);
    listDirectInvites()
      .then((rows) => setInvites(rows))
      .catch(() => {})
      .finally(() => setInvitesLoading(false));
  }

  async function handleCreateInvite() {
    setInviteLoading(true);
    setInviteError(null);
    try {
      const result = await createDirectInvite({ invitedEmail: inviteEmail || undefined, invitedName: inviteName || undefined });
      setCreatedInviteUrl(result.inviteUrl);
      loadInvites();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await revokeDirectInvite(id);
      setInvites((prev) => prev.map((inv) => inv.id === id ? { ...inv, status: "revoked" } : inv));
    } catch { /* ignore */ }
  }

  function openInviteModal() {
    setInviteEmail("");
    setInviteName("");
    setInviteError(null);
    setCreatedInviteUrl(null);
    setShowInviteModal(true);
  }

  function closeInviteModal() {
    setShowInviteModal(false);
    setCreatedInviteUrl(null);
  }

  function copyInviteUrl() {
    if (inviteUrlRef.current) {
      inviteUrlRef.current.select();
      document.execCommand("copy");
    } else if (createdInviteUrl) {
      navigator.clipboard.writeText(createdInviteUrl).catch(() => {});
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingStudents(true);
      try {
        const dash = await fetchPersonalDashboard();
        if (cancelled) return;
        if (!dash) {
          setStudentsError("Não foi possível carregar os alunos. Tente novamente.");
          return;
        }
        setStudents(
          dash.students
        );
      } catch {
        if (!cancelled) setStudentsError("Erro ao carregar alunos.");
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [filter, setFilter] = useState<"all" | Plan>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const byPlan = filter === "all" ? students : students.filter((s) => s.plan === filter);
    const query = q.trim().toLowerCase();
    if (!query) return byPlan;
    return byPlan.filter((s) => s.name.toLowerCase().includes(query));
  }, [filter, students, q]);

  const statusSummary = useMemo(() => {
    const base = {
      evolving: 0,
      attention: 0,
      atRisk: 0,
    };

    for (const student of filtered) {
      if (student.engagementStatus === "evolving") base.evolving += 1;
      if (student.engagementStatus === "attention" || student.engagementStatus === "fading") base.attention += 1;
      if (student.engagementStatus === "at_risk") base.atRisk += 1;
    }

    const total = filtered.length || 1;

    return {
      total: filtered.length,
      items: [
        {
          key: "evolving",
          label: "Evoluindo",
          value: base.evolving,
          bg: COLORS.successBg,
          border: COLORS.successBorder,
        },
        {
          key: "attention",
          label: "Atenção",
          value: base.attention,
          bg: COLORS.warnBg,
          border: COLORS.warnBorder,
        },
        {
          key: "atRisk",
          label: "Em risco",
          value: base.atRisk,
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
        },
      ],
      segments: [
        {
          key: "evolving",
          width: `${(base.evolving / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(46,204,113,.95), rgba(34,197,94,.82))",
        },
        {
          key: "attention",
          width: `${(base.attention / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(255,196,0,.95), rgba(255,180,0,.82))",
        },
        {
          key: "atRisk",
          width: `${(base.atRisk / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(255,102,102,.95), rgba(255,77,77,.82))",
        },
      ],
    };
  }, [filtered]);

  if (loadingStudents) {
    return (
      <div style={{ padding: 32 }}>
        <div className="dash-skeleton">
          {[1, 2, 3].map((i) => <div key={i} className="dash-skeleton-bar" style={{ height: 64 }} />)}
        </div>
      </div>
    );
  }

  if (studentsError) {
    return (
      <div style={{ padding: 32 }}>
        <EmptyState variant="warning" title="Não foi possível carregar os alunos" description={studentsError} />
      </div>
    );
  }

  return (
    <div className="pp-page" style={{ padding: 16 }}>
      {/* Header */}
      <div className="pp-hero" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="pp-kicker">Carteira acompanhada</div>
          <h2 className="pp-title" style={{ fontSize: 24 }}>Ver alunos</h2>
          <div className="pp-meta">
            Total: <b style={{ color: COLORS.text }}>{filtered.length}</b> aluno(s)
          </div>
          <div className="pp-subtitle" style={{ maxWidth: 620 }}>
            Leia sinais de aderência, risco e evolução sem transformar pessoas em linhas de CRM.
          </div>
        </div>

        <div className="pp-actions">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar aluno..."
            className="pp-input"
            style={{ minWidth: 220 }}
          />

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>Filtrar por plano</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | Plan)}
              className="pp-select"
            >
              <option value="all">Todos</option>
              <option value="basic">Básico</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="black">Black</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button
              type="button"
              className="pp-btn pp-btn--quiet pp-btn--sm"
              onClick={openInviteModal}
            >
              + Convidar por link
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--primary pp-btn--sm"
              onClick={openRegisterModal}
            >
              + Cadastrar aluno
            </button>
          </div>
        </div>
      </div>

      <div className="pp-panel">
        <div className="pp-panel__body" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div className="pp-panel__title">Sinais da carteira</div>
          <div className="pp-panel__subtitle">
            Leitura rápida da carteira filtrada. Exemplo: <b style={{ color: COLORS.text }}>{statusSummary.items[2].value} aluno(s) em risco</b>.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            height: 8,
            overflow: "hidden",
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
            background: "#FAFAFA",
          }}
        >
          {statusSummary.segments.map((segment) =>
            segment.width === "0%" ? null : (
              <div key={segment.key} style={{ width: segment.width, background: segment.bg }} />
            )
          )}
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {statusSummary.items.map((item) => (
            <div
              key={item.key}
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "#FFFFFF",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>
                {item.label}
              </div>
              <div className="pp-metric__value">{item.value}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>
                {statusSummary.total ? Math.round((item.value / statusSummary.total) * 100) : 0}% da carteira atual
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* List */}
      <div className="pp-panel">
        <div className="pp-panel__body" style={{ display: "grid" }}>
        {filtered.length === 0 && (
          <EmptyState
            variant={q || filter !== "all" ? "info" : "empty"}
            title={
              q || filter !== "all"
                ? "Nenhum aluno com esses filtros"
                : "Carteira ainda vazia"
            }
            description={
              q || filter !== "all"
                ? "Ajuste o filtro de plano ou o termo de busca."
                : "Seus alunos aparecerão aqui assim que forem atribuídos pela academia ou convidados diretamente."
            }
          />
        )}
        {filtered.map((s) => {
          return (
            <div
              key={s.id}
              className="pp-student-row"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = COLORS.cardHover;
                (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.borderStrong;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = COLORS.card;
                (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.border;
              }}
            >
              <div className="pp-student-main">
                <div className="pp-inline">
                  <button type="button" className="pp-name" onClick={() => setSelectedStudent({ id: s.id, name: s.name })}>
                    {s.name}
                  </button>
                  <span style={planPillStyle(s.plan)}>Plano: {PLAN_LABEL[s.plan]}</span>
                  {statusPill(s.engagementStatus)}
                </div>

                <div className="pp-meta">
                  Último treino: <b style={{ color: COLORS.text }}>{fmtDate(s.lastWorkoutISO)}</b> • Último check-in:{" "}
                  <b style={{ color: COLORS.text }}>{fmtDate(s.lastCheckinISO)}</b> • Aderência:{" "}
                  <b style={{ color: COLORS.text }}>{s.adherencePct}%</b>
                </div>
              </div>

              <div className="pp-actions">
                <button
                  type="button"
                  onClick={() => setSelectedStudent({ id: s.id, name: s.name })}
                  className="pp-btn pp-btn--quiet pp-btn--sm"
                >
                  Ver aluno
                </button>
                <ActionLink to={routes.workoutBuilder(s.id)} label="Criar treino" />
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Pending invites accordion */}
      <div className="pp-panel" style={{ marginTop: 12 }}>
        <div className="pp-panel__body">
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 650,
              fontSize: 14,
              color: COLORS.text,
              padding: 0,
              width: "100%",
            }}
            onClick={() => {
              const next = !showInvites;
              setShowInvites(next);
              if (next && invites.length === 0) loadInvites();
            }}
          >
            <span style={{ fontSize: 10, color: COLORS.muted }}>{showInvites ? "▲" : "▼"}</span>
            Convites diretos enviados
            {invites.filter((i) => i.status === "pending").length > 0 && (
              <span style={{
                padding: "2px 8px", borderRadius: 999,
                background: COLORS.primarySoft, border: `1px solid ${COLORS.borderStrong}`,
                fontSize: 12, fontWeight: 650,
              }}>
                {invites.filter((i) => i.status === "pending").length} pendente(s)
              </span>
            )}
          </button>

          {showInvites ? (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {invitesLoading ? (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando…</div>
              ) : invites.length === 0 ? (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Nenhum convite enviado ainda. Use o botão "+ Convidar aluno direto" para gerar um link.
                </div>
              ) : (
                invites.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FFFFFF",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      opacity: inv.status !== "pending" ? 0.65 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 650, fontSize: 13 }}>
                        {inv.invited_name || inv.invitedName || "Aluno sem nome"}
                        {(inv.invited_email || inv.invitedEmail) && (
                          <span style={{ fontWeight: 400, color: COLORS.muted, marginLeft: 6 }}>
                            {inv.invited_email || inv.invitedEmail}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        Status: <b>{inv.status === "pending" ? "Aguardando" : inv.status === "accepted" ? "Aceito" : inv.status === "revoked" ? "Revogado" : "Expirado"}</b>
                        {inv.accepted_user_name || inv.acceptedUserName
                          ? ` · Aceito por: ${inv.accepted_user_name || inv.acceptedUserName}`
                          : ""}
                        {" · Expira: "}
                        {new Date(inv.expires_at || inv.expiresAt).toLocaleDateString("pt-BR")}
                      </div>
                      {inv.status === "pending" ? (
                        <div style={{ marginTop: 6 }}>
                          <input
                            readOnly
                            value={inv.inviteUrl}
                            style={{
                              width: "100%",
                              fontSize: 11,
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${COLORS.border}`,
                              background: "#F9FAFB",
                              color: COLORS.muted,
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      ) : null}
                    </div>
                    {inv.status === "pending" ? (
                      <button
                        type="button"
                        className="pp-btn pp-btn--quiet pp-btn--sm"
                        onClick={() => void handleRevoke(inv.id)}
                        style={{ flexShrink: 0 }}
                      >
                        Revogar
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      {selectedStudent ? (
        <StudentProfileModal
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      ) : null}

      {/* Register modal */}
      {showRegisterModal ? (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowRegisterModal(false); } }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: 28,
              maxWidth: 480,
              width: "100%",
              display: "grid",
              gap: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text }}>Cadastrar aluno</div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: COLORS.muted, lineHeight: 1 }}
              >×</button>
            </div>

            {regSuccess ? (
              <>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${COLORS.successBorder}`,
                    background: COLORS.successBg,
                    fontSize: 14,
                    color: COLORS.text,
                    lineHeight: 1.5,
                  }}
                >
                  {regSuccess.isNew
                    ? <><b>{regSuccess.name}</b> foi cadastrado e adicionado à sua carteira.</>
                    : <><b>{regSuccess.name}</b> já tinha conta — vinculado à sua carteira
                        {regSuccess.matchedBy ? ` por ${regSuccess.matchedBy === "email" ? "e-mail" : regSuccess.matchedBy === "cpf" ? "CPF" : "telefone"}` : ""}.
                      </>
                  }
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="pp-btn pp-btn--quiet pp-btn--sm"
                    onClick={() => { setRegSuccess(null); setRegName(""); setRegEmail(""); setRegPhone(""); setRegCpf(""); }}
                  >Cadastrar outro</button>
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary pp-btn--sm"
                    onClick={() => setShowRegisterModal(false)}
                  >Fechar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
                  Preencha os dados do aluno. Se já tiver conta, será vinculado automaticamente.
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                      Nome completo <span style={{ color: COLORS.danger }}>*</span>
                    </label>
                    <input
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ex: Maria Souza"
                      className="pp-input"
                      style={{ width: "100%" }}
                      maxLength={255}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                      E-mail <span style={{ color: COLORS.danger }}>*</span>
                    </label>
                    <input
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="aluno@email.com"
                      type="email"
                      className="pp-input"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                        Telefone (opcional)
                      </label>
                      <input
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        type="tel"
                        className="pp-input"
                        style={{ width: "100%" }}
                        maxLength={20}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                        CPF (opcional)
                      </label>
                      <input
                        value={regCpf}
                        onChange={(e) => setRegCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="pp-input"
                        style={{ width: "100%" }}
                        maxLength={14}
                      />
                    </div>
                  </div>
                </div>

                {regError ? (
                  <div style={{ color: COLORS.danger, fontSize: 13, background: COLORS.dangerBg, border: `1px solid ${COLORS.dangerBorder}`, borderRadius: 8, padding: "8px 12px" }}>
                    {regError}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="pp-btn pp-btn--quiet pp-btn--sm" onClick={() => setShowRegisterModal(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary pp-btn--sm"
                    disabled={regLoading || !regName.trim() || !regEmail.trim()}
                    onClick={() => void handleRegister()}
                  >
                    {regLoading ? "Cadastrando…" : "Cadastrar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Invite modal */}
      {showInviteModal ? (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeInviteModal(); }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: 28,
              maxWidth: 480,
              width: "100%",
              display: "grid",
              gap: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                Convidar aluno direto
              </div>
              <button
                type="button"
                onClick={closeInviteModal}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: COLORS.muted, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {!createdInviteUrl ? (
              <>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
                  Gere um link de convite. O aluno se cadastra pelo link e já aparece na sua carteira — sem precisar de academia.
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                      Nome do aluno (opcional)
                    </label>
                    <input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="pp-input"
                      style={{ width: "100%" }}
                      maxLength={255}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                      E-mail do aluno (opcional)
                    </label>
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="aluno@email.com"
                      type="email"
                      className="pp-input"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                {inviteError ? (
                  <div style={{ color: COLORS.danger, fontSize: 13, background: COLORS.dangerBg, border: `1px solid ${COLORS.dangerBorder}`, borderRadius: 8, padding: "8px 12px" }}>
                    {inviteError}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="pp-btn pp-btn--quiet pp-btn--sm" onClick={closeInviteModal}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary pp-btn--sm"
                    disabled={inviteLoading}
                    onClick={() => void handleCreateInvite()}
                  >
                    {inviteLoading ? "Gerando…" : "Gerar link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
                  Link gerado com sucesso! Validade de 14 dias. Copie e envie ao aluno pelo canal que preferir.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={inviteUrlRef}
                    readOnly
                    value={createdInviteUrl}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                      background: "#F9FAFB",
                      color: COLORS.text,
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary pp-btn--sm"
                    onClick={copyInviteUrl}
                    style={{ flexShrink: 0 }}
                  >
                    Copiar
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" className="pp-btn pp-btn--quiet pp-btn--sm" onClick={closeInviteModal}>
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
