import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { COLORS } from "../../styles/colors";
import {
  fetchPersonalStudentSnapshot,
  type PersonalStudentSnapshot,
} from "../../services/personalDashboardApi";
import {
  approveWorkoutReview,
  archiveWorkoutReview,
  fetchWorkoutReviews,
  requestChangesWorkoutReview,
  updateWorkoutReview,
  type WorkoutReview,
} from "../../services/workoutReviewsApi";
import { fetchPersonalDashboard } from "../../services/personalDashboardApi";

/**
 * ==========================================
 * ✅ REVIEW WORKOUTS (Personal) — Treinaí UI
 * ==========================================
 * O que essa tela resolve:
 * - Personal abre e enxerga a “fila” de revisões
 * - Decide rápido: aprova / pede ajuste / arquiva
 * - Prioriza quem está parado, quem é urgente e quem é Black
 *
 * MVP:
 * - Dados mock
 * - Pode persistir em localStorage (ligado abaixo)
 */

type Plan = "basic" | "silver" | "gold" | "black";

type ReviewStatus = "pending" | "changes_requested" | "approved" | "archived";

/** ✅ Item da fila */
type ReviewItem = {
  id: string;
  studentId: string;
  studentName: string;
  plan: Plan;

  title: string; // ex: "Treino A (Perna) - Semana 2"
  goal: "hipertrofia" | "emagrecimento" | "forca" | "condicionamento";
  createdAt: string; // ISO
  updatedAt: string; // ISO

  status: ReviewStatus;

  /** ✅ Sinais pro personal decidir rápido */
  risk: "low" | "medium" | "high"; // “alta chance de dar ruim”
  priority: "low" | "normal" | "high"; // urgência operacional
  lastCheckinAt?: string; // ISO (se o aluno está sumido)

  notes?: string; // observações do personal
  lastFeedback?: string; // último feedback enviado ao aluno (quando devolve)
};

function nowISO() {
  return new Date().toISOString();
}

/** ✅ Helpers de datas */
function hoursBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60));
}

function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

/** ✅ UI: Card base (mesmo padrão das telas Treinaí) */
function Card({ children, pad = 16 }: { children: React.ReactNode; pad?: number }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

/** ✅ UI: Pill/Badge */
function Pill({
  children,
  variant = "neutral",
  title,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "orange" | "success" | "warn" | "danger";
  title?: string;
}) {
  const map = {
    neutral: { bd: COLORS.border, bg: "#F9FAFB" },
    orange: { bd: COLORS.primaryBorder, bg: COLORS.primarySoft },
    success: { bd: COLORS.successBorder, bg: COLORS.successBg },
    warn: { bd: COLORS.warnBorder, bg: COLORS.warnBg },
    danger: { bd: COLORS.dangerBorder, bg: COLORS.dangerBg },
  } as const;

  return (
    <span
      title={title}
      style={{
        padding: "6px 10px", // ✅ (UI) “tamanho do chip”
        borderRadius: 999,
        border: `1px solid ${map[variant].bd}`,
        background: map[variant].bg,
        color: COLORS.text,
        fontWeight: 600,
        fontSize: 11,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        width: "fit-content",
        whiteSpace: "nowrap",
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {children}
    </span>
  );
}

/** ✅ UI: Button base */
function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const stylesByVariant: Record<typeof variant, React.CSSProperties> = {
    primary: {
      background: "#22C55E",
      border: `1px solid ${COLORS.primaryBorder}`,
      color: "#1F2937",
      boxShadow: "0 14px 28px rgba(34,197,94,.22)",
    },
    ghost: {
      background: "transparent",
      border: `1px solid ${COLORS.border}`,
      color: COLORS.text,
    },
    danger: {
      background: COLORS.dangerBg,
      border: `1px solid ${COLORS.dangerBorder}`,
      color: COLORS.text,
    },
  };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        fontSize: 14,
        opacity: disabled ? 0.6 : 1,
        ...stylesByVariant[variant],
      }}
    >
      {children}
    </button>
  );
}

/** ✅ Status label */
function statusLabel(s: ReviewStatus) {
  if (s === "pending") return "Pendente";
  if (s === "changes_requested") return "Ajustes solicitados";
  if (s === "approved") return "Aprovado";
  return "Arquivado";
}

function statusVariant(s: ReviewStatus): "neutral" | "warn" | "success" | "danger" {
  if (s === "pending") return "warn";
  if (s === "changes_requested") return "danger";
  if (s === "approved") return "success";
  return "neutral";
}

function planPill(plan: Plan) {
  if (plan === "black") return <Pill variant="orange">Black</Pill>;
  if (plan === "gold") return <Pill variant="neutral">Gold</Pill>;
  if (plan === "silver") return <Pill variant="neutral">Silver</Pill>;
  return <Pill variant="neutral">Básico</Pill>;
}

function mapReview(review: WorkoutReview, planByStudent: Map<string, Plan>): ReviewItem {
  return {
    id: review.id,
    studentId: review.studentId,
    studentName: review.studentName || `Aluno ${review.studentId}`,
    plan: planByStudent.get(review.studentId) || "basic",
    title: review.title,
    goal: (review.goal as ReviewItem["goal"]) || "hipertrofia",
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    status: review.status,
    risk: review.risk as ReviewItem["risk"],
    priority: review.priority as ReviewItem["priority"],
    lastCheckinAt: undefined,
    notes: review.internalNotes ?? undefined,
    lastFeedback: review.studentFeedback ?? undefined,
  };
}

/** ✅ Decide “urgência” (storytelling) */
function isUrgent(item: ReviewItem) {
  // ✅ (REGRA) urgente se > 48h e ainda pendente
  const ageH = hoursBetween(item.createdAt, nowISO());
  return item.status === "pending" && ageH >= 48;
}

export default function ReviewWorkoutsPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("pending");
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");
  const [sort, setSort] = useState<"priority" | "recent">("priority");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  /** ✅ Modal/drawer */
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const [studentContext, setStudentContext] = useState<PersonalStudentSnapshot | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [reviews, dashboard] = await Promise.all([
          fetchWorkoutReviews(),
          fetchPersonalDashboard(),
        ]);
        if (!active) return;
        const planByStudent = new Map<string, Plan>();
        (dashboard?.students ?? []).forEach((student) => {
          planByStudent.set(student.id, student.plan as Plan);
        });
        setQueue(reviews.map((review) => mapReview(review, planByStudent)));
        setLoadError(null);
      } catch (err: unknown) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Nao foi possivel carregar as revisoes.");
        setQueue([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /** ✅ KPIs */
  const kpis = useMemo(() => {
    const pending = queue.filter((q) => q.status === "pending").length;
    const urgent = queue.filter((q) => isUrgent(q)).length;

    const approvedToday = queue.filter((q) => {
      if (q.status !== "approved") return false;
      return daysBetween(new Date().toISOString(), q.updatedAt) === 0;
    }).length;

    const returned = queue.filter((q) => q.status === "changes_requested").length;

    return { pending, urgent, approvedToday, returned };
  }, [queue]);

  const summaryCards = useMemo(
    () => [
      { label: "Pendentes", value: kpis.pending, helper: "aguardando decisao" },
      { label: "Urgentes", value: kpis.urgent, helper: "48h+ sem resposta" },
      { label: "Aprovados hoje", value: kpis.approvedToday, helper: "ritmo do dia" },
      { label: "Devolvidos", value: kpis.returned, helper: "aguardando ajuste" },
    ],
    [kpis]
  );

  /** ✅ Filtrado */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = queue.slice();

    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (planFilter !== "all") list = list.filter((i) => i.plan === planFilter);

    if (q) {
      list = list.filter((i) => {
        const hay = `${i.studentName} ${i.title} ${i.goal} ${i.plan}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // ✅ Ordenação
    list.sort((a, b) => {
      if (sort === "recent") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

      // priority
      const score = (x: ReviewItem) => {
        let s = 0;
        if (x.status === "pending") s += 100;
        if (isUrgent(x)) s += 80;
        if (x.priority === "high") s += 40;
        if (x.plan === "black") s += 25;
        if (x.risk === "high") s += 20;
        return s;
      };
      return score(b) - score(a);
    });

    return list;
  }, [queue, query, statusFilter, planFilter, sort]);

  const selected = useMemo(() => queue.find((x) => x.id === openId) || null, [queue, openId]);

  useEffect(() => {
    if (!selected) {
      setStudentContext(null);
      return;
    }
    let active = true;
    setContextLoading(true);
    setStudentContext(null);
    fetchPersonalStudentSnapshot(selected.studentId)
      .then((snap) => {
        if (active) setStudentContext(snap);
      })
      .catch(() => {
        if (active) setStudentContext(null);
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  /** ✅ Abrir modal (carrega campos) */
  function open(item: ReviewItem) {
    setOpenId(item.id);
    setFeedback(item.lastFeedback || "");
    setNotes(item.notes || "");
  }

  function close() {
    setOpenId(null);
    setFeedback("");
    setNotes("");
  }

  function applyUpdate(updated: WorkoutReview, planByStudent?: Map<string, Plan>) {
    setQueue((prev) => {
      const map =
        planByStudent ?? new Map<string, Plan>(prev.map((q) => [q.studentId, q.plan]));
      return prev.map((q) => (q.id === updated.id ? mapReview(updated, map) : q));
    });
  }

  async function approve(id: string) {
    setActionError(null);
    try {
      const updated = await approveWorkoutReview(id, notes);
      applyUpdate(updated);
      close();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Nao foi possivel aprovar.");
    }
  }

  async function requestChanges(id: string) {
    setActionError(null);
    const message = feedback.trim() || "Ajustar detalhes da ficha.";
    try {
      const updated = await requestChangesWorkoutReview(id, message, notes);
      applyUpdate(updated);
      close();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Nao foi possivel pedir ajustes.");
    }
  }

  async function archive(id: string) {
    setActionError(null);
    try {
      const updated = await archiveWorkoutReview(id);
      applyUpdate(updated);
      close();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Nao foi possivel arquivar.");
    }
  }

  async function saveNotesOnly(id: string) {
    setActionError(null);
    try {
      const updated = await updateWorkoutReview(id, { internalNotes: notes });
      applyUpdate(updated);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      {/* ✅ Header */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            background: COLORS.panelDeep,
            borderRadius: 20,
            padding: 18,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 22 }}>Revisão de treinos</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45, maxWidth: 680 }}>
              Fila operacional para decidir rápido, devolver com contexto e evitar alunos travados no meio do ciclo.
            </div>
          </div>

          <Pill variant="orange" title="Padrão Treinaí">Fila de revisão</Pill>
        </div>
      </Card>

      {loading ? (
        <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando fila de revisões…</div>
      ) : null}
      {loadError ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.dangerBorder}`,
            background: COLORS.dangerBg,
            color: COLORS.text,
            fontSize: 13,
          }}
        >
          {loadError}
        </div>
      ) : null}
      {actionError ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.dangerBorder}`,
            background: COLORS.dangerBg,
            color: COLORS.text,
            fontSize: 13,
          }}
        >
          {actionError}
        </div>
      ) : null}

      {/* ✅ KPIs */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        }}
      >
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: COLORS.mutedSoft, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{card.value}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{card.helper}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ✅ Toolbar: busca + filtros */}
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por aluno, título, objetivo…"
            style={{
              flex: 1,
              minWidth: 240,

              // ✅ (UI) input padrão Treinaí
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              color: COLORS.text,
              outline: "none",
              fontWeight: 600,
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              color: COLORS.text,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="pending">Pendentes</option>
            <option value="all">Todos</option>
            <option value="approved">Aprovados</option>
            <option value="changes_requested">Ajustes solicitados</option>
            <option value="archived">Arquivados</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as any)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              color: COLORS.text,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="all">Todos os planos</option>
            <option value="basic">Básico</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="black">Black</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              color: COLORS.text,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="priority">Ordenar: Prioridade</option>
            <option value="recent">Ordenar: Mais recente</option>
          </select>
        </div>
      </Card>

      {/* ✅ Fila */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              variant="ok"
              title="Fila de revisão limpa"
              description="Nenhuma ficha aguarda avaliação com os filtros atuais. Os indicadores de risco e prioridade aparecem quando novos planos forem criados ou reabertos."
            />
          </Card>
        ) : (
          filtered.map((item) => {
            const urgent = isUrgent(item);
            const ageH = hoursBetween(item.createdAt, nowISO());
            const inactiveDays = item.lastCheckinAt ? daysBetween(item.lastCheckinAt, nowISO()) : null;

            const riskVariant = item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "neutral";
            const priVariant = item.priority === "high" ? "warn" : "neutral";

            return (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 18,
                  background: COLORS.card,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* ✅ Left */}
                <div style={{ display: "grid", gap: 8, minWidth: 320 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.studentName}</div>
                    {planPill(item.plan)}
                    <Pill variant={statusVariant(item.status)}>{statusLabel(item.status)}</Pill>

                    {urgent ? (
                      <Pill variant="danger" title="Mais de 48h pendente">Urgente</Pill>
                    ) : null}

                    <Pill variant={priVariant as any} title="Prioridade operacional">{item.priority}</Pill>

                    <Pill variant={riskVariant as any} title="Risco de execução">Risco {item.risk}</Pill>
                  </div>

                  <div style={{ color: COLORS.text, fontWeight: 600 }}>
                    {item.title}
                  </div>

                  <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}>
                    Objetivo: <b style={{ color: "#1F2937" }}>{item.goal}</b> • Criado há <b>{ageH}h</b>
                    {inactiveDays != null ? (
                      <>
                        {" "}
                        • Último check-in: <b>{inactiveDays} dia(s)</b>
                      </>
                    ) : null}
                  </div>

                  {item.notes ? (
                    <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.45 }}>
                      Nota interna: {item.notes}
                    </div>
                  ) : null}
                </div>

                {/* ✅ Right actions */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="ghost" onClick={() => open(item)}>
                    Revisar
                  </Button>

                  {item.status === "pending" ? (
                    <Button variant="primary" onClick={() => approve(item.id)}>
                      Aprovar rápido
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => open(item)}>
                      Abrir detalhes
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ Modal/Drawer simples */}
      {selected ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.60)",
            display: "grid",
            placeItems: "center",
            padding: 18,
            zIndex: 50,
          }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 860,
              borderRadius: 18,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panel,
              color: COLORS.text,
              boxShadow: "0 22px 70px rgba(15,23,42,.18)",
              overflow: "hidden",
            }}
          >
            {/* Header modal */}
            <div
              style={{
                padding: 16,
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>
                  Revisão • {selected.studentName}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>
                  Criado: <b style={{ color: COLORS.text }}>{formatDateTimeBR(selected.createdAt)}</b> • Atualizado:{" "}
                  <b style={{ color: COLORS.text }}>{formatDateTimeBR(selected.updatedAt)}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {planPill(selected.plan)}
                <Pill variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Pill>
              </div>
            </div>

            {/* Contexto do aluno */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.panelDeep,
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                fontSize: 12,
                color: COLORS.muted,
              }}
            >
              {contextLoading ? (
                <span>Carregando contexto do aluno…</span>
              ) : studentContext ? (
                <>
                  <span>
                    Metabolismo:{" "}
                    <b style={{ color: COLORS.text }}>
                      {studentContext.today.metabolism?.score ?? "—"}
                    </b>
                    {studentContext.today.metabolism
                      ? ` (${studentContext.today.metabolism.status}, ${studentContext.today.metabolism.trend})`
                      : ""}
                  </span>
                  <span>
                    Aderência: <b style={{ color: COLORS.text }}>{studentContext.adherencePct}%</b>
                  </span>
                  <span>
                    Último treino:{" "}
                    <b style={{ color: COLORS.text }}>
                      {studentContext.today.latestWorkout
                        ? formatDateTimeBR(studentContext.today.latestWorkout.completedAt)
                        : "—"}
                    </b>
                  </span>
                </>
              ) : (
                <span>Contexto do aluno indisponível.</span>
              )}
            </div>

            {/* Body modal */}
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <Card>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700, color: COLORS.text }}>{selected.title}</div>
                  <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
                    Objetivo: <b style={{ color: COLORS.text }}>{selected.goal}</b> • Risco:{" "}
                    <b style={{ color: COLORS.text }}>{selected.risk}</b> • Prioridade:{" "}
                    <b style={{ color: COLORS.text }}>{selected.priority}</b>
                  </div>
                </div>
              </Card>

              {/* ✅ Notes */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>
                  Observações internas (só personal)
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Ajustar volume, trocar exercício por alternativa, atenção a dor no joelho…"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "none",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FAFAFA",
                    color: COLORS.text,
                    outline: "none",
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      saveNotesOnly(selected.id);
                    }}
                    title="Salva apenas as observações internas"
                  >
                    Salvar observações
                  </Button>
                </div>
              </div>

              {/* ✅ Feedback ao aluno (quando devolve) */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>
                  Feedback para o aluno (quando pedir ajustes)
                </div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ex: Ajustei descanso, reduzi volume, manda um feedback de como sentiu…"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "none",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FAFAFA",
                    color: COLORS.text,
                    outline: "none",
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                />
                {selected.lastFeedback ? (
                  <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.35 }}>
                    Último feedback enviado: <b style={{ color: COLORS.text }}>{selected.lastFeedback}</b>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer modal */}
            <div
              style={{
                padding: 16,
                borderTop: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={close}>
                  Fechar
                </Button>

                <Button
                  variant="danger"
                  onClick={() => archive(selected.id)}
                  title="Arquiva (some da fila principal, mas fica salvo)"
                >
                  Arquivar
                </Button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  onClick={() => requestChanges(selected.id)}
                  title="Devolve para o aluno com feedback"
                  disabled={selected.status === "archived"}
                >
                  Pedir ajustes
                </Button>

                <Button
                  variant="primary"
                  onClick={() => approve(selected.id)}
                  title="Aprova o treino"
                  disabled={selected.status === "archived"}
                >
                  Aprovar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
