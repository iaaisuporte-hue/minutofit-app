import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  fetchPersonalStudentSnapshot,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardRisk,
  type PersonalStudentSnapshot,
} from "../../services/personalDashboardApi";

type TabId = "today" | "week" | "history";

const PLAN_LABEL: Record<PersonalDashboardPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function initialFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function riskLabel(risk: PersonalDashboardRisk) {
  if (risk === "critico") return "Em risco";
  if (risk === "alerta") return "Atenção";
  return "No ritmo";
}

function riskTone(risk: PersonalDashboardRisk) {
  if (risk === "critico") return { bg: COLORS.dangerBg, border: COLORS.dangerBorder };
  if (risk === "alerta") return { bg: COLORS.warnBg, border: COLORS.warnBorder };
  return { bg: COLORS.successBg, border: COLORS.successBorder };
}

function engagementLabel(status: PersonalDashboardEngagementStatus) {
  if (status === "evolving") return "Evoluindo";
  if (status === "on_track") return "No ritmo";
  if (status === "fading") return "Sumindo";
  if (status === "at_risk") return "Em risco";
  return "Atenção";
}

function tabButton(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
    background: active ? COLORS.primarySoft : "#FFFFFF",
    color: COLORS.text,
    fontWeight: active ? 800 : 700,
    cursor: "pointer",
  };
}

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        background: "#FFFFFF",
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function Metric({ label, value, helper }: { label: string; value: React.ReactNode; helper?: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ color: COLORS.mutedSoft, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text }}>{value}</div>
      {helper ? <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.45 }}>{helper}</div> : null}
    </div>
  );
}

export default function StudentProfileModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("today");
  const [data, setData] = useState<PersonalStudentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const snapshot = await fetchPersonalStudentSnapshot(studentId);
        if (!active) return;
        setData(snapshot);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar o perfil do aluno.");
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [studentId]);

  const formScoreAverage = useMemo(() => {
    if (!data?.history.formScoreSeries.length) return null;
    const total = data.history.formScoreSeries.reduce((sum, item) => sum + Number(item.score || 0), 0);
    return Math.round(total / data.history.formScoreSeries.length);
  }, [data]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 520px)",
          height: "100%",
          background: COLORS.panel,
          boxShadow: "-18px 0 46px rgba(15,23,42,0.18)",
          borderLeft: `1px solid ${COLORS.border}`,
          padding: 18,
          overflowY: "auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: COLORS.primarySoft,
                border: `1px solid ${COLORS.borderStrong}`,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                color: COLORS.text,
              }}
            >
              {initialFromName(data?.name || studentName)}
            </div>

            <div style={{ display: "grid", gap: 5 }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: COLORS.text }}>{data?.name || studentName}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {PLAN_LABEL[data?.plan || "basic"]}
                </span>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${(data && riskTone(data.risk).border) || COLORS.border}`,
                    background: (data && riskTone(data.risk).bg) || COLORS.panelDeep,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {data ? riskLabel(data.risk) : "Carregando"}
                </span>
                {data ? (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${COLORS.borderStrong}`,
                      background: COLORS.primarySoft,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {engagementLabel(data.engagementStatus)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: "#FFFFFF",
              color: COLORS.text,
              borderRadius: 12,
              width: 40,
              height: 40,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <Surface>
            <Metric label="Streak" value={`${data?.streakDays ?? 0} dias`} />
          </Surface>
          <Surface>
            <Metric label="Aderência" value={`${data?.adherencePct ?? 0}%`} />
          </Surface>
          <Surface>
            <Metric label="XP" value={data?.history.xp ?? 0} />
          </Surface>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={tabButton(tab === "today")} onClick={() => setTab("today")}>
            Hoje
          </button>
          <button type="button" style={tabButton(tab === "week")} onClick={() => setTab("week")}>
            Semana
          </button>
          <button type="button" style={tabButton(tab === "history")} onClick={() => setTab("history")}>
            Histórico
          </button>
        </div>

        {loading ? (
          <Surface>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando visão do aluno...</div>
          </Surface>
        ) : null}

        {!loading && error ? (
          <Surface>
            <div style={{ color: COLORS.text, fontWeight: 700 }}>{error}</div>
          </Surface>
        ) : null}

        {!loading && !error && data && tab === "today" ? (
          <>
            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Janela de hoje</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <Metric
                    label="Check-in"
                    value={data.today.checkedInToday ? "Registrado" : "Sem registro hoje"}
                    helper={data.today.lastCheckinISO ? `Último: ${formatDateTime(data.today.lastCheckinISO)}` : "Ainda sem check-in no backend"}
                  />
                  <Metric
                    label="Score metabólico"
                    value={data.today.metabolism ? data.today.metabolism.score : "—"}
                    helper={data.today.metabolism ? `${data.today.metabolism.status} · tendência ${data.today.metabolism.trend}` : "Sem snapshot calculado"}
                  />
                </div>
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Atividade mais recente</div>
                {data.today.latestActivity ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700 }}>{data.today.latestActivity.type}</div>
                    <div style={{ color: COLORS.muted, fontSize: 13 }}>
                      {data.today.latestActivity.distanceKm.toFixed(2)} km · {data.today.latestActivity.durationMinutes} min · {formatDateTime(data.today.latestActivity.createdAt)}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Sem sessão GPS recente.</div>
                )}
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Status do treino</div>
                <div style={{ fontWeight: 700 }}>
                  {data.today.workoutStatus === "completed" ? "Treino concluído hoje" : "Treino ainda não iniciado hoje"}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  {data.today.latestWorkout
                    ? `${data.today.latestWorkout.title} · ${formatDateTime(data.today.latestWorkout.completedAt)}`
                    : "Sem workout log recente."}
                </div>
              </div>
            </Surface>
          </>
        ) : null}

        {!loading && !error && data && tab === "week" ? (
          <>
            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Semana do aluno</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
                  {data.week.days.map((day) => (
                    <div
                      key={day.date}
                      style={{
                        border: `1px solid ${day.workedOut ? COLORS.successBorder : COLORS.border}`,
                        borderRadius: 14,
                        background: day.workedOut ? COLORS.successBg : "#FFFFFF",
                        padding: 10,
                        textAlign: "center",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 11, color: COLORS.mutedSoft }}>{formatShortDate(day.date)}</div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{day.workedOut ? "✓" : day.hadGps ? "★" : "○"}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{day.checkedIn ? "check-in" : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <Metric
                  label="Form Score médio"
                  value={data.week.avgFormScore ?? "—"}
                  helper={
                    data.week.avgFormScore
                      ? `${data.week.movementSessions7d} sessão(ões) do Lab na semana`
                      : "Sem uso recente do Lab"
                  }
                />
                <Metric
                  label="Última mensagem"
                  value={data.week.latestMessagePreview ? formatShortDate(data.week.latestMessagePreview.createdAt) : "—"}
                  helper={data.week.latestMessagePreview?.text || "Sem conversa recente"}
                />
              </div>
            </Surface>
          </>
        ) : null}

        {!loading && !error && data && tab === "history" ? (
          <>
            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Aderência metabólica (14 dias)</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minHeight: 110 }}>
                  {data.history.adherence14d.map((point) => (
                    <div key={point.date} style={{ display: "grid", gap: 6, justifyItems: "center", flex: 1 }}>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 22,
                          height: `${Math.max(10, point.score)}px`,
                          borderRadius: 999,
                          background: COLORS.primary,
                        }}
                      />
                      <div style={{ fontSize: 10, color: COLORS.mutedSoft }}>{formatShortDate(point.date)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Form Score</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <Metric label="Média recente" value={formScoreAverage ?? "—"} />
                  <Metric
                    label="Último exercício"
                    value={data.history.formScoreSeries[0]?.exerciseLabel || "—"}
                    helper={data.history.formScoreSeries[0] ? `Score ${data.history.formScoreSeries[0].score}` : "Sem histórico"}
                  />
                </div>
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: COLORS.text }}>Atividades por tipo</div>
                {data.history.activityTypeCounts.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.history.activityTypeCounts.map((item) => (
                      <div
                        key={item.type}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: COLORS.panelDeep,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{item.type}</span>
                        <span style={{ color: COLORS.muted }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Sem atividades GPS nas últimas 2 semanas.</div>
                )}
              </div>
            </Surface>
          </>
        ) : null}
      </aside>
    </div>
  );
}
