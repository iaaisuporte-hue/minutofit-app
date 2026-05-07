import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchPersonalDashboard,
  type PersonalDashboardGoal,
  type PersonalDashboardPlan,
  type PersonalDashboardRisk,
  type PersonalDashboardStudent,
} from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";

/** ✅ (0) TIPOS DO PLANO (usei na tabela “Visão geral”) */
type UserPlan = PersonalDashboardPlan;

/** ✅ (1) LABEL DO PLANO (usei na tabela “Visão geral”) */
const PLAN_LABEL: Record<UserPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

type Student = Omit<PersonalDashboardStudent, "goal" | "risk"> & {
  goal: PersonalDashboardGoal;
  risk: PersonalDashboardRisk;
  lastWorkoutISO: string | null;
};

type OverviewFilter = "all" | "critico" | "alerta" | "ok" | "inactive7d";

/** ✅ ROTAS ABSOLUTAS (ANTI-LOOP) */
const PERSONAL_BASE = "/app/personal" as const;
const routes = {
  dashboard: () => `${PERSONAL_BASE}/dashboard`,
  students: () => `${PERSONAL_BASE}/students`,
  consulting: () => `${PERSONAL_BASE}/consulting`,
  messages: () => `${PERSONAL_BASE}/messages`,
  review: () => `${PERSONAL_BASE}/review`,
  library: () => `${PERSONAL_BASE}/library`,
  // ✅ mantenho /new por compatibilidade (se já existe no seu router)
  workoutNew: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}/workouts/new`,
  // ✅ quando você ativar o builder, é só trocar onde usa:
  workoutBuilder: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}/workouts/builder`,
} as const;

/** ✅ SAFE NAVIGATE: força sempre path absoluto */
function toAbsolute(path: string) {
  if (!path) return PERSONAL_BASE;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "--/--";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "--/--";
  }
}

function daysSinceIso(iso?: string | null) {
  if (!iso) return 999;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return 999;
  return Math.floor((Date.now() - value) / (1000 * 60 * 60 * 24));
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function Badge({
  variant,
  children,
}: {
  variant: "success" | "warn" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const map = {
    success: { bd: COLORS.borderStrong, bg: COLORS.primarySoft, color: "#22C55E" },
    warn: { bd: "rgba(255,183,3,.35)", bg: COLORS.warnSoft, color: "#FFE082" },
    danger: { bd: "rgba(220,38,38,.35)", bg: COLORS.dangerSoft, color: "#FFB4B4" },
    neutral: { bd: COLORS.border, bg: COLORS.highlightSoft, color: COLORS.text },
  } as const;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${map[variant].bd}`,
        background: map[variant].bg,
        fontWeight: 600,
        fontSize: 11,
        lineHeight: 1,
        color: map[variant].color,
        whiteSpace: "nowrap",
        width: "fit-content",
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
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
      <div
        style={{
          padding: 14,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
        >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{title}</div>
          {subtitle ? (
            <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.4 }}>{subtitle}</div>
          ) : null}
        </div>
        {right ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div> : null}
      </div>

      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = clamp(Math.round(value), 0, 100);
  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        background: "#F9FAFB",
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
      }}
      aria-label={`Progresso ${pct}%`}
      title={`${pct}%`}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "#22C55E",
          transition: "width .25s ease",
        }}
      />
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        border: primary ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
        background: primary ? "#22C55E" : "#FAFAFA",
        color: primary ? "#FFFFFF" : COLORS.text,
        cursor: "pointer",
        fontWeight: primary ? 1000 : 900,
        fontSize: 14,
        boxShadow: primary ? "0 14px 28px rgba(34,197,94,.22)" : "none",
      }}
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");

  /** ✅ helper local: só aceita rotas absolutas */
  function go(path: string) {
    navigate(toAbsolute(path));
  }

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPersonalDashboard();

        if (!active) return;
        setStudents(data?.students ?? []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Nao foi possivel carregar o dashboard.");
        setStudents([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = students.length;
    const total7d = students.reduce((acc, s) => acc + s.workouts7d, 0);
    const total30d = students.reduce((acc, s) => acc + s.workouts30d, 0);
    const avg7d = total ? total7d / total : 0;
    const avg30d = total ? total30d / total : 0;

    const atRisk = students.filter((s) => s.risk !== "ok");
    const critical = students.filter((s) => s.risk === "critico");
    const ok = students.filter((s) => s.risk === "ok");

    const most = [...students].sort((a, b) => b.workouts7d - a.workouts7d)[0];
    const least = [...students].sort((a, b) => a.workouts7d - b.workouts7d)[0];

    const needsFollowUp = [...students]
      .filter((s) => s.risk === "critico" || (s.risk === "alerta" && s.workouts7d <= 1))
      .sort((a, b) => a.adherencePct - b.adherencePct)
      .slice(0, 4);

    return {
      total,
      total7d,
      total30d,
      avg7d: Math.round(avg7d * 10) / 10,
      avg30d: Math.round(avg30d * 10) / 10,
      okCount: ok.length,
      alertCount: atRisk.length - critical.length,
      criticalCount: critical.length,
      most,
      least,
      needsFollowUp,
    };
  }, [students]);

  const overviewStudents = useMemo(() => {
    const filteredStudents = students.filter((student) => {
      if (overviewFilter === "all") return true;
      if (overviewFilter === "inactive7d") return daysSinceIso(student.lastWorkoutISO) >= 7;
      return student.risk === overviewFilter;
    });

    return [...filteredStudents]
      .sort((a, b) => {
        const riskWeight = { critico: 0, alerta: 1, ok: 2 } as const;
        const riskDiff = riskWeight[a.risk] - riskWeight[b.risk];
        if (riskDiff !== 0) return riskDiff;
        return a.adherencePct - b.adherencePct;
      })
      .slice(0, 6);
  }, [students, overviewFilter]);

  const overviewFilterMeta = useMemo(
    () => [
      { id: "all" as const, label: "Todos", count: students.length },
      { id: "critico" as const, label: "Críticos", count: students.filter((student) => student.risk === "critico").length },
      { id: "alerta" as const, label: "Alerta", count: students.filter((student) => student.risk === "alerta").length },
      { id: "ok" as const, label: "Ok", count: students.filter((student) => student.risk === "ok").length },
      { id: "inactive7d" as const, label: "7+ dias sem treino", count: students.filter((student) => daysSinceIso(student.lastWorkoutISO) >= 7).length },
    ],
    [students]
  );

  function riskBadge(risk: Student["risk"]) {
    if (risk === "ok") return <Badge variant="success">Ok</Badge>;
    if (risk === "alerta") return <Badge variant="warn">Alerta</Badge>;
    return <Badge variant="danger">Crítico</Badge>;
  }

  return (
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      {/* Header */}
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 24,
          padding: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              background: COLORS.highlightSoft,
              color: "#22C55E",
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            Painel do personal
          </div>
          <div style={{ fontWeight: 700, fontSize: 28, lineHeight: 1.08 }}>Priorize quem precisa de você agora.</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5, maxWidth: 640 }}>
            Contato imediato, evolução recente e sinais de risco em uma leitura rápida.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ActionButton primary onClick={() => go(routes.messages())}>Abrir mensagens</ActionButton>
          <ActionButton onClick={() => go(routes.students())}>Ver alunos</ActionButton>
          <ActionButton onClick={() => go(routes.library())}>Treinos gerais</ActionButton>
        </div>
      </div>

      {loading ? (
        <Card
          title="Carregando dashboard"
          subtitle="Organizando a carteira."
          right={<Badge variant="neutral">Atualizando</Badge>}
        >
          <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.5 }}>
            Em instantes a tela mostra quem precisa da sua atenção primeiro.
          </div>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card
          title="Nao conseguimos atualizar este painel"
          subtitle="Tente atualizar novamente."
          right={<Badge variant="danger">Falha</Badge>}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.5 }}>{error}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton onClick={() => window.location.reload()}>Tentar novamente</ActionButton>
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && !error && students.length === 0 ? (
        <Card
          title="Sua carteira ainda esta vazia"
          subtitle="Ative alunos para começar o acompanhamento."
          right={<Badge variant="neutral">Sem dados</Badge>}
        >
          <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.5 }}>
            Volte aqui depois de ativar seus primeiros alunos para acompanhar consistência, aderência e follow-up.
          </div>
        </Card>
      ) : null}

      {!loading && !error && students.length > 0 ? (
        <>
      {/* Prioridades do dia */}
      <Card title="Prioridades do dia" subtitle="Contato imediato" right={<Badge variant="neutral">Fila</Badge>}>
        <div style={{ display: "grid", gap: 10 }}>
          {stats.needsFollowUp.length === 0 ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Nenhuma pendência crítica no momento.</div>
          ) : (
            stats.needsFollowUp.map((s) => (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${s.risk === "critico" ? "rgba(220,38,38,.22)" : COLORS.border}`,
                  borderRadius: 18,
                  background: s.risk === "critico" ? "rgba(220,38,38,.08)" : "#FAFAFA",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    {riskBadge(s.risk)}
                    <Badge variant="neutral">{s.workouts7d}x semana</Badge>
                    <Badge variant="neutral">{s.streakDays} dias</Badge>
                  </div>

                  <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}>
                    Último treino <b>{fmtDate(s.lastWorkoutISO)}</b> • Aderência <b>{s.adherencePct}%</b>
                    {s.notes ? (
                      <>
                        {" "}
                        • <b>{s.notes}</b>
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton
                    onClick={() =>
                      navigate(routes.messages(), {
                        state: {
                          studentId: s.id,
                          studentName: s.name,
                        },
                      })
                    }
                  >
                    Mensagem
                  </ActionButton>
                  <ActionButton
                    primary
                    onClick={() => {
                      navigate(routes.workoutBuilder(s.id), {
                        state: {
                          studentId: s.id,
                          studentName: s.name,
                        },
                      });
                    }}
                  >
                    Ajustar treino
                  </ActionButton>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Card
          title="Atividade (7 dias)"
          subtitle="Média por aluno"
          right={<Badge variant="neutral">{stats.total7d} treinos</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.avg7d}/sem</div>
            <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Ritmo recente da carteira.</div>
          </div>
        </Card>

        <Card
          title="Consistência (30 dias)"
          subtitle="Volume médio"
          right={<Badge variant="neutral">{stats.total30d} treinos</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.avg30d}/mês</div>
            <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Sinal de manutenção do plano.</div>
          </div>
        </Card>

        <Card
          title="Risco de abandono"
          subtitle="Exigem atenção"
          right={<Badge variant="warn">Alerta + crítico</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.alertCount + stats.criticalCount}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge variant="success">Ok: {stats.okCount}</Badge>
              <Badge variant="warn">Alerta: {stats.alertCount}</Badge>
              <Badge variant="danger">Crítico: {stats.criticalCount}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Destaques */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card
          title="Top performer da semana"
          subtitle="Melhor resposta recente"
          right={<Badge variant="success">Em alta</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{stats.most?.name || "-"}</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Último treino: {stats.most ? fmtDate(stats.most.lastWorkoutISO) : "--/--"} • Streak:{" "}
                  <b style={{ color: "#22C55E" }}>{stats.most?.streakDays || 0} dias</b>
                </div>
              </div>

              <Badge variant="neutral">{stats.most?.workouts7d || 0}x semana</Badge>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>Aderência ao plano</div>
              <ProgressBar value={stats.most?.adherencePct || 0} />
            </div>

            <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Próxima ação: revisar progressão.</div>
          </div>
        </Card>

        <Card
          title="Precisa de resgate"
          subtitle="Maior risco de esfriar"
          right={<Badge variant="danger">Urgente</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{stats.least?.name || "-"}</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Último treino: {stats.least ? fmtDate(stats.least.lastWorkoutISO) : "--/--"} • Objetivo:{" "}
                  <b style={{ color: COLORS.text }}>{stats.least?.goal || "-"}</b>
                </div>
              </div>

              <Badge variant="neutral">{stats.least?.workouts7d || 0}x semana</Badge>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>Aderência ao plano</div>
              <ProgressBar value={stats.least?.adherencePct || 0} />
            </div>

            <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Próxima ação: contato simples e retomada.</div>
          </div>
        </Card>
      </div>

      {/* Visão geral */}
      <Card
        title="Carteira em foco"
        subtitle="Recorte dos alunos que mais pedem leitura agora"
        right={<Badge variant="neutral">{students.length} alunos na carteira</Badge>}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {overviewFilterMeta.map((item) => {
            const active = item.id === overviewFilter;
            return (
              <button
                key={item.id}
                onClick={() => setOverviewFilter(item.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                  background: active ? COLORS.primarySoft : "#FAFAFA",
                  color: COLORS.text,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 900 : 800,
                  lineHeight: 1,
                }}
              >
                {item.label} · {item.count}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {overviewStudents.map((s) => (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 18,
                  background: "#FAFAFA",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 8, minWidth: "min(260px, 100%)", flex: "1 1 260px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    {riskBadge(s.risk)}
                  </div>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.45 }}>
                    Último: {fmtDate(s.lastWorkoutISO)} • Objetivo: {s.goal} • Plano: {PLAN_LABEL[s.plan]}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, minWidth: 220, flex: "1 1 220px" }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Semana</div>
                      <div style={{ fontWeight: 700 }}>{s.workouts7d} treinos</div>
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Streak</div>
                      <div style={{ fontWeight: 700 }}>{s.streakDays} dias</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Aderência</div>
                    <ProgressBar value={s.adherencePct} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton
                    onClick={() =>
                      navigate(routes.messages(), {
                        state: {
                          studentId: s.id,
                          studentName: s.name,
                        },
                      })
                    }
                  >
                    Mensagem
                  </ActionButton>
                </div>
              </div>
            ))}
        </div>

        {overviewStudents.length === 0 ? (
          <div
            style={{
              marginTop: 8,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              padding: 14,
              color: COLORS.muted,
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            Nenhum aluno encontrado para este recorte.
          </div>
        ) : null}

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.45 }}>
            Mostrando 6 alunos priorizados por risco e aderência. A base completa continua em “Ver alunos”.
          </div>
          <ActionButton onClick={() => go(routes.students())}>Abrir base completa</ActionButton>
        </div>
      </Card>
        </>
      ) : null}
    </div>
  );
}
