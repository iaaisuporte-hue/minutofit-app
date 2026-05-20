import { useMemo } from "react";
import { COLORS } from "../../../styles/colors";
import {
  MetabolicScoreCard,
} from "../../../features/metabolism/MetabolicScoreCard";
import type { MetabolicData } from "../../../features/metabolism/metabolism.types";
import {
  deriveEnergyStatus,
  deriveMetabolicForecast,
} from "../../../features/metabolism/metabolismDerivations";
import type {
  PersonalStudentActivity,
  PersonalStudentSnapshot,
} from "../../../services/personalDashboardApi";
import { suggestCockpitAction, type CockpitTabId } from "../lib/cockpitActions";
import {
  Surface,
  Metric,
  formatDateTime,
  metabolismBandLabel,
  metabolismNarrative,
} from "./cockpitUtils";

type Props = {
  data: PersonalStudentSnapshot;
  activities: PersonalStudentActivity[];
  onTabChange: (tab: CockpitTabId) => void;
};

export function CockpitTabToday({ data, activities, onTabChange }: Props) {
  const workoutsThisWeek = useMemo(
    () => data.week.days.filter((d) => d.workedOut).length,
    [data.week.days]
  );

  const cockpitSuggestion = useMemo(() => suggestCockpitAction(data), [data]);

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

  const metabolicForecast = useMemo(
    () =>
      deriveMetabolicForecast(metabolicData, {
        streak: data.streakDays ?? 0,
        todayCheckedIn: data.today.checkedInToday ?? false,
        activityImpact: Math.min(14, workoutsThisWeek * 2),
      }),
    [metabolicData, data.streakDays, data.today.checkedInToday, workoutsThisWeek]
  );

  const derivedEnergy = useMemo(() => deriveEnergyStatus(metabolicData), [metabolicData]);

  return (
    <>
      {metabolicData ? (
        <MetabolicScoreCard
          data={metabolicData}
          loading={false}
          error={null}
          derivedStatus={derivedEnergy}
          forecast={metabolicForecast}
        />
      ) : (
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
      )}

      {cockpitSuggestion ? (
        <Surface>
          <div className="pp-kicker">Próxima ação sugerida</div>
          <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.45, marginTop: 6 }}>
            {cockpitSuggestion.message}
          </div>
          <button
            type="button"
            className="pp-btn pp-btn--ghost pp-btn--sm"
            style={{ marginTop: 10 }}
            onClick={() => onTabChange(cockpitSuggestion.tab)}
          >
            {cockpitSuggestion.tab === "technical"
              ? "Ir para Técnica"
              : cockpitSuggestion.tab === "week"
                ? "Ir para Semana"
                : cockpitSuggestion.tab === "history"
                  ? "Ir para Histórico"
                  : "Ir para Hoje"}
          </button>
        </Surface>
      ) : null}

      {(data.technical?.recentNotes ?? []).length > 0 ? (
        <Surface>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 650, color: COLORS.text }}>Observações recentes</div>
            <button
              type="button"
              className="pp-btn pp-btn--ghost pp-btn--sm"
              onClick={() => onTabChange("technical")}
            >
              Ver tudo
            </button>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {(data.technical?.recentNotes ?? []).slice(0, 3).map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  fontSize: 13,
                  color: COLORS.muted,
                }}
              >
                <div style={{ fontWeight: 600, color: COLORS.text }}>{n.exerciseName}</div>
                <div style={{ marginTop: 4, lineHeight: 1.4 }}>
                  {n.note.length > 140 ? `${n.note.slice(0, 140)}…` : n.note}
                </div>
                <div style={{ marginTop: 6, fontSize: 11 }}>{formatDateTime(n.recordedAt)}</div>
              </div>
            ))}
          </div>
        </Surface>
      ) : null}

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
              value={data.today.workoutStatus === "completed" ? "Concluído" : "Não iniciado"}
              helper={
                data.today.latestWorkout
                  ? `${data.today.latestWorkout.title} · ${formatDateTime(data.today.latestWorkout.completedAt)}`
                  : "Sem workout log recente"
              }
            />
          </div>
          {data.today.wellbeing ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {data.today.wellbeing.feeling ? (
                <span className="badge badge-accent" style={{ fontSize: 11 }}>
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
            <div style={{ fontWeight: 650, color: COLORS.text }}>Atividade mais recente (GPS)</div>
            <div style={{ fontWeight: 700 }}>{data.today.latestActivity.type}</div>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>
              {data.today.latestActivity.distanceKm.toFixed(2)} km ·{" "}
              {data.today.latestActivity.durationMinutes} min
              {data.today.latestActivity.score != null
                ? ` · score ${data.today.latestActivity.score}`
                : ""}
              {data.today.latestActivity.caloriesEstimated != null
                ? ` · ~${data.today.latestActivity.caloriesEstimated} kcal`
                : ""}
              {data.today.latestActivity.validationFlag ? " · validada" : ""}
              {" · "}
              {formatDateTime(data.today.latestActivity.createdAt)}
            </div>
          </div>
        </Surface>
      ) : null}

      {activities.length > 0 ? (
        <Surface>
          <div style={{ fontWeight: 650, color: COLORS.text, marginBottom: 8 }}>Últimas sessões GPS</div>
          <div style={{ display: "grid", gap: 8 }}>
            {activities.slice(0, 5).map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 13,
                  color: COLORS.muted,
                }}
              >
                <span style={{ fontWeight: 600, color: COLORS.text }}>{a.activityType}</span>
                <span>
                  {a.distanceKm.toFixed(1)} km · {Math.round(a.durationSeconds / 60)} min
                  {a.score != null ? ` · ${a.score}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Surface>
      ) : null}
    </>
  );
}
