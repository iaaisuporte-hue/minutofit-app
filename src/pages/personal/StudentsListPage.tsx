import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

type Plan = "basic" | "silver" | "gold" | "black";

type Student = {
  id: string;
  name: string;
  plan: Plan;
  planExpiresAt: string; // ISO
  // Consultoria (apenas black)
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

function getPlanStatus(isoDate: string): { status: "active" | "expiring" | "expired"; label: string } {
  const d = daysUntil(isoDate);
  if (d < 0) return { status: "expired", label: "VENCIDO" };
  if (d <= 5) return { status: "expiring", label: `Vence em ${d} dia(s)` };
  return { status: "active", label: `${d} dia(s) restantes` };
}

/** ====== IDENTIDADE VISUAL (TREINAí) ====== */
const COLORS = {
  bg: "#0F0F0F",
  panel: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
  card: "rgba(255,255,255,.03)",
  cardHover: "rgba(255,255,255,.045)",
  border: "rgba(255,255,255,.10)",
  borderStrong: "rgba(255,255,255,.14)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.65)",
  muted2: "rgba(255,255,255,.55)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.18)",
  orangeBorder: "rgba(255,106,0,.35)",
  successBg: "rgba(46, 204, 113, .14)",
  successBorder: "rgba(46, 204, 113, .35)",
  warnBg: "rgba(255, 180, 0, .14)",
  warnBorder: "rgba(255, 180, 0, .35)",
  dangerBg: "rgba(255, 77, 77, .14)",
  dangerBorder: "rgba(255, 77, 77, .35)",
  blueBg: "rgba(120, 160, 255, .14)",
  blueBorder: "rgba(120, 160, 255, .35)",
};

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
    fontWeight: 900,
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
    basic: { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.14)" },
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
        background: "rgba(255,255,255,.03)",
        color: "rgba(255,255,255,.40)",
        cursor: "not-allowed",
        fontWeight: 900,
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
        fontWeight: 900,
        background: isPrimary ? COLORS.orangeSoft : "rgba(255,255,255,.03)",
        transition: "transform .08s ease, background .12s ease, border-color .12s ease",
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
  const students: Student[] = useMemo(
    () => [
      // basic
      { id: "1", name: "João Silva", plan: "basic", planExpiresAt: "2026-03-20" },
      { id: "2", name: "Maria Souza", plan: "basic", planExpiresAt: "2026-02-10" },
      { id: "3", name: "Pedro Lima", plan: "basic", planExpiresAt: "2026-03-05" },
      { id: "4", name: "Ana Costa", plan: "basic", planExpiresAt: "2026-02-26" },
      { id: "5", name: "Lucas Rocha", plan: "basic", planExpiresAt: "2026-04-01" },

      // silver
      { id: "6", name: "Bruno Santos", plan: "silver", planExpiresAt: "2026-03-22" },
      { id: "7", name: "Carla Nunes", plan: "silver", planExpiresAt: "2026-03-01" },
      { id: "8", name: "Diego Alves", plan: "silver", planExpiresAt: "2026-02-24" },
      { id: "9", name: "Fernanda Melo", plan: "silver", planExpiresAt: "2026-04-10" },
      { id: "10", name: "Rafaela Dias", plan: "silver", planExpiresAt: "2026-02-18" },

      // gold
      { id: "11", name: "Gustavo Araújo", plan: "gold", planExpiresAt: "2026-03-30" },
      { id: "12", name: "Helena Ribeiro", plan: "gold", planExpiresAt: "2026-03-12" },
      { id: "13", name: "Igor Fernandes", plan: "gold", planExpiresAt: "2026-02-28" },
      { id: "14", name: "Juliana Martins", plan: "gold", planExpiresAt: "2026-04-05" },
      { id: "15", name: "Marcos Oliveira", plan: "gold", planExpiresAt: "2026-03-02" },

      // black + consultoria
      {
        id: "16",
        name: "Natália Freitas",
        plan: "black",
        planExpiresAt: "2026-03-25",
        lastWorkoutUpdateAt: "2026-02-10",
        workoutsDoneInCurrentPlan: 8,
        workoutsPlannedInCurrentPlan: 16,
      },
      {
        id: "17",
        name: "Otávio Barbosa",
        plan: "black",
        planExpiresAt: "2026-03-03",
        lastWorkoutUpdateAt: "2026-02-20",
        workoutsDoneInCurrentPlan: 5,
        workoutsPlannedInCurrentPlan: 12,
      },
      {
        id: "18",
        name: "Patrícia Lima",
        plan: "black",
        planExpiresAt: "2026-02-23",
        lastWorkoutUpdateAt: "2026-01-20",
        workoutsDoneInCurrentPlan: 10,
        workoutsPlannedInCurrentPlan: 10,
      },
      {
        id: "19",
        name: "Renato Sousa",
        plan: "black",
        planExpiresAt: "2026-04-15",
        lastWorkoutUpdateAt: "2026-02-01",
        workoutsDoneInCurrentPlan: 14,
        workoutsPlannedInCurrentPlan: 20,
      },
      {
        id: "20",
        name: "Sabrina Cardoso",
        plan: "black",
        planExpiresAt: "2026-03-08",
        lastWorkoutUpdateAt: "2026-02-24",
        workoutsDoneInCurrentPlan: 1,
        workoutsPlannedInCurrentPlan: 10,
      },
    ],
    []
  );

  const [filter, setFilter] = useState<"all" | Plan>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const byPlan = filter === "all" ? students : students.filter((s) => s.plan === filter);
    const query = q.trim().toLowerCase();
    if (!query) return byPlan;
    return byPlan.filter((s) => s.name.toLowerCase().includes(query));
  }, [filter, students, q]);

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
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Ver alunos</h2>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Total: <b style={{ color: COLORS.text }}>{filtered.length}</b> aluno(s)
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
              background: "rgba(255,255,255,.03)",
              color: COLORS.text,
              outline: "none",
              minWidth: 220,
            }}
          />

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Filtrar por plano</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
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
                  <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>{s.name}</div>

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
                  Vencimento do plano: <b style={{ color: COLORS.text }}>{formatDateBR(s.planExpiresAt)}</b>
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
                    onClick={() => alert("Placeholder: planos de corrida (próxima fase).")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,.03)",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 900,
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