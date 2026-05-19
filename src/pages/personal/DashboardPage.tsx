import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchPersonalDashboard,
  type PersonalDashboardAlert,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardResponse,
  type PersonalDashboardStudent,
} from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";
import { useAdaptivePolling } from "../../hooks/useAdaptivePolling";
import { useAuth } from "../../auth/AuthContext";
import IntelligentAlerts from "./IntelligentAlerts";
import { EmptyState } from "../../components/EmptyState";
import StudentProfileModal from "./StudentProfileModal";
import PersonalQuickSearch from "./PersonalQuickSearch";
import {
  buildAttentionList,
  buildPortfolioHeadline,
  type StudentNarrative,
  type StudentNarrativeTone,
} from "./lib/studentNarrative";
import { AtRiskCard } from "../../features/personalRetention/AtRiskCard";
import { InsightsStrip } from "../../features/personalRetention/InsightsStrip";
import { FinancePanel } from "../../features/personalRetention/FinancePanel";
import { QuickMessageModal } from "../../features/personalRetention/QuickMessageModal";
import { useAtRiskStudents } from "../../features/personalRetention/useAtRiskStudents";
import { createRelationshipAction } from "../../services/personalRetentionApi";
import "./personalPremium.css";

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
  workoutBuilder: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}/workouts/builder`,
  studentWorkouts: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}?tab=workouts`,
} as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatShortTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warn" | "danger" | "soft";
  children: React.ReactNode;
}) {
  return <span className={`pp-badge pp-badge--${tone}`}>{children}</span>;
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pp-panel">
      {(title || right) && (
        <div className="pp-panel__header">
          <div style={{ display: "grid", gap: 5 }}>
            {title ? <div className="pp-panel__title">{title}</div> : null}
            {subtitle ? <div className="pp-panel__subtitle">{subtitle}</div> : null}
          </div>
          {right ? <div className="pp-inline">{right}</div> : null}
        </div>
      )}
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

function statusLabel(status: PersonalDashboardEngagementStatus) {
  if (status === "evolving") return "Evoluindo";
  if (status === "on_track") return "No ritmo";
  if (status === "attention") return "Atenção";
  if (status === "fading") return "Sumindo";
  return "Em risco";
}

function narrativeTone(tone: StudentNarrativeTone): "success" | "soft" | "warn" | "danger" {
  if (tone === "positive") return "success";
  if (tone === "neutral") return "soft";
  if (tone === "watch") return "warn";
  return "danger";
}

function MetabolismChip({ student }: { student: PersonalDashboardStudent }) {
  if (student.metabolismScore === null) {
    return <span className="pp-meta-chip">Metabolismo: sem snapshot</span>;
  }
  const arrow =
    student.metabolismTrend === "up" ? "↑" : student.metabolismTrend === "down" ? "↓" : "→";
  return (
    <span className="pp-meta-chip">
      Metabolismo <b>{student.metabolismScore}</b> {arrow}
    </span>
  );
}

function signalChipLabel(student: PersonalDashboardStudent): string | null {
  if (student.latestSleptWell === false) return "Sono ruim";
  if (student.workouts7d > 5) return "Alta carga";
  if (student.engagementStatus === "fading" || student.engagementStatus === "at_risk") return "Sumindo / risco";
  if (student.metabolismTrend === "down") return "Score em queda";
  return null;
}

function technicalNoteReminder(student: PersonalDashboardStudent): string | null {
  const iso = student.lastTechnicalNoteAt;
  if (iso == null || iso === "") {
    return "Sem nota técnica ainda";
  }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 14) return null;
  const weeks = Math.floor(days / 7);
  return weeks >= 2 ? `Sem nota técnica há ${weeks} sem.` : "Sem nota técnica há 2+ sem.";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [response, setResponse] = useState<PersonalDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [pulseFilter, setPulseFilter] = useState<"all" | "healthy" | "attention" | "risk">("all");
  const [quickMsgStudent, setQuickMsgStudent] = useState<PersonalDashboardStudent | null>(null);
  const activeTab = searchParams.get("tab") === "financeiro" ? "financeiro" : "carteira";

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPersonalDashboard();
      setResponse(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o dashboard.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useAdaptivePolling(
    () => {
      void (async () => {
        try {
          const data = await fetchPersonalDashboard();
          setResponse(data);
        } catch {
          /* keep last good snapshot */
        }
      })();
    },
    { activeIntervalMs: 30000, idleIntervalMs: 60000, hiddenIntervalMs: 120000 }
  );

  const students = response?.students ?? [];
  const summary = response?.summary;
  const alerts: PersonalDashboardAlert[] = summary?.intelligentAlerts ?? [];
  const atRiskStudents = useAtRiskStudents(response);
  const insights = summary?.insights ?? [];

  const headline = useMemo(() => {
    if (!summary) return "";
    return buildPortfolioHeadline(summary, students);
  }, [summary, students]);

  const attentionList: StudentNarrative[] = useMemo(() => {
    return buildAttentionList(students, 12);
  }, [students]);

  const filteredAttention = useMemo(() => {
    if (pulseFilter === "all") return attentionList;
    return attentionList.filter((item) => {
      const st = students.find((s) => s.id === item.studentId);
      if (!st) return false;
      if (pulseFilter === "healthy") return st.engagementStatus === "evolving" || st.engagementStatus === "on_track";
      if (pulseFilter === "attention") return st.engagementStatus === "attention";
      return st.engagementStatus === "fading" || st.engagementStatus === "at_risk";
    });
  }, [attentionList, pulseFilter, students]);

  const aggregates = useMemo(() => {
    if (!students.length) {
      return {
        evolving: 0,
        onTrack: 0,
        attention: 0,
        fading: 0,
        atRisk: 0,
        avg7d: 0,
        avg30d: 0,
        total7d: 0,
        total30d: 0,
      };
    }
    const total7d = students.reduce((acc, s) => acc + s.workouts7d, 0);
    const total30d = students.reduce((acc, s) => acc + s.workouts30d, 0);
    return {
      evolving: students.filter((s) => s.engagementStatus === "evolving").length,
      onTrack: students.filter((s) => s.engagementStatus === "on_track").length,
      attention: students.filter((s) => s.engagementStatus === "attention").length,
      fading: students.filter((s) => s.engagementStatus === "fading").length,
      atRisk: students.filter((s) => s.engagementStatus === "at_risk").length,
      avg7d: Math.round((total7d / students.length) * 10) / 10,
      avg30d: Math.round((total30d / students.length) * 10) / 10,
      total7d,
      total30d,
    };
  }, [students]);

  const dist = summary?.metabolismDistribution;

  const avgAdherence = useMemo(() => {
    if (!students.length) return 0;
    return Math.round(students.reduce((a, s) => a + s.adherencePct, 0) / students.length);
  }, [students]);

  const avgStreak = useMemo(() => {
    if (!students.length) return 0;
    return Math.round((students.reduce((a, s) => a + s.streakDays, 0) / students.length) * 10) / 10;
  }, [students]);

  const liveFresh = useMemo(() => {
    if (!response?.generatedAt) return false;
    return Date.now() - new Date(response.generatedAt).getTime() < 5 * 60 * 1000;
  }, [response?.generatedAt]);

  function openStudent(studentId: string, studentName?: string) {
    const fallback = students.find((s) => s.id === studentId)?.name || studentName || "Aluno";
    setSelectedStudent({ id: studentId, name: fallback });
  }

  return (
    <div className="pp-page">
      {/* Hero compacto: identidade + título + ações */}
      <div className="pp-hero" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 8, flex: "1 1 320px", minWidth: 0 }}>
          <div className="pp-kicker">Personal · Hoje</div>
          <h1 className="pp-title">
            {loading
              ? "Lendo a carteira…"
              : error
                ? "Não consegui carregar a carteira."
                : `${user?.name ? `${user.name.split(" ")[0]}, ` : ""}${headline}`}
          </h1>
          {response?.generatedAt ? (
            <div className="pp-meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {liveFresh ? <span className="pp-live-dot pp-live-dot--pulse" aria-hidden /> : <span className="pp-live-dot" aria-hidden />}
              <span>Atualizado {formatShortTime(response.generatedAt)}</span>
            </div>
          ) : null}
        </div>

        <div
          className="pp-actions"
          style={{
            alignSelf: "flex-start",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
            minWidth: 280,
          }}
        >
          <button type="button" className="btn btn-primary" onClick={() => navigate(routes.messages())}>
            Abrir mensagens
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(routes.students())}>
            Ver alunos
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(routes.students() + "?action=invite")}>
            Convidar por link
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate(routes.students() + "?action=register")}>
            Cadastrar aluno
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(routes.review())}
            style={{ gridColumn: "1 / -1" }}
          >
            Revisões
          </button>
        </div>
      </div>

      {/* Estado da carteira: distribuição + filtros + KPI strip — fora do hero, em camadas claras */}
      {students.length > 0 ? (
        <div className="pp-panel" style={{ marginTop: 12 }}>
          <div className="pp-panel__body" style={{ display: "grid", gap: 14, padding: 14 }}>
            {dist ? (
              <div className="pp-meta" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span><b>{dist.high}</b> com metabolismo alto</span>
                <span><b>{dist.moderate}</b> em ritmo moderado</span>
                <span><b>{dist.low}</b> baixo / precisa recuperar</span>
                {dist.unknown > 0 ? (
                  <span style={{ color: COLORS.mutedSoft }}>{dist.unknown} sem snapshot ainda</span>
                ) : null}
              </div>
            ) : null}

            <div className="pp-pulse-meta" role="toolbar" aria-label="Filtrar prioridades">
              <button
                type="button"
                className="pp-pulse-chip"
                aria-pressed={pulseFilter === "all"}
                onClick={() => setPulseFilter("all")}
              >
                Todos ({attentionList.length})
              </button>
              <button
                type="button"
                className="pp-pulse-chip"
                aria-pressed={pulseFilter === "healthy"}
                onClick={() => setPulseFilter("healthy")}
              >
                No ritmo ({aggregates.evolving + aggregates.onTrack})
              </button>
              <button
                type="button"
                className="pp-pulse-chip"
                aria-pressed={pulseFilter === "attention"}
                onClick={() => setPulseFilter("attention")}
              >
                Atenção ({aggregates.attention})
              </button>
              <button
                type="button"
                className="pp-pulse-chip"
                aria-pressed={pulseFilter === "risk"}
                onClick={() => setPulseFilter("risk")}
              >
                Risco ({aggregates.fading + aggregates.atRisk})
              </button>
            </div>

            <PersonalQuickSearch students={students} onSelect={(id, name) => openStudent(id, name)} />

            {summary ? (
              <div className="pp-metacore-strip">
                <span>Aderência média <b>{avgAdherence}%</b></span>
                <span>Streak médio <b>{avgStreak}d</b></span>
                <span>Alunos <b>{students.length}</b></span>
                {alerts[0] ? (
                  <span>Sinal: <b>{alerts[0].title}</b></span>
                ) : (
                  <span>Sem alertas automáticos agora</span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Tab strip: Carteira | Financeiro */}
      <div className="pp-dash-tabs">
        <button
          className={`pp-dash-tab${activeTab === "carteira" ? " active" : ""}`}
          onClick={() => setSearchParams({})}
        >
          Carteira
        </button>
        <button
          className={`pp-dash-tab${activeTab === "financeiro" ? " active" : ""}`}
          onClick={() => setSearchParams({ tab: "financeiro" })}
        >
          Financeiro
        </button>
      </div>

      {activeTab === "financeiro" ? (
        <FinancePanel />
      ) : (
        <>

      {loading ? (
        <Card title="Carregando dashboard" subtitle="Organizando prioridades e sinais da carteira.">
          <div style={{ color: COLORS.muted, fontSize: 14 }}>
            Em instantes a área mostra quem precisa de atenção primeiro.
          </div>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card title="Não foi possível carregar o dashboard" right={<Badge tone="danger">Falha</Badge>}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>{error}</div>
            <ActionButton onClick={() => void loadDashboard()}>Tentar novamente</ActionButton>
          </div>
        </Card>
      ) : null}

      {!loading && !error && students.length === 0 ? (
        <Card title="Sinais em formação">
          <EmptyState
            variant="ok"
            title="Carteira pronta para os primeiros sinais"
            description="Os indicadores de aderência, risco e evolução aparecem assim que os primeiros alunos forem atribuídos pela academia ou convidados diretamente e iniciarem check-ins. Esta tela vai priorizar quem está sumindo ou pedindo ajuste."
          />
        </Card>
      ) : null}

      {!loading && !error && students.length > 0 && insights.length > 0 ? (
        <InsightsStrip
          insights={insights}
          onStudentClick={(id) => openStudent(id)}
        />
      ) : null}

      {!loading && !error && atRiskStudents.length > 0 ? (
        <AtRiskCard
          students={atRiskStudents}
          onMessage={(s) => setQuickMsgStudent(s)}
          onFollowUp={(s) => {
            void createRelationshipAction(s.id, {
              actionType: "follow_up_marked",
              dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }}
          onOpenProfile={(s) => openStudent(s.id, s.name)}
        />
      ) : null}

      {!loading && !error && students.length > 0 ? (
        <>
          <Card
            title="Alunos e fichas"
            subtitle="Acesso rápido para abrir perfil, revisar fichas e ajustar treino."
            right={<Badge tone="soft">{students.length} alunos</Badge>}
          >
            <div style={{ display: "grid" }}>
              {students.slice(0, 6).map((student) => (
                <div key={student.id} className="pp-student-row">
                  <div className="pp-student-main">
                    <div className="pp-inline">
                      <button type="button" className="pp-name" onClick={() => openStudent(student.id, student.name)}>
                        {student.name}
                      </button>
                      <Badge tone={student.engagementStatus === "at_risk" || student.engagementStatus === "fading" ? "danger" : student.engagementStatus === "attention" ? "warn" : "success"}>
                        {statusLabel(student.engagementStatus)}
                      </Badge>
                    </div>
                    <div className="pp-meta">
                      Último treino <b>{fmtDate(student.lastWorkoutISO)}</b> · Aderência <b>{student.adherencePct}%</b> · Plano {PLAN_LABEL[student.plan]}
                    </div>
                  </div>
                  <div className="pp-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openStudent(student.id, student.name)}>
                      Ver aluno
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate(routes.studentWorkouts(student.id))}>
                      Ver ficha(s)
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(routes.workoutBuilder(student.id))}>
                      Criar treino
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Precisam de você agora"
            subtitle="Leitura rápida do que cada aluno está sinalizando."
            right={<Badge tone="soft">{filteredAttention.length} alunos</Badge>}
          >
            <div style={{ display: "grid" }}>
              {filteredAttention.length === 0 ? (
                <div style={{ color: COLORS.muted, fontSize: 14, padding: "8px 0" }}>
                  Nenhum aluno neste filtro — ajuste o chip acima ou abra a lista completa.
                </div>
              ) : null}
              {filteredAttention.map((item) => {
                const student = students.find((s) => s.id === item.studentId);
                if (!student) return null;
                return (
                  <div key={item.studentId} className="pp-student-row">
                    <div className="pp-student-main">
                      <div className="pp-inline">
                        <button
                          type="button"
                          onClick={() => openStudent(item.studentId, item.studentName)}
                          className="pp-name"
                        >
                          {item.studentName}
                        </button>
                        <Badge tone={narrativeTone(item.tone)}>{statusLabel(student.engagementStatus)}</Badge>
                      </div>
                      <div className="pp-narrative">{item.headline}</div>
                      <div className="pp-meta" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {(() => {
                          const sig = signalChipLabel(student);
                          return sig ? <span className="pp-badge pp-badge--warn">{sig}</span> : null;
                        })()}
                        <MetabolismChip student={student} />
                        {(() => {
                          const t = technicalNoteReminder(student);
                          return t ? <span className="pp-meta-chip">{t}</span> : null;
                        })()}
                        <span>
                          Último treino <b>{fmtDate(student.lastWorkoutISO)}</b>
                        </span>
                        <span>Plano: {PLAN_LABEL[student.plan]}</span>
                      </div>
                    </div>
                    <div className="pp-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => openStudent(item.studentId, item.studentName)}
                      >
                        Ver aluno
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => navigate(routes.workoutBuilder(item.studentId))}
                      >
                        Ajustar treino
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {alerts.length > 0 ? (
            <Card
              title="Alertas inteligentes"
              subtitle="Sinais automáticos de retenção, recuperação e risco."
              right={<Badge tone="neutral">{alerts.length} alerta(s)</Badge>}
            >
              <IntelligentAlerts
                alerts={alerts}
                onOpenStudent={(id) => openStudent(id)}
                onOpenStudents={() => navigate(routes.students())}
              />
            </Card>
          ) : null}

          <Card title="Resumo da carteira" subtitle="Números rápidos sem abrir planilha.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Badge tone="neutral">{aggregates.total7d} treinos / 7d</Badge>
              <Badge tone="neutral">{aggregates.avg7d}/aluno · semana</Badge>
              <Badge tone="soft">{students.length} alunos</Badge>
              <Badge tone="success">Evoluindo: {aggregates.evolving}</Badge>
              <Badge tone="warn">Atenção: {aggregates.attention}</Badge>
              <Badge tone="danger">Risco: {aggregates.fading + aggregates.atRisk}</Badge>
            </div>
          </Card>
        </>
      ) : null}

        </> /* close activeTab === "carteira" else */
      )}

      {selectedStudent ? (
        <StudentProfileModal
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      ) : null}

      {quickMsgStudent ? (
        <QuickMessageModal
          studentId={quickMsgStudent.id}
          studentName={quickMsgStudent.name}
          onClose={() => setQuickMsgStudent(null)}
        />
      ) : null}
    </div>
  );
}
