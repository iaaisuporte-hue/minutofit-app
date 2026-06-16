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
  onTabChange: (tab: CockpitTabId) => void;
};

type ReadinessLevel = "green" | "yellow" | "red" | "unknown";

function deriveReadinessFromWellbeing(
  wellbeing: PersonalStudentSnapshot["today"]["wellbeing"]
): ReadinessLevel {
  if (!wellbeing) return "unknown";
  if (wellbeing.inPain === true) return "red";
  if (wellbeing.feeling === "tired" && wellbeing.sleptWell === false) return "red";
  if (wellbeing.sleptWell === false || wellbeing.feeling === "tired" || wellbeing.stressed === true) return "yellow";
  return "green";
}

const READINESS_CONFIG: Record<ReadinessLevel, { label: string; color: string; bg: string }> = {
  green:   { label: "Pronto para treinar",    color: "var(--color-success-text)", bg: "var(--color-success-soft, #e8f9ef)" },
  yellow:  { label: "Dia de ajuste de carga", color: "var(--color-warn, #b35a00)", bg: "var(--color-warn-soft, #fff8e1)" },
  red:     { label: "Recuperação indicada",   color: "var(--color-danger, #c00)", bg: "var(--color-danger-soft, #fff0f0)" },
  unknown: { label: "Sem check-in hoje",      color: COLORS.muted,                bg: "transparent" },
};

export function CockpitTabToday({ data, onTabChange }: Props) {
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

  const readinessLevel = useMemo(
    () => deriveReadinessFromWellbeing(data.today.wellbeing),
    [data.today.wellbeing]
  );
  const readinessCfg = READINESS_CONFIG[readinessLevel];

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

      {/* Prontidão derivada dos sinais de bem-estar do check-in */}
      <Surface>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 650, color: COLORS.text }}>Prontidão de hoje</div>
            {readinessLevel !== "unknown" && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: readinessCfg.color,
                  background: readinessCfg.bg,
                  border: `1px solid ${readinessCfg.color}33`,
                }}
              >
                {readinessCfg.label}
              </span>
            )}
          </div>

          {data.today.wellbeing ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.today.wellbeing.feeling ? (
                <span className="pp-meta-chip">
                  Humor:{" "}
                  {data.today.wellbeing.feeling === "energized"
                    ? "Disposto"
                    : data.today.wellbeing.feeling === "tired"
                      ? "Cansado"
                      : "Normal"}
                </span>
              ) : null}
              {data.today.wellbeing.sleptWell != null ? (
                <span className="pp-meta-chip">
                  Sono: {data.today.wellbeing.sleptWell ? "ok" : "ruim"}
                </span>
              ) : null}
              {data.today.wellbeing.inPain != null ? (
                <span className={`pp-meta-chip${data.today.wellbeing.inPain ? " pp-badge--danger" : ""}`}>
                  Dor: {data.today.wellbeing.inPain ? "sim" : "não"}
                </span>
              ) : null}
              {data.today.wellbeing.stressed != null ? (
                <span className="pp-meta-chip">
                  Estresse: {data.today.wellbeing.stressed ? "sim" : "não"}
                </span>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              {data.today.checkedInToday
                ? "Check-in sem sinais de bem-estar registrados."
                : "Aluno ainda não fez check-in hoje."}
            </div>
          )}

          {/* CTA para configurar adaptação automática */}
          {(readinessLevel === "yellow" || readinessLevel === "red") && (
            <button
              type="button"
              className="pp-btn pp-btn--ghost pp-btn--sm"
              style={{ alignSelf: "flex-start", marginTop: 4 }}
              onClick={() => onTabChange("technical")}
            >
              Ajustar adaptação automática
            </button>
          )}
        </div>
      </Surface>

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
        </div>
      </Surface>
    </>
  );
}
