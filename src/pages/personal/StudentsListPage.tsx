import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPersonalDashboard, type PersonalDashboardStudent } from "../../services/personalDashboardApi";
import { COLORS } from "../../styles/colors";
import StudentProfileModal from "./StudentProfileModal";

type Plan = PersonalDashboardStudent["plan"];
type Student = PersonalDashboardStudent;

const PLAN_LABEL: Record<Plan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

const PERSONAL_BASE = "/app/personal" as const;
const routes = {
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

function statusPill(status: Student["engagementStatus"]) {
  const tone =
    status === "evolving"
      ? { bg: COLORS.successBg, border: COLORS.successBorder, label: "↑ Evoluindo" }
      : status === "on_track"
        ? { bg: COLORS.primarySoft, border: COLORS.borderStrong, label: "✓ No ritmo" }
        : status === "attention"
          ? { bg: COLORS.warnBg, border: COLORS.warnBorder, label: "⚠ Atenção" }
          : status === "fading"
            ? { bg: COLORS.warnBg, border: COLORS.warnBorder, label: "! Sumindo" }
            : { bg: COLORS.dangerBg, border: COLORS.dangerBorder, label: "✕ Em risco" };

  return (
    <span style={pillStyle({ bg: tone.bg, border: tone.border })}>{tone.label}</span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${COLORS.borderStrong}`,
        textDecoration: "none",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        background: COLORS.primary,
        transition: "transform .08s ease, background .12s ease, border-color .12s ease",
        boxShadow: "0 14px 28px rgba(34,197,94,.18)",
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
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

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
          dash.students
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
      evolving: 0,
      attention: 0,
      atRisk: 0,
    };

    for (const student of filtered) {
      if (student.engagementStatus === "evolving") base.evolving += 1;
      if (student.engagementStatus === "attention" || student.engagementStatus === "fading") base.attention += 1;
      if (student.engagementStatus === "at_risk") base.atRisk += 1;
    }

    const total = filtered.length || 1;

    return {
      total: filtered.length,
      items: [
        {
          key: "evolving",
          label: "Evoluindo",
          value: base.evolving,
          bg: COLORS.successBg,
          border: COLORS.successBorder,
        },
        {
          key: "attention",
          label: "Atenção",
          value: base.attention,
          bg: COLORS.warnBg,
          border: COLORS.warnBorder,
        },
        {
          key: "atRisk",
          label: "Em risco",
          value: base.atRisk,
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
        },
      ],
      segments: [
        {
          key: "evolving",
          width: `${(base.evolving / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(46,204,113,.95), rgba(34,197,94,.82))",
        },
        {
          key: "attention",
          width: `${(base.attention / total) * 100}%`,
          bg: "linear-gradient(135deg, rgba(255,196,0,.95), rgba(255,180,0,.82))",
        },
        {
          key: "atRisk",
          width: `${(base.atRisk / total) * 100}%`,
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
              onChange={(e) => setFilter(e.target.value as "all" | Plan)}
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
            Leitura rápida da carteira filtrada. Exemplo: <b style={{ color: COLORS.text }}>{statusSummary.items[2].value} aluno(s) em risco</b>.
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
              <div style={{ display: "grid", gap: 8, minWidth: 320, flex: "1 1 320px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>{s.name}</div>
                  <span style={planPillStyle(s.plan)}>Plano: {PLAN_LABEL[s.plan]}</span>
                  {statusPill(s.engagementStatus)}
                </div>

                <div style={{ color: COLORS.muted2, fontSize: 13 }}>
                  Último treino: <b style={{ color: COLORS.text }}>{fmtDate(s.lastWorkoutISO)}</b> • Último check-in:{" "}
                  <b style={{ color: COLORS.text }}>{fmtDate(s.lastCheckinISO)}</b> • Aderência:{" "}
                  <b style={{ color: COLORS.text }}>{s.adherencePct}%</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setSelectedStudent({ id: s.id, name: s.name })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FFFFFF",
                    color: COLORS.text,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Ver aluno
                </button>
                <ActionLink to={routes.workoutBuilder(s.id)} label="Criar treino" />
              </div>
            </div>
          );
        })}
      </div>

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
