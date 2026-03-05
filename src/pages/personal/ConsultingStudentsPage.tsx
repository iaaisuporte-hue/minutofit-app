import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

type ConsultingStudent = {
  id: string;
  name: string;
  plan: "black";
  planExpiresAt: string; // ISO
  lastWorkoutUpdateAt: string; // ISO
  workoutsDoneInCurrentPlan: number;
  workoutsPlannedInCurrentPlan: number;
};

function formatDateBR(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR").format(d);
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

/** ====== IDENTIDADE VISUAL (TREINAí) ====== */
const COLORS = {
  panel: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
  card: "rgba(255,255,255,.03)",
  border: "rgba(255,255,255,.10)",
  borderStrong: "rgba(255,255,255,.14)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  muted2: "rgba(255,255,255,.60)",
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

function pillStyle(opts: { bg: string; border: string }): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1,
    color: COLORS.text,
    border: `1px solid ${opts.border}`,
    background: opts.bg,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    width: "fit-content",
  };
}

function Pill({
  children,
  variant = "neutral",
  title,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warn" | "danger" | "orange" | "blue";
  title?: string;
}) {
  const map = {
    neutral: { bg: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.12)" },
    success: { bg: COLORS.successBg, border: COLORS.successBorder },
    warn: { bg: COLORS.warnBg, border: COLORS.warnBorder },
    danger: { bg: COLORS.dangerBg, border: COLORS.dangerBorder },
    orange: { bg: COLORS.orangeSoft, border: COLORS.orangeBorder },
    blue: { bg: COLORS.blueBg, border: COLORS.blueBorder },
  } as const;

  return (
    <span title={title} style={pillStyle(map[variant])}>
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        background: COLORS.card,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
      }}
    >
      {children}
    </div>
  );
}

function ActionLink({
  to,
  label,
  kind = "ghost",
}: {
  to: string;
  label: string;
  kind?: "ghost" | "primary";
}) {
  const base: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
    fontSize: 14,
    lineHeight: 1,
    cursor: "pointer",
    width: "fit-content",
  };

  const variants: Record<typeof kind, React.CSSProperties> = {
    ghost: {
      border: `1px solid ${COLORS.border}`,
      background: "rgba(255,255,255,.03)",
      color: COLORS.text,
    },
    primary: {
      border: `1px solid ${COLORS.orangeBorder}`,
      background: COLORS.orange,
      color: "#0F0F0F",
      boxShadow: "0 10px 24px rgba(0,0,0,.35)",
    },
  };

  return (
    <Link to={to} style={{ ...base, ...variants[kind] }}>
      {label}
    </Link>
  );
}

export default function ConsultingStudentsPage() {
  const students: ConsultingStudent[] = useMemo(
    () => [
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

  const [onlyUrgent, setOnlyUrgent] = useState(false);

  const filtered = useMemo(() => {
    if (!onlyUrgent) return students;
    return students.filter((s) => daysLeftToExpireTraining(s.lastWorkoutUpdateAt, 30) <= 5);
  }, [students, onlyUrgent]);

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      {/* Header */}
      <Card>
        <div
          style={{
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            background: COLORS.panel,
            borderRadius: 16,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 18, letterSpacing: 0.2 }}>Alunos consultoria</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
              Só alunos do <b style={{ color: "#FFB703" }}>Black</b>. Priorize quem está com ficha vencendo.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setOnlyUrgent((v) => !v)}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: onlyUrgent ? "rgba(255,180,0,.14)" : "rgba(255,255,255,.03)",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 1000,
                fontSize: 14,
              }}
              title="Mostrar somente alunos com ficha vencida ou vencendo em até 5 dias"
            >
              {onlyUrgent ? "⚠️ Mostrando urgentes" : "Filtrar urgentes"}
            </button>

            <Pill variant="neutral">Total: {filtered.length}</Pill>
          </div>
        </div>
      </Card>

      {/* Lista */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((s) => {
          const left = daysLeftToExpireTraining(s.lastWorkoutUpdateAt, 30);
          const warningText = left <= 0 ? "Treino vencido — atualizar hoje" : `Faltam ${left} dia(s) para o treino vencer`;

          const warnVariant = left <= 0 ? "danger" : left <= 5 ? "warn" : "success";
          const warnIcon = left <= 0 ? "🛑" : left <= 5 ? "⚠️" : "✅";

          const done = s.workoutsDoneInCurrentPlan;
          const planned = s.workoutsPlannedInCurrentPlan;
          const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;

          const progressLabel =
            pct >= 85 ? "Consistência alta" : pct >= 50 ? "No ritmo" : pct > 0 ? "Baixa adesão" : "Sem check-in";
          const progressVariant = pct >= 85 ? "success" : pct >= 50 ? "neutral" : "warn";

          return (
            <div
              key={s.id}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                background: COLORS.card,
                boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.borderStrong;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.border;
              }}
            >
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
                {/* Infos */}
                <div style={{ display: "grid", gap: 10, minWidth: 280, flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: 0.2 }}>{s.name}</div>

                    <Pill variant="orange">💬 Consultoria • Black</Pill>

                    <Pill variant={warnVariant} title={warningText}>
                      {warnIcon} {warningText}
                    </Pill>

                    <Pill variant={progressVariant} title={`${done}/${planned} treinos no ciclo atual`}>
                      📈 {progressLabel} • {pct}%
                    </Pill>
                  </div>

                  <div style={{ color: COLORS.muted2, fontSize: 13, lineHeight: 1.45 }}>
                    Última atualização da ficha: <b style={{ color: COLORS.text }}>{formatDateBR(s.lastWorkoutUpdateAt)}</b>{" "}
                    • Plano vence em: <b style={{ color: COLORS.text }}>{formatDateBR(s.planExpiresAt)}</b>
                  </div>

                  <div style={{ color: COLORS.muted2, fontSize: 13, lineHeight: 1.45 }}>
                    Progresso da ficha atual: <b style={{ color: COLORS.text }}>{done}</b> / {planned} treinos concluídos
                  </div>

                  <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.45 }}>
                    {left <= 0 ? (
                      <>
                        🛑 <b style={{ color: COLORS.text }}>Ação:</b> atualizar ficha hoje e mandar mensagem curta com meta da
                        semana.
                      </>
                    ) : left <= 5 ? (
                      <>
                        ⚠️ <b style={{ color: COLORS.text }}>Ação:</b> preparar ajuste + reforçar check-ins (últimos dias do ciclo).
                      </>
                    ) : pct < 50 ? (
                      <>
                        👀 <b style={{ color: COLORS.text }}>Ação:</b> revisar aderência (volume/intensidade) e negociar rotina mínima.
                      </>
                    ) : (
                      <>
                        ✅ <b style={{ color: COLORS.text }}>Ação:</b> manter progressão e planejar próxima fase do ciclo.
                      </>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {/* ✅ IMPORTANTE: link RELATIVO pra funcionar dentro de /consulting */}
                  <ActionLink to={`../students/${s.id}/workouts/new`} label="🧩 Atualizar ficha" kind="primary" />

                  <button
                    onClick={() => alert("Placeholder: abrir histórico/check-ins do aluno (próxima fase).")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,.03)",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 1000,
                      fontSize: 14,
                    }}
                  >
                    🧾 Ver histórico
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}