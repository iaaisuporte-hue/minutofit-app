import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchPersonalDashboard,
  type PersonalDashboardAlert,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardResponse,
  type PersonalDashboardStudent,
  type RecognitionMilestone,
} from "../../services/personalDashboardApi";
import { createRelationshipAction } from "../../services/personalRetentionApi";
import { COLORS } from "../../styles/colors";
import { useAdaptivePolling } from "../../hooks/useAdaptivePolling";
import { useAuth } from "../../auth/AuthContext";
import IntelligentAlerts from "./IntelligentAlerts";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonStudentList } from "../../components/feedback/Skeleton";
import StudentProfileModal from "./StudentProfileModal";
import PersonalQuickSearch from "./PersonalQuickSearch";
import {
  buildAttentionList,
  buildStudentNarrative,
  buildPortfolioHeadline,
  type StudentNarrative,
  type StudentNarrativeTone,
} from "./lib/studentNarrative";
import { Bell } from "lucide-react";
import { InsightsStrip } from "../../features/personalRetention/InsightsStrip";
import { RecognitionCard } from "../../features/personalRetention/RecognitionCard";
import { IncomingRequestsPanel, NetworkVisibilityBanner } from "../../features/team";
import { FinancePanel } from "../../features/personalRetention/FinancePanel";
import { STUDENT_BILLING_ENABLED } from "../../config/features";
import { PersonalWelcomeCard } from "./PersonalWelcomeCard";
import { QuickMessageModal } from "../../features/personalRetention/QuickMessageModal";
import { SessionQuickLog } from "../../features/personalRetention/SessionQuickLog";
import "./personalPremium.css";

const PERSONAL_BASE = "/app/personal" as const;

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

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function checkinAbsenceBadge(student: PersonalDashboardStudent): string | null {
  const days = daysSince(student.lastCheckinISO);
  if (days < 3) return null;
  if (days >= 999) return "Sem check-in ainda";
  return `Sem check-in há ${days}d`;
}


function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const DEMO_STUDENT: PersonalDashboardStudent = {
  id: "demo-student-1",
  name: "João Silva",
  plan: "silver",
  workouts7d: 0,
  workouts30d: 5,
  streakDays: 0,
  lastWorkoutISO: daysAgoISO(9),
  adherencePct: 32,
  adherenceScore: 32,
  engagementScore: 28,
  riskScore: 78,
  riskFactors: ["engajamento baixo (28/100)", "sono ruim no último check-in", "sem contato há 11 dias"],
  risk: "critico",
  goal: "emagrecimento",
  notes: null,
  engagementStatus: "at_risk",
  lastCheckinISO: daysAgoISO(6),
  checkins7d: 0,
  metabolismScore: 54,
  metabolismBand: "moderate",
  metabolismTrend: "down",
  metabolismDelta7d: -14,
  latestSleptWell: false,
  lastTechnicalNoteAt: null,
  assignedAtISO: daysAgoISO(45),
};

const DEMO_ALERT: PersonalDashboardAlert = {
  type: "silent_disappear",
  title: "João sumiu silenciosamente",
  description: "Sem treino há 9 dias. Histórico recente era regular — merece um contato hoje.",
  studentId: "demo-student-1",
  studentName: "João Silva",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [response, setResponse] = useState<PersonalDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [pulseFilter, setPulseFilter] = useState<"all" | "healthy" | "attention" | "risk" | "no_checkin">("all");
  const [quickMsgStudent, setQuickMsgStudent] = useState<PersonalDashboardStudent | null>(null);
  const [quickMsgPrefillCheckin, setQuickMsgPrefillCheckin] = useState(false);
  const [recognizingMilestone, setRecognizingMilestone] = useState<RecognitionMilestone | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoCTAOpen, setDemoCTAOpen] = useState(false);
  // Cobrança de aluno congelada na V1 (STUDENT_BILLING_ENABLED): a aba/painel
  // financeiro fica inacessível mesmo via ?tab=financeiro na URL.
  const activeTab =
    STUDENT_BILLING_ENABLED && searchParams.get("tab") === "financeiro" ? "financeiro" : "carteira";

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

  const realStudents = response?.students ?? [];
  const students = isDemoMode && realStudents.length === 0 ? [DEMO_STUDENT] : realStudents;
  const summary = response?.summary;
  const alerts: PersonalDashboardAlert[] = isDemoMode && realStudents.length === 0
    ? [DEMO_ALERT]
    : (summary?.intelligentAlerts ?? []);
  const insights = summary?.insights ?? [];
  const recognitionMilestones: RecognitionMilestone[] = summary?.needsRecognitionTop ?? [];

  const headline = useMemo(() => {
    if (isDemoMode && realStudents.length === 0) return "veja o produto em ação";
    if (!summary) return "";
    return buildPortfolioHeadline(summary, students);
  }, [summary, students, isDemoMode, realStudents.length]);

  const attentionList: StudentNarrative[] = useMemo(() => {
    return buildAttentionList(students, 12);
  }, [students]);

  // "Sem check-in" opera sobre a carteira INTEIRA (não só os 12 da lista de atenção):
  // um aluno saudável que apenas faltou check-in há 3–4d não entraria no top-12 por tom,
  // mas é exatamente o sinal precoce que o personal precisa ver para fechar o passo 2.
  const noCheckinStudents = useMemo(
    () => students.filter((s) => checkinAbsenceBadge(s) !== null),
    [students]
  );

  const filteredAttention = useMemo(() => {
    if (pulseFilter === "no_checkin") {
      return [...noCheckinStudents]
        .sort((a, b) => daysSince(b.lastCheckinISO) - daysSince(a.lastCheckinISO))
        .map(buildStudentNarrative);
    }
    if (pulseFilter === "all") return attentionList;
    return attentionList.filter((item) => {
      const st = students.find((s) => s.id === item.studentId);
      if (!st) return false;
      if (pulseFilter === "healthy") return st.engagementStatus === "evolving" || st.engagementStatus === "on_track";
      if (pulseFilter === "attention") return st.engagementStatus === "attention";
      return st.engagementStatus === "fading" || st.engagementStatus === "at_risk";
    });
  }, [attentionList, pulseFilter, students, noCheckinStudents]);

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
      {/* Hero compacto: identidade + título */}
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
      </div>

      {/* Retorno do checkout Mercado Pago — confirma recebimento (ativação é assíncrona via webhook) */}
      {searchParams.get("upgrade") === "ok" ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--color-info-soft)",
            border: "1px solid var(--color-info-border)",
            fontSize: 13,
            color: "var(--color-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>
            <b>Pagamento recebido.</b> Seu plano Pro é ativado assim que o Mercado Pago confirmar — em instantes.
          </span>
          <button
            type="button"
            className="pp-btn pp-btn--ghost pp-btn--sm"
            onClick={() => setSearchParams({})}
          >
            Ok
          </button>
        </div>
      ) : null}

      {/* Solicitações de vínculo de alunos (iniciadas pelo aluno) */}
      <div style={{ marginTop: 12 }}>
        <IncomingRequestsPanel role="personal" />
      </div>

      {isDemoMode && realStudents.length === 0 ? (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--color-warn-soft)",
            border: "1px solid var(--color-warn-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 13,
            color: "var(--color-text-muted)",
            marginBottom: 4,
          }}
        >
          <span>
            <b style={{ color: "var(--color-text)" }}>Dados de exemplo.</b>{" "}
            Convide um aluno real para ver seus sinais aqui.
          </span>
          <button
            type="button"
            className="pp-btn pp-btn--ghost pp-btn--sm"
            onClick={() => setIsDemoMode(false)}
          >
            Fechar exemplo
          </button>
        </div>
      ) : null}

      {!loading && !error && <NetworkVisibilityBanner role="personal" />}

      {!loading && !error && (
        <PersonalWelcomeCard
          firstName={user?.name?.split(" ")[0] ?? "personal"}
          hasStudents={realStudents.length > 0}
          hasPlan={Boolean(summary?.activationHasPlan)}
          hasCheckin={Boolean(summary?.activationHasCheckin)}
          onShowDemo={realStudents.length === 0 ? () => setIsDemoMode(true) : undefined}
        />
      )}

      {/* Prova de valor — adaptação da carteira (acompanhamento + automação) */}
      {!loading && !error && realStudents.length > 0 && (
        <div
          className="pp-panel"
          style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}
        >
          <span aria-hidden="true" style={{ fontSize: 20 }}>{(summary?.adaptationsThisWeek ?? 0) > 0 ? "⚡" : "🌱"}</span>
          <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.45 }}>
            {(summary?.adaptationsThisWeek ?? 0) > 0 ? (
              <>Suas fichas se ajustaram <strong>{summary?.adaptationsThisWeek}×</strong> essa semana ao estado dos seus alunos.</>
            ) : (
              <>As fichas se ajustam sozinhas quando seus alunos fazem check-in — ative a adaptação no cockpit do aluno.</>
            )}
          </div>
        </div>
      )}

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
              {noCheckinStudents.length > 0 ? (
                <button
                  type="button"
                  className="pp-pulse-chip"
                  aria-pressed={pulseFilter === "no_checkin"}
                  onClick={() => setPulseFilter("no_checkin")}
                >
                  Sem check-in ({noCheckinStudents.length})
                </button>
              ) : null}
            </div>

            <PersonalQuickSearch students={students} onSelect={(id, name) => openStudent(id, name)} />

            {summary ? (
              <div className="pp-corefit-strip">
                <span>Frequência média (30d) <b>{avgAdherence}%</b></span>
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

      {activeTab === "financeiro" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button
              type="button"
              className="pp-btn pp-btn--ghost pp-btn--sm"
              onClick={() => setSearchParams({})}
              style={{ paddingLeft: 0 }}
            >
              ← Voltar para a carteira
            </button>
          </div>
          <FinancePanel />
        </>
      ) : (
        <>

      {loading ? (
        <Card title="Lendo sinais da carteira" subtitle="Organizando prioridades e contextos do dia.">
          <SkeletonStudentList rows={4} label="Carregando alunos em atenção" />
        </Card>
      ) : null}

      {!loading && error ? (
        <Card title="Não foi possível carregar o dashboard" right={<Badge tone="danger">Falha</Badge>}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>{error}</div>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="pp-btn pp-btn--ghost"
            >
              Tentar novamente
            </button>
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

      {!loading && !error && recognitionMilestones.length > 0 ? (
        <RecognitionCard
          milestones={recognitionMilestones}
          onCongratulate={(milestone) => setRecognizingMilestone(milestone)}
          onOpenProfile={(id, name) => openStudent(id, name)}
        />
      ) : null}

      {!loading && !error && students.length > 0 ? (
        <>
          {/*
            Painel "Hoje" — substitui 5 cards anteriores (AtRiskCard,
            "Alunos e fichas" top 6, "Precisam de você agora",
            "Alertas inteligentes" como card separado) por 1 caminho claro
            priorizado por risco. Ver plans/plano_review_personal_2026-05-19_1.md
            (Top 10 #1) e PR-C do plano UI/UX 6→8.
          */}
          {alerts.length > 0 ? (
            <Card title="Sinais do dia">
              <IntelligentAlerts
                alerts={alerts}
                onOpenStudent={(id) => openStudent(id)}
                onOpenStudents={() => navigate(routes.students())}
                onOpenRoute={(href) => navigate(href)}
              />
            </Card>
          ) : null}

          <Card
            title="Alunos em atenção"
            subtitle={
              filteredAttention.length === 0
                ? "Carteira estável — nenhum aluno pedindo atenção neste filtro."
                : `${filteredAttention.length} ${filteredAttention.length === 1 ? "aluno" : "alunos"} ${filteredAttention.length === 1 ? "pede" : "pedem"} atenção.`
            }
            right={
              <button
                type="button"
                className="pp-btn pp-btn--ghost pp-btn--sm"
                onClick={() => navigate(routes.students())}
              >
                Ver todos os {students.length}
              </button>
            }
          >
            <div style={{ display: "grid" }}>
              {filteredAttention.length === 0 ? (
                <div style={{ padding: "8px 0" }}>
                  <EmptyState
                    eyebrow="Sem sinais agora"
                    variant="ok"
                    title="Ninguém em risco neste momento"
                    description="Os alunos aparecem aqui quando há queda de aderência, sono ruim, score em queda ou ausência prolongada."
                  />
                </div>
              ) : null}

              {filteredAttention.map((item) => {
                const student = students.find((s) => s.id === item.studentId);
                if (!student) return null;
                const isDemo = item.studentId === "demo-student-1";
                const isRisk = item.tone === "risk";
                const primaryAction = isRisk
                  ? {
                      label: "Mensagem rápida",
                      onClick: () => {
                        if (isDemo) { setDemoCTAOpen(true); return; }
                        setQuickMsgPrefillCheckin(false);
                        setQuickMsgStudent(student);
                      },
                    }
                  : {
                      label: "Ajustar treino",
                      onClick: () => isDemo ? setDemoCTAOpen(true) : navigate(routes.workoutBuilder(item.studentId)),
                    };
                const signalChip = signalChipLabel(student);
                const checkinChip = checkinAbsenceBadge(student);
                return (
                  <div key={item.studentId} className="pp-student-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
                    {/* Header: nome + badge de status + "Ver aluno" */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
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
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost pp-btn--sm"
                        onClick={() => isDemo ? setDemoCTAOpen(true) : openStudent(item.studentId, item.studentName)}
                      >
                        Ver aluno
                      </button>
                    </div>

                    {/* Narrativa */}
                    <div className="pp-narrative" style={{ marginTop: 5 }}>{item.headline}</div>

                    {/* Chips de sinais: até 3 + data do último treino */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 7 }}>
                      {signalChip ? <span className="pp-badge pp-badge--warn">{signalChip}</span> : null}
                      {checkinChip ? <span className="pp-badge pp-badge--danger">{checkinChip}</span> : null}
                      <MetabolismChip student={student} />
                      <span className="pp-meta">Último treino <b>{fmtDate(student.lastWorkoutISO)}</b></span>
                    </div>

                    {/* Footer: registrar sessão (esq) + ação principal (dir) */}
                    <div style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 10,
                      paddingTop: 9,
                      borderTop: "1px solid var(--color-border)",
                    }}>
                      {!isDemo
                        ? <SessionQuickLog studentId={item.studentId} studentName={item.studentName} />
                        : <div />}
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {!isDemo && checkinChip ? (
                          <button
                            type="button"
                            className="pp-btn pp-btn--ghost pp-btn--sm"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                            title="Enviar lembrete de check-in"
                            onClick={() => {
                              setQuickMsgPrefillCheckin(true);
                              setQuickMsgStudent(student);
                            }}
                          >
                            <Bell size={13} />
                            Lembrar check-in
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="pp-btn pp-btn--primary pp-btn--sm"
                          onClick={primaryAction.onClick}
                        >
                          {primaryAction.label}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Resumo da carteira — 3 chips essenciais (era 6). */}
          <Card title="Carteira" subtitle="Composição do dia.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Badge tone="success">Evoluindo: {aggregates.evolving}</Badge>
              <Badge tone="warn">Atenção: {aggregates.attention}</Badge>
              <Badge tone="danger">Risco: {aggregates.fading + aggregates.atRisk}</Badge>
            </div>
          </Card>
        </>
      ) : null}

      {/* Financeiro: acesso discreto, fora do fluxo principal.
          Oculto na V1 — cobrança de aluno congelada (STUDENT_BILLING_ENABLED). */}
      {STUDENT_BILLING_ENABLED && students.length > 0 ? (
        <div style={{ textAlign: "right", marginTop: 4 }}>
          <button
            type="button"
            className="pp-btn pp-btn--ghost pp-btn--sm"
            onClick={() => setSearchParams({ tab: "financeiro" })}
            style={{ opacity: 0.5, fontSize: 12 }}
          >
            Ver financeiro →
          </button>
        </div>
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
          engagementStatus={quickMsgStudent.engagementStatus}
          prefillCheckinNudge={quickMsgPrefillCheckin}
          onClose={() => { setQuickMsgStudent(null); setQuickMsgPrefillCheckin(false); }}
        />
      ) : null}

      {demoCTAOpen ? (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDemoCTAOpen(false)}
        >
          <div
            style={{
              background: "var(--color-surface)", borderRadius: 16,
              padding: "28px 24px", maxWidth: 360, width: "100%",
              boxShadow: "var(--shadow-xl)", display: "grid", gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>
              Pronto para começar?
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              No modo de exemplo você vê como o produto funciona. Convide um aluno real para
              enviar mensagens, ver o cockpit e acompanhar a evolução.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="pp-btn pp-btn--primary"
                onClick={() => { setDemoCTAOpen(false); navigate("/app/personal/students?action=invite"); }}
              >
                Convidar primeiro aluno
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                onClick={() => setDemoCTAOpen(false)}
              >
                Continuar explorando
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {recognizingMilestone ? (
        <QuickMessageModal
          studentId={recognizingMilestone.studentId}
          studentName={recognizingMilestone.studentName}
          engagementStatus="evolving"
          onClose={() => setRecognizingMilestone(null)}
          onSent={() => {
            const milestoneKey = recognizingMilestone.milestoneKey;
            const studentId = recognizingMilestone.studentId;
            createRelationshipAction(studentId, {
              actionType: "recognition_sent",
              payloadJson: { milestone_key: milestoneKey },
            }).catch(() => undefined);
            setRecognizingMilestone(null);
          }}
        />
      ) : null}
    </div>
  );
}
