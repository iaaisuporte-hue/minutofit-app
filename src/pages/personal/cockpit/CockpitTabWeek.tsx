import { useMemo } from "react";
import { COLORS } from "../../../styles/colors";
import { MetabolicChart } from "../../../features/metabolism/MetabolicChart";
import type { MetabolicData, MetabolicHistory } from "../../../features/metabolism/metabolism.types";
import {
  deriveMetabolicForecast,
  deriveHistoryMarkers,
  buildForecastHistory,
} from "../../../features/metabolism/metabolismDerivations";
import type { PersonalStudentSnapshot } from "../../../services/personalDashboardApi";
import {
  Surface,
  Metric,
  AdherenceSparkline,
  formatShortDate,
  buildAdherenceNarrative,
} from "./cockpitUtils";

type Props = {
  data: PersonalStudentSnapshot;
};

export function CockpitTabWeek({ data }: Props) {
  const workoutsThisWeek = useMemo(
    () => data.week.days.filter((d) => d.workedOut).length,
    [data.week.days]
  );

  const metabolicData: MetabolicData | null = useMemo(() => {
    const d = data.metabolismDetail;
    if (!d) return null;
    return {
      score: d.score,
      status: d.status,
      trend: d.trend,
      factors: d.factors ?? [],
      recommendations: (d.recommendations ?? []) as MetabolicData["recommendations"],
      trend7d: d.trend7d,
      trend30d: d.trend30d,
    };
  }, [data.metabolismDetail]);

  const chartHistory: MetabolicHistory = useMemo(
    () => (data.history.adherence14d ?? []).map((p) => ({ date: p.date, score: p.score })),
    [data.history.adherence14d]
  );

  const metabolicForecast = useMemo(
    () =>
      deriveMetabolicForecast(metabolicData, {
        streak: data.streakDays ?? 0,
        todayCheckedIn: data.today.checkedInToday ?? false,
        activityImpact: Math.min(14, workoutsThisWeek * 2),
      }),
    [metabolicData, data.streakDays, data.today.checkedInToday, workoutsThisWeek]
  );

  const historyMarkers = useMemo(
    () =>
      deriveHistoryMarkers(chartHistory, {
        todayCheckedIn: data.today.checkedInToday ?? false,
      }),
    [chartHistory, data.today.checkedInToday]
  );

  const wellbeingSeries = data.history.wellbeingHistory14d ?? [];

  return (
    <>
      <Surface>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 650, color: COLORS.text }}>Aderência metabólica (14 dias)</div>
          {chartHistory.length >= 2 ? (
            <MetabolicChart
              data={buildForecastHistory(chartHistory, metabolicForecast)}
              loading={false}
              forecast={metabolicForecast}
              markers={historyMarkers}
            />
          ) : (
            <AdherenceSparkline series={data.history.adherence14d} />
          )}
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            {buildAdherenceNarrative(data.history.adherence14d)}
          </div>
        </div>
      </Surface>

      {wellbeingSeries.length > 0 ? (
        <Surface>
          <div style={{ fontWeight: 650, color: COLORS.text, marginBottom: 8 }}>Bem-estar (14 dias)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {wellbeingSeries.map((w) => (
              <span key={w.dateKey} className="pp-meta-chip" title={w.dateKey}>
                {w.sleptWell === false ? "Sono" : w.feeling === "tired" ? "Cansado" : "·"}
              </span>
            ))}
          </div>
        </Surface>
      ) : null}

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
                      ? "#7B9919"
                      : day.hadGps
                        ? "#60A5FA"
                        : "var(--color-surface-subtle)",
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
            value={
              data.week.latestMessagePreview
                ? formatShortDate(data.week.latestMessagePreview.createdAt)
                : "—"
            }
            helper={data.week.latestMessagePreview?.text || "Sem conversa recente"}
          />
        </div>
      </Surface>
    </>
  );
}
