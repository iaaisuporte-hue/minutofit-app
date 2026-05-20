import { useMemo } from "react";
import { COLORS } from "../../../styles/colors";
import type { PersonalStudentSnapshot } from "../../../services/personalDashboardApi";
import { Surface, Metric } from "./cockpitUtils";

type Props = {
  data: PersonalStudentSnapshot;
};

export function CockpitTabHistory({ data }: Props) {
  const formScoreAverage = useMemo(() => {
    if (!data.history.formScoreSeries.length) return null;
    const total = data.history.formScoreSeries.reduce(
      (sum, item) => sum + Number(item.score || 0),
      0
    );
    return Math.round(total / data.history.formScoreSeries.length);
  }, [data.history.formScoreSeries]);

  const muscleRanking = useMemo(() => {
    if (!data.history.muscleGroupCounts.length) return { top: [], bottom: [] };
    const sorted = [...data.history.muscleGroupCounts].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, 3);
    const bottom = sorted.slice(-3).reverse().filter((b) => !top.includes(b));
    return { top, bottom };
  }, [data.history.muscleGroupCounts]);

  return (
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
  );
}
