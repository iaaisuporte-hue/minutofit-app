import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchPersonalDashboard,
  type PersonalDashboardAlert,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardResponse,
  type PersonalDashboardStudent,
} from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";
import { useIsMobile } from "../../hooks/useIsMobile";
import IntelligentAlerts from "./IntelligentAlerts";
import { EmptyState } from "../../components/EmptyState";
import StudentProfileModal from "./StudentProfileModal";
import {
  buildAttentionList,
  buildPortfolioHeadline,
  type StudentNarrative,
  type StudentNarrativeTone,
} from "./lib/studentNarrative";
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
} as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(720);
  const [response, setResponse] = useState<PersonalDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPersonalDashboard();
        if (!active) return;
        setResponse(data);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar o dashboard.");
        setResponse(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const students = response?.students ?? [];
  const summary = response?.summary;
  const alerts: PersonalDashboardAlert[] = summary?.intelligentAlerts ?? [];

  const headline = useMemo(() => {
    if (!summary) return "";
    return buildPortfolioHeadline(summary, students);
  }, [summary, students]);

  const attentionList: StudentNarrative[] = useMemo(() => {
    return buildAttentionList(students, 5);
  }, [students]);

  const aggregates = useMemo(() => {
    if (!students.length) {
      return {
        evolving: 0,
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

  function openStudent(studentId: string, studentName?: string) {
    const fallback = students.find((s) => s.id === studentId)?.name || studentName || "Aluno";
    setSelectedStudent({ id: studentId, name: fallback });
  }

  return (
    <div className="pp-page">
      <div className="pp-hero">
        <div style={{ display: "grid", gap: 8 }}>
          <div className="pp-kicker">Pulse metabólico — hoje</div>
          <h1 className="pp-title">
            {loading ? "Lendo a carteira…" : error ? "Não consegui carregar a carteira." : headline}
          </h1>
          {dist && students.length > 0 ? (
            <div className="pp-meta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>
                <b>{dist.high}</b> com metabolismo alto
              </span>
              <span>
                <b>{dist.moderate}</b> em ritmo moderado
              </span>
              <span>
                <b>{dist.low}</b> baixo / precisa recuperar
              </span>
              {dist.unknown > 0 ? (
                <span style={{ color: COLORS.mutedSoft }}>
                  {dist.unknown} sem snapshot ainda
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="pp-actions">
          <ActionButton primary onClick={() => navigate(routes.messages())}>
            Abrir mensagens
          </ActionButton>
          <ActionButton onClick={() => navigate(routes.students())}>Ver alunos</ActionButton>
          <button
            type="button"
            className="pp-btn pp-btn--quiet"
            onClick={() => navigate(routes.review())}
          >
            Revisar treinos
          </button>
        </div>
      </div>

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
            <ActionButton onClick={() => window.location.reload()}>Tentar novamente</ActionButton>
          </div>
        </Card>
      ) : null}

      {!loading && !error && students.length === 0 ? (
        <Card title="Sinais em formação">
          <EmptyState
            variant="ok"
            title="Carteira pronta para os primeiros sinais"
            description="Os indicadores de aderência, risco e evolução aparecem assim que os primeiros alunos forem atribuídos e iniciarem check-ins. Esta tela vai priorizar quem está sumindo ou pedindo ajuste."
          />
        </Card>
      ) : null}

      {!loading && !error && students.length > 0 ? (
        <>
          <Card
            title="Precisam de você agora"
            subtitle="Leitura rápida do que cada aluno está sinalizando."
            right={<Badge tone="soft">{attentionList.length} alunos</Badge>}
          >
            <div style={{ display: "grid" }}>
              {attentionList.map((item) => {
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
                        <MetabolismChip student={student} />
                        <span>
                          Último treino <b>{fmtDate(student.lastWorkoutISO)}</b>
                        </span>
                        <span>Plano: {PLAN_LABEL[student.plan]}</span>
                      </div>
                    </div>
                    <div className="pp-actions">
                      <button
                        type="button"
                        className="pp-btn pp-btn--quiet"
                        onClick={() => openStudent(item.studentId, item.studentName)}
                      >
                        Ver aluno
                      </button>
                      <button
                        type="button"
                        className="pp-btn pp-btn--primary"
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

          <details
            open={!isMobile && students.length <= 10}
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
              Visão da carteira (números crus)
            </summary>
            <div
              style={{
                padding: 14,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <Card title="Atividade (7 dias)" right={<Badge tone="neutral">{aggregates.total7d} treinos</Badge>}>
                <div className="pp-metric__value">{aggregates.avg7d}/sem</div>
              </Card>
              <Card title="Consistência (30 dias)" right={<Badge tone="neutral">{aggregates.total30d} treinos</Badge>}>
                <div className="pp-metric__value">{aggregates.avg30d}/mês</div>
              </Card>
              <Card title="Status da carteira" right={<Badge tone="soft">{students.length} alunos</Badge>}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="success">Evoluindo: {aggregates.evolving}</Badge>
                  <Badge tone="warn">Atenção: {aggregates.attention}</Badge>
                  <Badge tone="danger">Sumindo + risco: {aggregates.fading + aggregates.atRisk}</Badge>
                </div>
              </Card>
            </div>
          </details>
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
