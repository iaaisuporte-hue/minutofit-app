import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPersonalConsulting,
  type PersonalConsultingNextAction,
  type PersonalConsultingStudent,
} from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";
import StudentProfileModal from "./StudentProfileModal";
import "./personalPremium.css";

type ConsultingStudent = PersonalConsultingStudent;

const PLAN_LABEL = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
} as const;

function formatDateBR(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function daysUntil(isoDate: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(`${isoDate}T00:00:00`);
  const diffMs = d.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const PILL_VARIANT_CLASS = {
  neutral: "pp-pill pp-pill--neutral",
  success: "pp-pill pp-pill--success",
  warn: "pp-pill pp-pill--warn",
  danger: "pp-pill pp-pill--danger",
  green: "pp-pill pp-pill--evolving",
  blue: "pp-pill pp-pill--info",
} as const;

function Pill({
  children,
  variant = "neutral",
  title,
}: {
  children: React.ReactNode;
  variant?: keyof typeof PILL_VARIANT_CLASS;
  title?: string;
}) {
  return (
    <span title={title} className={PILL_VARIANT_CLASS[variant]}>
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="pp-surface--card">{children}</div>;
}

function ActionLink({
  to,
  label,
  state,
  kind = "ghost",
}: {
  to: string;
  label: string;
  state?: unknown;
  kind?: "ghost" | "primary";
}) {
  return (
    <Link to={to} state={state} className={`pp-btn pp-btn--${kind}`}>
      {label}
    </Link>
  );
}

function getPlanVariant(plan: ConsultingStudent["plan"]) {
  if (plan === "black") return "green";
  if (plan === "gold") return "blue";
  return "neutral";
}

function getActionMeta(action: PersonalConsultingNextAction, planExpiresAt: string) {
  const daysLeft = daysUntil(planExpiresAt);

  if (action === "refresh_today") {
    return {
      variant: "danger" as const,
      headline: "Ficha vencida",
      chip: "Atualizar hoje",
      helper: "Próxima ação: ajustar a ficha agora e alinhar a meta da semana.",
    };
  }

  if (action === "prepare_update") {
    return {
      variant: "warn" as const,
      headline: daysLeft <= 1 ? "Ciclo na reta final" : `Vence em ${daysLeft} dia(s)`,
      chip: "Preparar ajuste",
      helper: "Próxima ação: preparar a atualização e organizar o próximo ciclo.",
    };
  }

  if (action === "review_adherence") {
    return {
      variant: "warn" as const,
      headline: "Aderência abaixo do esperado",
      chip: "Revisar rotina",
      helper: "Próxima ação: revisar a consistência e renegociar a rotina mínima.",
    };
  }

  return {
    variant: "success" as const,
    headline: "No ritmo",
    chip: "Manter progressão",
    helper: "Próxima ação: manter a progressão e planejar a próxima fase.",
  };
}

export default function ConsultingStudentsPage() {
  const [students, setStudents] = useState<ConsultingStudent[]>([]);
  const [summary, setSummary] = useState({ total: 0, urgent: 0, warning: 0, onTrack: 0 });
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchPersonalConsulting();
        if (!active) return;

        if (!data) {
          setStudents([]);
          setSummary({ total: 0, urgent: 0, warning: 0, onTrack: 0 });
          setError("Sua sessão não foi encontrada. Faça login novamente para ver a carteira.");
          return;
        }

        setStudents(data.students);
        setSummary(data.summary);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar a consultoria.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!onlyUrgent) return students;
    return students.filter((student) => student.status !== "on_track");
  }, [students, onlyUrgent]);

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <Card>
        <div
          style={{
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            background: COLORS.panelDeep,
            borderRadius: 20,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: 0.2 }}>Alunos consultoria</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45, maxWidth: 680 }}>
              Carteira operacional da consultoria com prioridade, aderência e vencimento de ciclo em um só lugar.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setOnlyUrgent((value) => !value)}
              className={`pp-btn ${onlyUrgent ? "pp-btn--warn" : "pp-btn--ghost"}`}
              title="Mostrar somente alunos com ação imediata"
            >
              {onlyUrgent ? "Mostrando atenção" : "Filtrar atenção"}
            </button>

            <Pill variant="neutral">Total {filtered.length}</Pill>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Card>
          <div style={{ padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>Carteira ativa</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.total}</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>alunos em acompanhamento</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>Urgente</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.urgent}</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>pedem ajuste imediato</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>Em atenção</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.warning}</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>pedem acompanhamento próximo</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>No ritmo</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.onTrack}</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>seguem bem no ciclo</div>
          </div>
        </Card>
      </div>

      {loading ? (
        <Card>
          <div style={{ padding: 18, color: COLORS.muted }}>Carregando carteira de consultoria...</div>
        </Card>
      ) : error ? (
        <Card>
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>Nao foi possivel carregar a consultoria.</div>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>{error}</div>
            <div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="pp-btn pp-btn--primary"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ padding: 18, display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>Nenhum aluno encontrado neste recorte.</div>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>
              {onlyUrgent ? "Sua carteira está estável neste momento." : "Ainda não há alunos disponíveis para consultoria."}
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((student) => {
            const actionMeta = getActionMeta(student.nextAction, student.planExpiresAt);
            const progressPct =
              student.workoutsPlannedInCurrentPlan > 0
                ? Math.round((student.workoutsDoneInCurrentPlan / student.workoutsPlannedInCurrentPlan) * 100)
                : 0;

            return (
              <div key={student.id} className="pp-student-card">
                <div
                  style={{
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 10, minWidth: 280, flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.2 }}>{student.name}</div>

                      <Pill variant={getPlanVariant(student.plan)}>{PLAN_LABEL[student.plan]}</Pill>

                      <Pill variant={actionMeta.variant} title={actionMeta.helper}>
                        {actionMeta.chip}
                      </Pill>

                      <Pill variant={progressPct >= 70 ? "success" : progressPct > 0 ? "warn" : "neutral"}>
                        {progressPct}% do ciclo
                      </Pill>
                    </div>

                    <div style={{ color: COLORS.muted2, fontSize: 13, lineHeight: 1.45 }}>
                      Última atualização da ficha: <b style={{ color: COLORS.text }}>{formatDateBR(student.lastWorkoutUpdateAt)}</b>{" "}
                      • Ciclo atual até: <b style={{ color: COLORS.text }}>{formatDateBR(student.planExpiresAt)}</b>
                    </div>

                    <div style={{ color: COLORS.muted2, fontSize: 13, lineHeight: 1.45 }}>
                      Progresso do ciclo: <b style={{ color: COLORS.text }}>{student.workoutsDoneInCurrentPlan}</b> /{" "}
                      {student.workoutsPlannedInCurrentPlan} treinos concluídos
                    </div>

                    <div
                      className={`pp-callout${
                        actionMeta.variant === "danger"
                          ? " pp-callout--danger"
                          : actionMeta.variant === "warn"
                            ? " pp-callout--warn"
                            : ""
                      }`}
                    >
                      <b style={{ color: COLORS.text }}>{actionMeta.headline}:</b> {actionMeta.helper.replace("Próxima ação: ", "")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <ActionLink
                      to={`../students/${student.id}/workouts/new`}
                      state={{ studentName: student.name }}
                      label="Atualizar ficha"
                      kind="primary"
                    />

                    <button
                      type="button"
                      onClick={() => setSelectedStudent({ id: student.id, name: student.name })}
                      className="pp-btn pp-btn--ghost"
                    >
                      Ver perfil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
