import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

/** ✅ (0) TIPOS DO PLANO (usei na tabela “Visão geral”) */
type UserPlan = "basic" | "silver" | "gold" | "black";

/** ✅ (1) LABEL DO PLANO (usei na tabela “Visão geral”) */
const PLAN_LABEL: Record<UserPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

type Plan = UserPlan;

type Student = {
  id: string;
  name: string;
  plan: Plan;

  // métricas (mock agora, depois vem do backend)
  workouts7d: number; // treinos nos últimos 7 dias
  workouts30d: number; // treinos nos últimos 30 dias
  streakDays: number; // dias seguidos
  lastWorkoutISO: string; // última atividade
  adherencePct: number; // % de aderência ao plano (0-100)
  risk: "ok" | "alerta" | "critico"; // risco de abandono
  goal: "emagrecimento" | "hipertrofia" | "condicionamento";
  notes?: string;
};

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

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "--/--";
  }
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
    success: { bd: "rgba(34,197,94,.35)", bg: "rgba(34,197,94,.12)" },
    warn: { bd: "rgba(255,183,3,.35)", bg: "rgba(255,183,3,.12)" },
    danger: { bd: "rgba(220,38,38,.35)", bg: "rgba(220,38,38,.12)" },
    neutral: { bd: "rgba(255,255,255,.12)", bg: "rgba(255,255,255,.06)" },
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
        fontWeight: 900,
        fontSize: 12,
        lineHeight: 1,
        color: "#FFFFFF",
        whiteSpace: "nowrap",
        width: "fit-content",
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
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 16,
        background: "#171717",
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid rgba(255,255,255,.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, color: "#FFFFFF" }}>{title}</div>
          {subtitle ? (
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>{subtitle}</div>
          ) : null}
        </div>
        {right ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div> : null}
      </div>

      <div style={{ padding: 16 }}>{children}</div>
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
        background: "rgba(255,255,255,.08)",
        border: "1px solid rgba(255,255,255,.08)",
        overflow: "hidden",
      }}
      aria-label={`Progresso ${pct}%`}
      title={`${pct}%`}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "#FF6A00",
          transition: "width .25s ease",
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  /** ✅ helper local: só aceita rotas absolutas */
  function go(path: string) {
    navigate(toAbsolute(path));
  }

  // ✅ MOCK (agora). Depois é só trocar pelo fetch/estado global.
  const students: Student[] = useMemo(
    () => [
      {
        id: "u1",
        name: "Ana Beatriz",
        plan: "black",
        workouts7d: 5,
        workouts30d: 18,
        streakDays: 9,
        lastWorkoutISO: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        adherencePct: 92,
        risk: "ok",
        goal: "hipertrofia",
        notes: "Aumentar carga no leg press +5%",
      },
      {
        id: "u2",
        name: "Bruno Lima",
        plan: "gold",
        workouts7d: 1,
        workouts30d: 5,
        streakDays: 1,
        lastWorkoutISO: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        adherencePct: 34,
        risk: "critico",
        goal: "emagrecimento",
        notes: "Sumiu depois do 1º check-in",
      },
      {
        id: "u3",
        name: "Carla Souza",
        plan: "silver",
        workouts7d: 3,
        workouts30d: 11,
        streakDays: 4,
        lastWorkoutISO: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        adherencePct: 68,
        risk: "alerta",
        goal: "condicionamento",
        notes: "Preferência: treinos curtos",
      },
      {
        id: "u4",
        name: "Diego Santos",
        plan: "basic",
        workouts7d: 0,
        workouts30d: 2,
        streakDays: 0,
        lastWorkoutISO: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        adherencePct: 12,
        risk: "critico",
        goal: "emagrecimento",
        notes: "Reativar com plano simples 2x/semana",
      },
      {
        id: "u5",
        name: "Esther Rocha",
        plan: "black",
        workouts7d: 4,
        workouts30d: 15,
        streakDays: 7,
        lastWorkoutISO: new Date(Date.now() - 0.8 * 24 * 3600 * 1000).toISOString(),
        adherencePct: 85,
        risk: "ok",
        goal: "hipertrofia",
      },
    ],
    []
  );

  const stats = useMemo(() => {
    const total = students.length || 1;
    const total7d = students.reduce((acc, s) => acc + s.workouts7d, 0);
    const total30d = students.reduce((acc, s) => acc + s.workouts30d, 0);
    const avg7d = total7d / total;
    const avg30d = total30d / total;

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

  function riskBadge(risk: Student["risk"]) {
    if (risk === "ok") return <Badge variant="success">✅ Ok</Badge>;
    if (risk === "alerta") return <Badge variant="warn">⚠️ Alerta</Badge>;
    return <Badge variant="danger">🛑 Crítico</Badge>;
  }

  return (
    <div style={{ display: "grid", gap: 16, color: "#FFFFFF" }}>
      {/* Header */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 16,
          padding: 16,
          background: "#171717",
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Dashboard do Personal</div>
          <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
            Story rápido: quem está <b>em risco</b>, quem está <b>evoluindo</b> e o que você deve fazer <b>agora</b>.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => go(routes.students())}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
            }}
          >
            👥 Ver alunos
          </button>

          <button
            onClick={() => go(routes.library())}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
            }}
          >
            🎬 Treinos gerais
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Card
          title="Atividade (7 dias)"
          subtitle="Média por aluno na semana"
          right={<Badge variant="neutral">📆 {stats.total7d} treinos</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{stats.avg7d}/sem</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Se a média cair, simplifique (treinos mais curtos) e reduza fricção.
            </div>
          </div>
        </Card>

        <Card
          title="Consistência (30 dias)"
          subtitle="Volume mensal (média por aluno)"
          right={<Badge variant="neutral">🗓️ {stats.total30d} treinos</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{stats.avg30d}/mês</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Tendência boa = manter. Tendência ruim = ajustar estratégia e reforçar check-ins.
            </div>
          </div>
        </Card>

        <Card
          title="Risco de abandono"
          subtitle="Quem precisa de atenção imediata"
          right={<Badge variant="warn">⚠️ Alerta + Crítico</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{stats.alertCount + stats.criticalCount}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge variant="success">✅ Ok: {stats.okCount}</Badge>
              <Badge variant="warn">⚠️ Alerta: {stats.alertCount}</Badge>
              <Badge variant="danger">🛑 Crítico: {stats.criticalCount}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Destaques */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card
          title="Top performer da semana"
          subtitle="Reforce o que está funcionando e use como exemplo"
          right={<Badge variant="success">🔥 Alta</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{stats.most?.name || "-"}</div>
                <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
                  Último treino: {stats.most ? fmtDate(stats.most.lastWorkoutISO) : "--/--"} • Streak:{" "}
                  <b style={{ color: "#22C55E" }}>{stats.most?.streakDays || 0} dias</b>
                </div>
              </div>

              <Badge variant="neutral">🏋️ {stats.most?.workouts7d || 0}x/7d</Badge>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>Aderência ao plano</div>
              <ProgressBar value={stats.most?.adherencePct || 0} />
            </div>

            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Ação sugerida: <b>subir progressão</b> (carga/reps) e pedir um depoimento/IG pra motivar outros.
            </div>
          </div>
        </Card>

        <Card
          title="Precisa de resgate"
          subtitle="O aluno com menor atividade na semana"
          right={<Badge variant="danger">🛑 Urgente</Badge>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{stats.least?.name || "-"}</div>
                <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
                  Último treino: {stats.least ? fmtDate(stats.least.lastWorkoutISO) : "--/--"} • Objetivo:{" "}
                  <b style={{ color: "#FFFFFF" }}>{stats.least?.goal || "-"}</b>
                </div>
              </div>

              <Badge variant="neutral">🏋️ {stats.least?.workouts7d || 0}x/7d</Badge>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>Aderência ao plano</div>
              <ProgressBar value={stats.least?.adherencePct || 0} />
            </div>

            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Ação sugerida: mensagem curta + treino <b>simples</b> (10–15 min) pra “quebrar a inércia”.
            </div>
          </div>
        </Card>
      </div>

      {/* Prioridades do dia */}
      <Card title="Prioridades do dia" subtitle="Quem você deve contatar agora (ordem sugerida)" right={<Badge variant="neutral">⚡ Ação rápida</Badge>}>
        <div style={{ display: "grid", gap: 10 }}>
          {stats.needsFollowUp.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>Sem pendências críticas hoje ✅</div>
          ) : (
            stats.needsFollowUp.map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 14,
                  background: "#141414",
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 1000 }}>{s.name}</div>
                    {riskBadge(s.risk)}
                    <Badge variant="neutral">🏋️ {s.workouts7d}x/7d</Badge>
                    <Badge variant="neutral">🔥 {s.streakDays}d</Badge>
                  </div>

                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
                    Último treino: <b>{fmtDate(s.lastWorkoutISO)}</b> • Aderência: <b>{s.adherencePct}%</b>
                    {s.notes ? (
                      <>
                        {" "}
                        • Nota: <b>{s.notes}</b>
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => go(routes.messages())}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.12)",
                      background: "transparent",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      fontWeight: 1000,
                      fontSize: 14,
                    }}
                  >
                    ✉️ Mensagem
                  </button>

                  {/* ✅ AQUI está o "Ajustar treino" blindado */}
                  <button
                    onClick={() => go(routes.workoutBuilder(s.id))}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,106,0,.35)",
                      background: "#FF6A00",
                      color: "#0F0F0F",
                      cursor: "pointer",
                      fontWeight: 1000,
                      fontSize: 14,
                      boxShadow: "0 10px 24px rgba(0,0,0,.35)",
                    }}
                  >
                    🧠 Ajustar treino
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Visão geral */}
      <Card
        title="Visão geral dos alunos"
        subtitle="Quem treina muito, quem sumiu e quem está no meio do caminho."
        right={<Badge variant="neutral">📌 Rápido</Badge>}
      >
        <div style={{ display: "grid", gap: 8 }}>
          {students
            .slice()
            .sort((a, b) => b.workouts7d - a.workouts7d)
            .map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 14,
                  background: "#141414",
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.9fr 0.9fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 1000 }}>{s.name}</div>
                  <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>
                    Último: {fmtDate(s.lastWorkoutISO)} • Objetivo: {s.goal} • Plano: {PLAN_LABEL[s.plan]}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>Semana</div>
                  <div style={{ fontWeight: 1000 }}>{s.workouts7d} treinos</div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>Aderência</div>
                  <ProgressBar value={s.adherencePct} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>{riskBadge(s.risk)}</div>
              </div>
            ))}
        </div>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,.55)", fontSize: 12, lineHeight: 1.35 }}>
          💡 Quando ligar backend: calcule “risco” por (dias sem treino) + (queda no volume semanal) + (streak quebrado).
        </div>
      </Card>
    </div>
  );
}