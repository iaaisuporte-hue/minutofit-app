import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchPersonalDashboard } from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";
import { useToast } from "../../components/Toast";

type Plan = "basic" | "silver" | "gold" | "black";

type Student = {
  id: string;
  name: string;
  plan: Plan;
  planExpiresAt?: string; // ISO (absent when API doesn't provide it)
  lastWorkoutUpdateAt?: string; // ISO
  workoutsDoneInCurrentPlan?: number;
  workoutsPlannedInCurrentPlan?: number;
};

const PLAN_LABEL: Record<Plan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

function formatDateBR(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function daysUntil(isoDate: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(isoDate + "T00:00:00");
  const diffMs = expiry.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getPlanStatus(isoDate?: string): { status: "active" | "expiring" | "expired"; label: string } {
  if (!isoDate) return { status: "active", label: "—" };
  const d = daysUntil(isoDate);
  if (d < 0) return { status: "expired", label: "VENCIDO" };
  if (d <= 5) return { status: "expiring", label: `Vence em ${d} dia(s)` };
  return { status: "active", label: `${d} dia(s) restantes` };
}

/** ====== IDENTIDADE VISUAL (TREINAí) ====== */
/** ✅ ROTAS ABSOLUTAS (ANTI-LOOP) */
const PERSONAL_BASE = "/app/personal" as const;
const routes = {
  library: () => `${PERSONAL_BASE}/library`,
  consulting: () => `${PERSONAL_BASE}/consulting`,
  // ✅ CRIAR/EDITAR FICHA -> BUILDER
  workoutBuilder: (studentId: string) => `${PERSONAL_BASE}/students/${studentId}/workouts/builder`,
} as const;

function pillStyle(opts: { bg: string; border: string; color?: string }): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
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

function statusPillStyle(status: "active" | "expiring" | "expired"): React.CSSProperties {
  const map: Record<typeof status, { bg: string; border: string }> = {
    active: { bg: COLORS.successBg, border: COLORS.successBorder },
    expiring: { bg: COLORS.warnBg, border: COLORS.warnBorder },
    expired: { bg: COLORS.dangerBg, border: COLORS.dangerBorder },
  };
  return pillStyle({ bg: map[status].bg, border: map[status].border });
}

function daysSince(isoDate: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(isoDate + "T00:00:00");
  const diffMs = today.getTime() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function daysLeftToExpireTraining(lastUpdateISO: string, cycleDays = 30) {
  return cycleDays - daysSince(lastUpdateISO);
}

function trainingWarningStyle(left: number): React.CSSProperties {
  if (left <= 0) return pillStyle({ bg: COLORS.dangerBg, border: COLORS.dangerBorder });
  if (left <= 5) return pillStyle({ bg: COLORS.warnBg, border: COLORS.warnBorder });
  return pillStyle({ bg: COLORS.successBg, border: COLORS.successBorder });
}

function canAccess(plan: Plan, feature: "netflix_basic" | "gym_beginner" | "gym_advanced" | "running") {
  if (feature === "netflix_basic") return true;
  if (feature === "gym_beginner") return plan === "silver" || plan === "gold" || plan === "black";
  if (feature === "gym_advanced") return plan === "gold" || plan === "black";
  if (feature === "running") return plan === "black";
  return false;
}

function DisabledButton({ label, reason }: { label: string; reason: string }) {
  return (
    <button
      disabled
      title={reason}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: "#FAFAFA",
        color: "#9CA3AF",
        cursor: "not-allowed",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function ActionLink({ to, label, variant = "ghost" }: { to: string; label: string; variant?: "ghost" | "primary" }) {
  const isPrimary = variant === "primary";
  return (
    <Link
      to={to} // ✅ sempre ABSOLUTO via routes.*
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: isPrimary ? `1px solid ${COLORS.orangeBorder}` : `1px solid ${COLORS.border}`,
        textDecoration: "none",
        color: COLORS.text,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        background: isPrimary ? COLORS.orangeSoft : "#FAFAFA",
        transition: "transform .08s ease, background .12s ease, border-color .12s ease",
        boxShadow: isPrimary ? "0 14px 28px rgba(34,197,94,.18)" : "none",
      }}
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
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);

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
          dash.students.map((s) => ({
            id: s.id,
            name: s.name,
            plan: s.plan as Plan,
            planExpiresAt: undefined,
            lastWorkoutUpdateAt: s.lastWorkoutISO ?? undefined,
            workoutsDoneInCurrentPlan: s.workouts30d,
            workoutsPlannedInCurrentPlan: undefined,
          }))
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
      active: 0,
      expiring: 0,
      expired: 0,
    };

    for (const student of filtered) {
      const { status } = getPlanStatus(student.planExpiresAt);
      base[status] += 1;
    }

    const total = filtered.length || 1;

    return {
      total: filtered.length,
      items: [
        {
          key: "active",
          label: "Ativos",
          value: base.active,
          bg: COLORS.successBg,
          border: COLORS.successBorder,
        },
        {
          key: "expiring",
          label: "A vencer",
          value: base.expiring,
          bg: COLORS.warnBg,
          border: COLORS.warnBorder,
        },
        {
          key: "expired",
          label: "Vencidos",
          value: base.expired,
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
        },
      ],
      segments: [
        {
          key: "active",
          width: `${(base.active / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(46,204,113,.95), rgba(34,197,94,.82))",
        },
        {
          key: "expiring",
          width: `${(base.expiring / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(255,196,0,.95), rgba(255,180,0,.82))",
        },
        {
          key: "expired",
          width: `${(base.expired / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(255,102,102,.95), rgba(255,77,77,.82))",
        },
      ],
    };
  }, [filtered]);

  if (loadingStudents) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: COLORS.muted }}>
        Carregando alunos…
      </div>
    );
  }

  if (studentsError) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: COLORS.muted }}>
        {studentsError}
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: 18,
          borderRadius: 20,
          border: `1px solid ${COLORS.borderStrong}`,
          background: COLORS.panelDeep,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Ver alunos</h2>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Total: <b style={{ color: COLORS.text }}>{filtered.length}</b> aluno(s)
          </div>
          <div style={{ color: COLORS.muted2, fontSize: 13, lineHeight: 1.45, maxWidth: 620 }}>
            Leia a carteira com rapidez, veja vencimentos e entre direto na ação certa para cada aluno.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar aluno..."
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              color: COLORS.text,
              outline: "none",
              minWidth: 220,
            }}
          />

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>Filtrar por plano</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "#FAFAFA",
                color: COLORS.text,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">Todos</option>
              <option value="basic">Básico</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="black">Black</option>
            </select>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          borderRadius: 18,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Status dos planos</div>
          <div style={{ color: COLORS.muted2, fontSize: 13, lineHeight: 1.45 }}>
            Visão rápida da carteira filtrada. Exemplo: <b style={{ color: COLORS.text }}>{statusSummary.items[2].value} vencidos</b>.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            height: 16,
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
                padding: 14,
                borderRadius: 16,
                border: `1px solid ${item.border}`,
                background: item.bg,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{item.value}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>
                {statusSummary.total ? Math.round((item.value / statusSummary.total) * 100) : 0}% da carteira atual
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((s) => {
          const { status, label } = getPlanStatus(s.planExpiresAt);
          const isExpired = status === "expired";

          const canNetflix = !isExpired && canAccess(s.plan, "netflix_basic");
          const canGymBeginner = !isExpired && canAccess(s.plan, "gym_beginner");
          const canGymAdvanced = !isExpired && canAccess(s.plan, "gym_advanced");
          const canRunning = !isExpired && canAccess(s.plan, "running");

          const isConsulting = s.plan === "black";
          const hasTrainingData = !!s.lastWorkoutUpdateAt;
          const trainingLeft =
            isConsulting && s.lastWorkoutUpdateAt ? daysLeftToExpireTraining(s.lastWorkoutUpdateAt, 30) : null;

          const trainingText =
            trainingLeft == null
              ? null
              : trainingLeft <= 0
              ? "Treino vencido — atualizar hoje"
              : `Faltam ${trainingLeft} dia(s) para o treino vencer`;

          return (
            <div
              key={s.id}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 14,
                background: COLORS.card,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = COLORS.cardHover;
                (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.borderStrong;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = COLORS.card;
                (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.border;
              }}
            >
              <div style={{ display: "grid", gap: 8, minWidth: 360 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>{s.name}</div>

                  <span style={planPillStyle(s.plan)}>Plano: {PLAN_LABEL[s.plan]}</span>
                  <span style={statusPillStyle(status)}>{label}</span>

                  {isConsulting && (
                    <span style={pillStyle({ bg: COLORS.blueBg, border: COLORS.blueBorder })}>Consultoria</span>
                  )}

                  {isConsulting && trainingLeft != null && (
                    <span style={trainingWarningStyle(trainingLeft)}>{trainingText}</span>
                  )}
                </div>

                <div style={{ color: COLORS.muted2, fontSize: 13 }}>
                  Vencimento do plano: <b style={{ color: COLORS.text }}>{s.planExpiresAt ? formatDateBR(s.planExpiresAt) : "—"}</b>
                </div>

                {isConsulting && hasTrainingData && (
                  <div style={{ color: COLORS.muted2, fontSize: 13 }}>
                    Última atualização da ficha:{" "}
                    <b style={{ color: COLORS.text }}>{formatDateBR(s.lastWorkoutUpdateAt!)}</b> • Progresso:{" "}
                    <b style={{ color: COLORS.text }}>{s.workoutsDoneInCurrentPlan}</b> / {s.workoutsPlannedInCurrentPlan} treinos
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {canNetflix ? (
                  <ActionLink to={routes.library()} label="Treinos gerais" variant="ghost" />
                ) : (
                  <DisabledButton label="Treinos gerais" reason="Plano vencido." />
                )}

                {/* ✅ AGORA SEMPRE VAI PARA O WORKOUT BUILDER */}
                {canGymBeginner ? (
                  <ActionLink to={routes.workoutBuilder(s.id)} label="Criar ficha (iniciante)" variant="primary" />
                ) : (
                  <DisabledButton
                    label="Criar ficha (iniciante)"
                    reason={isExpired ? "Plano vencido." : "Disponível apenas no Silver ou superior."}
                  />
                )}

                {/* ✅ Também manda para builder (em vez de placeholder) */}
                {canGymAdvanced ? (
                  <ActionLink to={routes.workoutBuilder(s.id)} label="Ficha avançada" variant="ghost" />
                ) : (
                  <DisabledButton
                    label="Ficha avançada"
                    reason={isExpired ? "Plano vencido." : "Disponível apenas no Gold ou Black."}
                  />
                )}

                {/* Mantém placeholder para corrida (ainda não tem tela) */}
                {canRunning ? (
                  <button
                    onClick={() => toast.info("Planos de corrida estarão disponíveis em breve.")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FAFAFA",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Plano de corrida
                  </button>
                ) : (
                  <DisabledButton
                    label="Plano de corrida"
                    reason={isExpired ? "Plano vencido." : "Disponível apenas no plano Black."}
                  />
                )}

                {isConsulting ? <ActionLink to={routes.consulting()} label="Ver consultoria" /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
