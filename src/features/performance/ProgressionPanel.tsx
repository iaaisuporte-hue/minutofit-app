import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getProgression,
  type ProgressionExercise,
  type ProgressionResponse,
} from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";
import { PerformanceUpsell } from "./PerformanceUpsell";

/**
 * Progressão por exercício (Spec 033, P2).
 *
 * ## Decisões de leitura
 *
 * O gráfico mostra UMA métrica de cada vez, escolhida no seletor, com a unidade
 * escrita no eixo. Duas linhas no mesmo eixo (carga e 1RM estimado têm escalas
 * parecidas mas significados diferentes) convidariam à leitura errada.
 *
 * `connectNulls` fica FALSO de propósito: dia sem registro é buraco na linha, e
 * ligar os pontos por cima desenharia um treino que não houve. Pelo mesmo
 * motivo o eixo X é categórico (só os dias com dado), não uma linha do tempo
 * contínua — o espaçamento não sugere regularidade que não existe.
 */

type Metric = "load" | "e1rm" | "volume";

const METRICS: { id: Metric; label: string; unit: string; pick: (p: ProgressionExercise["points"][number]) => number | null }[] = [
  { id: "load", label: "Carga máxima", unit: "kg", pick: (p) => p.maxLoadKg },
  { id: "e1rm", label: "1RM estimado", unit: "kg", pick: (p) => p.bestE1rm },
  { id: "volume", label: "Volume", unit: "kg", pick: (p) => p.tonnageKg },
];

const WINDOWS = [30, 90, 180] as const;

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function ProgressionPanel() {
  const [data, setData] = useState<ProgressionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [windowDays, setWindowDays] = useState<number>(90);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("load");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    getProgression(windowDays, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        // `null` é falha de rede/servidor; resposta com lista vazia é "sem dados".
        if (res === null) setFailed(true);
        else {
          setData(res);
          postPerformanceEvent("performance.progression_viewed", {
            windowDays,
            exerciseCount: res.exercises.length,
            gated: res.gated,
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [windowDays]);

  const exercises = data?.exercises ?? [];
  const selected = useMemo(
    () => exercises.find((e) => e.exerciseId === exerciseId) ?? exercises[0] ?? null,
    [exercises, exerciseId],
  );

  const metricMeta = METRICS.find((m) => m.id === metric)!;
  const chartData = useMemo(
    () =>
      (selected?.points ?? []).map((p) => ({
        day: formatDay(p.date),
        value: metricMeta.pick(p),
      })),
    [selected, metricMeta],
  );
  const withValue = chartData.filter((d) => d.value != null).length;

  if (loading) {
    return (
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div className="metabolic-eyebrow">Progressão</div>
        <p className="metabolic-section-copy">Carregando sua evolução…</p>
      </section>
    );
  }

  if (failed) {
    return (
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div className="metabolic-eyebrow">Progressão</div>
        <p className="metabolic-section-copy" role="alert">
          Não foi possível carregar sua progressão agora. Puxe a tela para baixo para tentar de novo.
        </p>
      </section>
    );
  }

  if (data?.gated) return <PerformanceUpsell area="progressao" />;

  if (exercises.length === 0) {
    return (
      <div className="metabolic-empty">
        <p className="metabolic-section-copy">
          A progressão aparece quando o mesmo exercício é registrado com carga em pelo menos dois
          dias diferentes. Anote a carga no Modo Treino e a curva começa a se desenhar.
        </p>
      </div>
    );
  }

  return (
    <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        <div className="metabolic-eyebrow">Últimos {windowDays} dias</div>
        <h2 className="metabolic-section-title">Progressão por exercício</h2>
      </div>

      <div className="metabolic-period-filter perf-chip-row" role="group" aria-label="Janela de tempo">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            className={`metabolic-period-chip${windowDays === w ? " is-active" : ""}`}
            aria-pressed={windowDays === w}
            onClick={() => setWindowDays(w)}
          >
            {w} dias
          </button>
        ))}
      </div>

      <label className="metabolic-eyebrow" htmlFor="perf-exercise">
        Exercício
      </label>
      <select
        id="perf-exercise"
        className="input"
        style={{ minHeight: 44 }}
        value={selected?.exerciseId ?? ""}
        onChange={(e) => {
          setExerciseId(e.target.value);
          postPerformanceEvent("performance.exercise_selected", { exerciseId: e.target.value });
        }}
      >
        {exercises.map((ex) => (
          <option key={ex.exerciseId} value={ex.exerciseId}>
            {ex.name}
            {ex.deltaKg != null && ex.deltaKg !== 0
              ? ` (${ex.deltaKg > 0 ? "+" : "−"}${Math.abs(ex.deltaKg)} kg)`
              : ""}
          </option>
        ))}
      </select>

      <div className="metabolic-period-filter perf-chip-row" role="group" aria-label="Métrica exibida">
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`metabolic-period-chip${metric === m.id ? " is-active" : ""}`}
            aria-pressed={metric === m.id}
            onClick={() => setMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="metabolic-metric-grid">
            <div className="metabolic-metric">
              <span className="metabolic-metric-label">{metricMeta.label} no período</span>
              <span className="perf-figure-value">
                {metricMeta.pick(selected.points[selected.points.length - 1]) ?? "—"}
                <span className="perf-figure-unit">{metricMeta.unit}</span>
              </span>
              <span className="metabolic-metric-hint">
                {selected.pointCount === 1
                  ? "Um único dia registrado — ainda é uma foto, não uma curva."
                  : `${selected.pointCount} dias com registro neste período.`}
              </span>
            </div>
          </div>

          {withValue === 0 ? (
            <p className="metabolic-section-copy">
              Sem {metricMeta.label.toLowerCase()} registrada para este exercício no período. Tente
              outra métrica ou uma janela maior.
            </p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                {/* Sem margem esquerda negativa: com `YAxis width` explícito ela
                    corta os rótulos ("0 kg" virava ")0 kg" em 360px). */}
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    stroke="var(--color-border)"
                    width={44}
                    unit={` ${metricMeta.unit}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${v} ${metricMeta.unit}`, metricMeta.label]}
                  />
                  {/* connectNulls falso: dia sem registro fica como buraco, não
                      como reta inventada entre dois treinos distantes. */}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </section>
  );
}
