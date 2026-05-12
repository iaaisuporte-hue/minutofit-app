import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  fetchPersonalStudentSnapshot,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardRisk,
  type PersonalStudentSnapshot,
} from "../../services/personalDashboardApi";
import "./personalPremium.css";

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
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function engagementLabel(status: PersonalDashboardEngagementStatus) {
  if (status === "evolving") return "Evoluindo";
  if (status === "on_track") return "No ritmo";
  if (status === "fading") return "Sumindo";
  if (status === "at_risk") return "Em risco";
  return "Atenção";
}

function snapshotErrorMessage(message: string) {
  if (/route not found/i.test(message)) {
    return "A visão detalhada deste aluno ainda não está disponível nesta versão da API.";
  }
  return message;
}

function metabolismBandLabel(score: number | null): {
  band: "low" | "moderate" | "high";
  label: string;
  toneClass: string;
} | null {
  if (score === null) return null;
  if (score >= 70) return { band: "high", label: "alto", toneClass: "pp-metabo-card--high" };
  if (score >= 45)
    return { band: "moderate", label: "moderado", toneClass: "pp-metabo-card--moderate" };
  return { band: "low", label: "baixo", toneClass: "pp-metabo-card--low" };
}

function metabolismNarrative(
  metabolism: PersonalStudentSnapshot["today"]["metabolism"],
  workoutsThisWeek: number
): string {
  if (!metabolism) {
    return "Sem snapshot calculado ainda — registre o primeiro check-in para começar a leitura.";
  }
  const trend = metabolism.trend;
  const score = metabolism.score;

  if (trend === "down" && score < 55) {
    return "Score em queda e abaixo da faixa saudável. Vale investigar fadiga, sono e volume recente.";
  }
  if (trend === "down") {
    return "Tendência de queda nas últimas semanas — fique de olho na recuperação.";
  }
  if (score >= 70 && trend === "up") {
    return "Em boa fase metabólica — momento de progressão controlada de carga.";
  }
  if (score >= 70) {
    return "Metabolismo em ritmo alto — manter constância sem aumentar volume bruscamente.";
  }
  if (score < 45 && workoutsThisWeek >= 4) {
    return "Volume alto sem retorno metabólico — considerar uma semana de descarga.";
  }
  if (score < 45) {
    return "Score baixo. Reengajar com treinos curtos e foco em recuperação.";
  }
  return "Em ritmo moderado — espaço para evoluir consistência sem sobrecarregar.";
}

function buildAdherenceNarrative(series: Array<{ date: string; score: number }>): string {
  if (!series.length) return "Sem snapshots suficientes para leitura semanal.";
  if (series.length < 4) return "Histórico curto — leitura ainda em formação.";
  const half = Math.floor(series.length / 2);
  const recent = series.slice(-half);
  const older = series.slice(0, half);
  const avg = (xs: typeof series) =>
    xs.reduce((sum, item) => sum + Number(item.score || 0), 0) / Math.max(xs.length, 1);
  const delta = avg(recent) - avg(older);
  if (delta <= -8) return "Aderência caindo na última semana.";
  if (delta >= 8) return "Aderência subindo nos últimos dias — boa fase.";
  return "Aderência estável no período.";
}

function Surface({ children }: { children: React.ReactNode }) {
  return <div className="pp-surface">{children}</div>;
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div className="pp-metric__label">{label}</div>
      <div style={{ fontWeight: 650, fontSize: 20, color: COLORS.text }}>{value}</div>
      {helper ? (
        <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.45 }}>{helper}</div>
      ) : null}
    </div>
  );
}

function AdherenceSparkline({ series }: { series: Array<{ date: string; score: number }> }) {
  if (!series.length) {
    return (
      <div style={{ color: COLORS.muted, fontSize: 13 }}>
        Sem snapshots metabólicos suficientes ainda.
      </div>
    );
  }

  const max = Math.max(100, ...series.map((p) => p.score));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minHeight: 80 }}>
      {series.map((point) => {
        const h = Math.max(8, Math.round((point.score / max) * 72));
        return (
          <div
            key={point.date}
            title={`${formatShortDate(point.date)} — ${point.score}`}
            style={{ display: "grid", gap: 4, justifyItems: "center", flex: 1 }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 14,
                height: h,
                borderRadius: 6,
                background: point.score < 45 ? "#F59E0B" : point.score < 70 ? "#60A5FA" : "#22C55E",
              }}
            />
          </div>
        );
      })}
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
        const message = err instanceof Error ? err.message : "Não foi possível carregar o perfil do aluno.";
        setError(snapshotErrorMessage(message));
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
    const total = data.history.formScoreSeries.reduce(
      (sum, item) => sum + Number(item.score || 0),
      0
    );
    return Math.round(total / data.history.formScoreSeries.length);
  }, [data]);

  const workoutsThisWeek = useMemo(() => {
    if (!data?.week.days.length) return 0;
    return data.week.days.filter((d) => d.workedOut).length;
  }, [data]);

  const muscleRanking = useMemo(() => {
    if (!data?.history.muscleGroupCounts.length) return { top: [], bottom: [] };
    const sorted = [...data.history.muscleGroupCounts].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, 3);
    const bottom = sorted.slice(-3).reverse().filter((b) => !top.includes(b));
    return { top, bottom };
  }, [data]);

  return (
    <div className="pp-drawer-backdrop" onClick={onClose}>
      <aside onClick={(event) => event.stopPropagation()} className="pp-drawer">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="pp-avatar">{initialFromName(data?.name || studentName)}</div>
            <div style={{ display: "grid", gap: 5 }}>
              <div className="pp-drawer-title">{data?.name || studentName}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="pp-badge">{PLAN_LABEL[data?.plan || "basic"]}</span>
                {data ? (
                  <span
                    className={`pp-badge ${
                      data.risk === "critico"
                        ? "pp-badge--danger"
                        : data.risk === "alerta"
                          ? "pp-badge--warn"
                          : "pp-badge--success"
                    }`}
                  >
                    {riskLabel(data.risk)}
                  </span>
                ) : (
                  <span className="pp-badge">Carregando</span>
                )}
                {data ? (
                  <span className="pp-badge pp-badge--soft">
                    {engagementLabel(data.engagementStatus)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="pp-icon-btn">
            ×
          </button>
        </div>

        {!error ? (
          <div className="pp-tabs">
            <button type="button" className="pp-tab" aria-selected={tab === "today"} onClick={() => setTab("today")}>
              Hoje
            </button>
            <button type="button" className="pp-tab" aria-selected={tab === "week"} onClick={() => setTab("week")}>
              Semana
            </button>
            <button type="button" className="pp-tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
              Histórico
            </button>
          </div>
        ) : null}

        {loading ? (
          <Surface>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando visão do aluno...</div>
          </Surface>
        ) : null}

        {!loading && error ? (
          <div className="pp-error-state">
            <div style={{ color: COLORS.text, fontWeight: 650 }}>Perfil detalhado indisponível</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
              {error} O painel principal continua disponível para acompanhamento rápido.
            </div>
          </div>
        ) : null}

        {!loading && !error && data && tab === "today" ? (
          <>
            <div
              className={`pp-metabo-card ${
                metabolismBandLabel(data.today.metabolism?.score ?? null)?.toneClass ?? ""
              }`}
            >
              <div className="pp-metabo-card__score">
                <div className="pp-kicker">Score metabólico</div>
                <div className="pp-metabo-card__value">{data.today.metabolism?.score ?? "—"}</div>
                <div className="pp-metabo-card__meta">
                  {data.today.metabolism
                    ? `${metabolismBandLabel(data.today.metabolism.score)?.label} · tendência ${data.today.metabolism.trend}`
                    : "Sem snapshot ainda"}
                </div>
              </div>
              <div className="pp-metabo-card__narrative">
                {metabolismNarrative(data.today.metabolism, workoutsThisWeek)}
              </div>
            </div>

            <div className="pp-metrics-grid">
              <Surface>
                <Metric label="Streak" value={`${data.streakDays} dias`} />
              </Surface>
              <Surface>
                <Metric label="Aderência" value={`${data.adherencePct}%`} />
              </Surface>
              <Surface>
                <Metric label="XP" value={data.history.xp} />
              </Surface>
            </div>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 650, color: COLORS.text }}>Janela de hoje</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <Metric
                    label="Check-in"
                    value={data.today.checkedInToday ? "Registrado" : "Sem registro hoje"}
                    helper={
                      data.today.lastCheckinISO
                        ? `Último: ${formatDateTime(data.today.lastCheckinISO)}`
                        : "Ainda sem check-in"
                    }
                  />
                  <Metric
                    label="Treino"
                    value={
                      data.today.workoutStatus === "completed"
                        ? "Concluído"
                        : "Não iniciado"
                    }
                    helper={
                      data.today.latestWorkout
                        ? `${data.today.latestWorkout.title} · ${formatDateTime(
                            data.today.latestWorkout.completedAt
                          )}`
                        : "Sem workout log recente"
                    }
                  />
                </div>
                {data.today.wellbeing ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {data.today.wellbeing.feeling ? (
                      <span
                        className="badge badge-accent"
                        style={{ fontSize: 11 }}
                      >
                        Humor:{" "}
                        {data.today.wellbeing.feeling === "energized"
                          ? "Disposto"
                          : data.today.wellbeing.feeling === "tired"
                            ? "Cansado"
                            : "Normal"}
                      </span>
                    ) : null}
                    {data.today.wellbeing.sleptWell != null ? (
                      <span className="badge" style={{ fontSize: 11 }}>
                        Sono: {data.today.wellbeing.sleptWell ? "ok" : "ruim"}
                      </span>
                    ) : null}
                    {data.today.wellbeing.inPain != null ? (
                      <span className="badge" style={{ fontSize: 11 }}>
                        Dor: {data.today.wellbeing.inPain ? "sim" : "não"}
                      </span>
                    ) : null}
                    {data.today.wellbeing.stressed != null ? (
                      <span className="badge" style={{ fontSize: 11 }}>
                        Estresse: {data.today.wellbeing.stressed ? "sim" : "não"}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
                    Sem sinais de humor ou recuperação no último check-in.
                  </div>
                )}
              </div>
            </Surface>

            {data.today.latestActivity ? (
              <Surface>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 650, color: COLORS.text }}>Atividade mais recente</div>
                  <div style={{ fontWeight: 700 }}>{data.today.latestActivity.type}</div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    {data.today.latestActivity.distanceKm.toFixed(2)} km ·{" "}
                    {data.today.latestActivity.durationMinutes} min ·{" "}
                    {formatDateTime(data.today.latestActivity.createdAt)}
                  </div>
                </div>
              </Surface>
            ) : null}
          </>
        ) : null}

        {!loading && !error && data && tab === "week" ? (
          <>
            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 650, color: COLORS.text }}>Aderência metabólica (14 dias)</div>
                <AdherenceSparkline series={data.history.adherence14d} />
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  {buildAdherenceNarrative(data.history.adherence14d)}
                </div>
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 650, color: COLORS.text }}>Semana do aluno</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
                  {data.week.days.map((day) => (
                    <div
                      key={day.date}
                      className="pp-week-day"
                      data-active={day.workedOut}
                      title={`${formatShortDate(day.date)}${day.workedOut ? " · treino" : day.hadGps ? " · GPS" : ""}${day.checkedIn ? " · check-in" : ""}`}
                    >
                      <div style={{ fontSize: 10, color: COLORS.mutedSoft }}>{formatShortDate(day.date)}</div>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          margin: "4px auto",
                          background: day.workedOut
                            ? "#22C55E"
                            : day.hadGps
                              ? "#60A5FA"
                              : "rgba(0,0,0,.10)",
                        }}
                      />
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{day.checkedIn ? "ok" : "—"}</div>
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
                      ? `${data.week.movementSessions7d} sessão(ões) do Lab`
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
                <div style={{ fontWeight: 650, color: COLORS.text }}>
                  Grupos musculares — últimos 30 dias
                </div>
                {muscleRanking.top.length === 0 ? (
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    Sem treinos registrados no período para gerar ranking.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div className="pp-metric__label">Mais executados</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {muscleRanking.top.map((item) => (
                          <span key={item.group} className="pp-meta-chip">
                            <b>{item.group}</b> · {item.count}x
                          </span>
                        ))}
                      </div>
                    </div>
                    {muscleRanking.bottom.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div className="pp-metric__label">Menos executados</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {muscleRanking.bottom.map((item) => (
                            <span key={item.group} className="pp-meta-chip">
                              <b>{item.group}</b> · {item.count}x
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 650, color: COLORS.text }}>Form Score</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <Metric label="Média recente" value={formScoreAverage ?? "—"} />
                  <Metric
                    label="Último exercício"
                    value={data.history.formScoreSeries[0]?.exerciseLabel || "—"}
                    helper={
                      data.history.formScoreSeries[0]
                        ? `Score ${data.history.formScoreSeries[0].score}`
                        : "Sem histórico"
                    }
                  />
                </div>
              </div>
            </Surface>

            {data.history.activityTypeCounts.length ? (
              <Surface>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 650, color: COLORS.text }}>Atividades por tipo</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.history.activityTypeCounts.map((item) => (
                      <div
                        key={item.type}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: COLORS.panelDeep,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <span style={{ fontWeight: 650 }}>{item.type}</span>
                        <span style={{ color: COLORS.muted }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Surface>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
