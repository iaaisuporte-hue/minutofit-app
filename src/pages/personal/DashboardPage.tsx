import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchPersonalDashboard,
  type PersonalDashboardAlert,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardRisk,
  type PersonalDashboardStudent,
} from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";
import { useIsMobile } from "../../hooks/useIsMobile";
import IntelligentAlerts from "./IntelligentAlerts";
import StudentProfileModal from "./StudentProfileModal";
import "./personalPremium.css";

type OverviewFilter = "all" | "attention" | "fading" | "at_risk" | "evolving";

const PERSONAL_BASE = "/app/personal" as const;
const PLAN_LABEL: Record<PersonalDashboardPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

const routes = {
  students: () => `${PERSONAL_BASE}/students`,
  messages: () => `${PERSONAL_BASE}/messages`,
  review: () => `${PERSONAL_BASE}/review`,
  library: () => `${PERSONAL_BASE}/library`,
  workoutBuilder: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}/workouts/builder`,
} as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "--/--";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warn" | "danger" | "soft";
  children: React.ReactNode;
}) {
  return (
    <span className={`pp-badge pp-badge--${tone}`}>
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
    <section className="pp-panel">
      <div className="pp-panel__header">
        <div style={{ display: "grid", gap: 5 }}>
          <div className="pp-panel__title">{title}</div>
          {subtitle ? <div className="pp-panel__subtitle">{subtitle}</div> : null}
        </div>
        {right ? <div className="pp-inline">{right}</div> : null}
      </div>
      <div className="pp-panel__body">{children}</div>
    </section>
  );
}

function ActionButton({
  children,
  primary = false,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pp-btn ${primary ? "pp-btn--primary" : "pp-btn--ghost"}`}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="pp-progress">
      <div className="pp-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

function statusTone(status: PersonalDashboardEngagementStatus): "success" | "soft" | "warn" | "danger" {
  if (status === "evolving") return "success";
  if (status === "on_track") return "soft";
  if (status === "attention") return "warn";
  return "danger";
}

function statusLabel(status: PersonalDashboardEngagementStatus) {
  if (status === "evolving") return "Evoluindo";
  if (status === "on_track") return "No ritmo";
  if (status === "attention") return "Atenção";
  if (status === "fading") return "Sumindo";
  return "Em risco";
}

function riskTone(risk: PersonalDashboardRisk): "success" | "warn" | "danger" {
  if (risk === "ok") return "success";
  if (risk === "alerta") return "warn";
  return "danger";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(720);
  const [students, setStudents] = useState<PersonalDashboardStudent[]>([]);
  const [alerts, setAlerts] = useState<PersonalDashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPersonalDashboard();
        if (!active) return;
        setStudents(data?.students ?? []);
        setAlerts(data?.summary.intelligentAlerts ?? []);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar o dashboard.");
        setStudents([]);
        setAlerts([]);
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
    const totalStudents = students.length;
    const total7d = students.reduce((sum, student) => sum + student.workouts7d, 0);
    const total30d = students.reduce((sum, student) => sum + student.workouts30d, 0);
    const most = [...students].sort((a, b) => b.workouts7d - a.workouts7d)[0] || null;
    const least = [...students].sort((a, b) => a.adherencePct - b.adherencePct)[0] || null;
    const needsFollowUp = [...students]
      .filter((student) => student.engagementStatus !== "on_track" && student.engagementStatus !== "evolving")
      .sort((a, b) => a.adherencePct - b.adherencePct)
      .slice(0, 4);

    return {
      totalStudents,
      total7d,
      total30d,
      avg7d: totalStudents ? Math.round((total7d / totalStudents) * 10) / 10 : 0,
      avg30d: totalStudents ? Math.round((total30d / totalStudents) * 10) / 10 : 0,
      most,
      least,
      needsFollowUp,
      evolving: students.filter((student) => student.engagementStatus === "evolving").length,
      attention: students.filter((student) => student.engagementStatus === "attention").length,
      fading: students.filter((student) => student.engagementStatus === "fading").length,
      atRisk: students.filter((student) => student.engagementStatus === "at_risk").length,
    };
  }, [students]);

  const overviewStudents = useMemo(() => {
    return students
      .filter((student) => {
        if (overviewFilter === "all") return true;
        return student.engagementStatus === overviewFilter;
      })
      .sort((a, b) => a.adherencePct - b.adherencePct)
      .slice(0, 6);
  }, [overviewFilter, students]);

  function openStudent(studentId: string, studentName?: string) {
    const fallback = students.find((student) => student.id === studentId)?.name || studentName || "Aluno";
    setSelectedStudent({ id: studentId, name: fallback });
  }

  return (
    <div className="pp-page">
      <div className="pp-hero">
        <div style={{ display: "grid", gap: 6 }}>
          <div className="pp-kicker">Workspace metabólico</div>
          <h1 className="pp-title">Acompanhe o dia do aluno, não só a ficha.</h1>
          <div className="pp-subtitle">
            Prioridades, sinais de retenção e perfil rápido do aluno organizados para você agir antes do abandono.
          </div>
        </div>

        <div className="pp-actions">
          <ActionButton primary onClick={() => navigate(routes.messages())}>Abrir mensagens</ActionButton>
          <ActionButton onClick={() => navigate(routes.students())}>Ver alunos</ActionButton>
          <button type="button" className="pp-btn pp-btn--quiet" onClick={() => navigate(routes.review())}>
            Revisar treinos
          </button>
        </div>
      </div>

      {loading ? (
        <Card title="Carregando dashboard" subtitle="Organizando prioridades e sinais da carteira." right={<Badge tone="neutral">Atualizando</Badge>}>
          <div style={{ color: COLORS.muted, fontSize: 14 }}>Em instantes a área do personal mostra quem precisa de atenção primeiro.</div>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card title="Nao foi possivel carregar o dashboard" subtitle="Tente atualizar novamente." right={<Badge tone="danger">Falha</Badge>}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>{error}</div>
            <ActionButton onClick={() => window.location.reload()}>Tentar novamente</ActionButton>
          </div>
        </Card>
      ) : null}

      {!loading && !error && students.length === 0 ? (
        <Card title="Sua carteira ainda está vazia" subtitle="Ative alunos para começar o acompanhamento." right={<Badge tone="neutral">Sem dados</Badge>}>
          <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.5 }}>
            Quando houver alunos atribuídos, esta tela passa a priorizar quem está evoluindo, sumindo ou pedindo ajuste de treino.
          </div>
        </Card>
      ) : null}

      {!loading && !error && students.length > 0 ? (
        <>
          <Card title="Prioridades do dia" subtitle="Quem merece ação imediata nas próximas horas." right={<Badge tone="soft">Top 4</Badge>}>
            <div style={{ display: "grid" }}>
              {stats.needsFollowUp.map((student) => (
                <div key={student.id} className="pp-student-row">
                  <div className="pp-student-main">
                    <div className="pp-inline">
                      <button
                        type="button"
                        onClick={() => openStudent(student.id, student.name)}
                        className="pp-name"
                      >
                        {student.name}
                      </button>
                      <Badge tone={statusTone(student.engagementStatus)}>{statusLabel(student.engagementStatus)}</Badge>
                      {student.risk !== "ok" ? <Badge tone={riskTone(student.risk)}>{student.risk === "critico" ? "Risco alto" : "Sinal fraco"}</Badge> : null}
                    </div>
                    <div className="pp-meta">
                      Último treino <b>{fmtDate(student.lastWorkoutISO)}</b> • Último check-in <b>{fmtDate(student.lastCheckinISO)}</b> • Aderência{" "}
                      <b>{student.adherencePct}%</b> • {student.workouts7d}x na semana
                    </div>
                  </div>

                  <div className="pp-actions">
                    <button type="button" className="pp-btn pp-btn--quiet" onClick={() => openStudent(student.id, student.name)}>
                      Ver aluno
                    </button>
                    <button type="button" className="pp-btn pp-btn--primary" onClick={() => navigate(routes.workoutBuilder(student.id))}>
                      Criar treino
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Alertas inteligentes" subtitle="Sinais automáticos de retenção, reconhecimento e risco." right={<Badge tone="neutral">{alerts.length} alerta(s)</Badge>}>
            <IntelligentAlerts alerts={alerts} onOpenStudent={openStudent} onOpenStudents={() => navigate(routes.students())} />
          </Card>

          <div className="pp-grid">
            <Card title="Top performer da semana" subtitle="Melhor resposta recente" right={<Badge tone="success">Em alta</Badge>}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => stats.most && openStudent(stats.most.id, stats.most.name)}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        textAlign: "left",
                        cursor: "pointer",
                        fontWeight: 650,
                        fontSize: 16,
                        color: COLORS.text,
                      }}
                    >
                      {stats.most?.name || "-"}
                    </button>
                    <div style={{ color: COLORS.muted, fontSize: 13 }}>
                      Último treino: {stats.most ? fmtDate(stats.most.lastWorkoutISO) : "--/--"} • Streak: <b>{stats.most?.streakDays || 0} dias</b>
                    </div>
                  </div>
                  <Badge tone="soft">{stats.most?.workouts7d || 0}x semana</Badge>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Aderência ao plano</div>
                  <ProgressBar value={stats.most?.adherencePct || 0} />
                </div>
              </div>
            </Card>

            <Card title="Precisa de resgate" subtitle="Maior risco de esfriar o ciclo" right={<Badge tone="danger">Urgente</Badge>}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => stats.least && openStudent(stats.least.id, stats.least.name)}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        textAlign: "left",
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 16,
                        color: COLORS.text,
                      }}
                    >
                      {stats.least?.name || "-"}
                    </button>
                    <div style={{ color: COLORS.muted, fontSize: 13 }}>
                      Último treino: {stats.least ? fmtDate(stats.least.lastWorkoutISO) : "--/--"} • Objetivo:{" "}
                      <b>{stats.least?.goal || "-"}</b>
                    </div>
                  </div>
                  <Badge tone="warn">{stats.least?.adherencePct || 0}% aderência</Badge>
                </div>
                <ProgressBar value={stats.least?.adherencePct || 0} />
              </div>
            </Card>
          </div>

          <details
            open={!isMobile}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 14,
              background: COLORS.panel,
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                padding: 14,
                fontWeight: 650,
                color: COLORS.text,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              Métricas agregadas
            </summary>
            <div style={{ padding: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Card title="Atividade (7 dias)" subtitle="Média por aluno" right={<Badge tone="neutral">{stats.total7d} treinos</Badge>}>
                <div className="pp-metric__value">{stats.avg7d}/sem</div>
              </Card>
              <Card title="Consistência (30 dias)" subtitle="Volume médio" right={<Badge tone="neutral">{stats.total30d} treinos</Badge>}>
                <div className="pp-metric__value">{stats.avg30d}/mês</div>
              </Card>
              <Card title="Status da carteira" subtitle="Leitura operacional" right={<Badge tone="soft">{students.length} alunos</Badge>}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="success">Evoluindo: {stats.evolving}</Badge>
                  <Badge tone="warn">Atenção: {stats.attention}</Badge>
                  <Badge tone="danger">Sumindo + risco: {stats.fading + stats.atRisk}</Badge>
                </div>
              </Card>
            </div>
          </details>

          <Card title="Carteira em foco" subtitle="Recorte rápido dos alunos que pedem leitura agora." right={<Badge tone="neutral">{students.length} alunos</Badge>}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { id: "all" as const, label: "Todos" },
                { id: "attention" as const, label: "Atenção" },
                { id: "fading" as const, label: "Sumindo" },
                { id: "at_risk" as const, label: "Em risco" },
                { id: "evolving" as const, label: "Evoluindo" },
              ].map((item) => {
                const active = overviewFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOverviewFilter(item.id)}
                    className="pp-filter"
                    aria-pressed={active}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid" }}>
              {overviewStudents.map((student) => (
                <div key={student.id} className="pp-student-row">
                  <div className="pp-student-main">
                    <div className="pp-inline">
                      <button
                        type="button"
                        onClick={() => openStudent(student.id, student.name)}
                        className="pp-name"
                      >
                        {student.name}
                      </button>
                      <Badge tone={statusTone(student.engagementStatus)}>{statusLabel(student.engagementStatus)}</Badge>
                    </div>
                    <div className="pp-meta">
                      Último treino: {fmtDate(student.lastWorkoutISO)} • Último check-in: {fmtDate(student.lastCheckinISO)} • Plano: {PLAN_LABEL[student.plan]}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10, minWidth: 220, flex: "1 1 220px" }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Semana</div>
                        <div style={{ fontWeight: 650 }}>{student.workouts7d} treinos</div>
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>Streak</div>
                        <div style={{ fontWeight: 650 }}>{student.streakDays} dias</div>
                      </div>
                    </div>
                    <ProgressBar value={student.adherencePct} />
                  </div>

                  <div className="pp-actions">
                    <button type="button" className="pp-btn pp-btn--quiet" onClick={() => openStudent(student.id, student.name)}>
                      Ver aluno
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {selectedStudent ? (
        <StudentProfileModal
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      ) : null}
    </div>
  );
}
