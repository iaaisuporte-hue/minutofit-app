import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type WorkoutStats, type ExerciseProgression } from "../../../services/workoutSessionApi";

// Progressão de carga (Spec 010 V1.1) — frequência + ganho por exercício.
// Cada exercício expande num gráfico temporal (carga × data). Some quando não
// há dado suficiente (não polui a Evolução).

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 64, h = 20, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (values.length - 1);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke="var(--color-primary, #5E7412)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExerciseRow({ ex }: { ex: ExerciseProgression }) {
  const [open, setOpen] = useState(false);
  const up = ex.deltaKg > 0;
  const flat = ex.deltaKg === 0;
  const chartData = ex.points.map((p) => ({ date: fmtDay(p.date), kg: p.maxLoadKg }));

  return (
    <article className="metabolic-history-item" style={{ display: "grid", gap: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)",
          background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ color: "var(--color-text)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</strong>
          <span className="metabolic-eyebrow">{ex.points.length} sessões com carga · toque para ver</span>
        </div>
        <Sparkline values={ex.points.map((p) => p.maxLoadKg)} />
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{ex.firstLoadKg} → {ex.lastLoadKg} kg</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: up ? "var(--color-success-text, #5E7412)" : flat ? "var(--color-text-muted)" : "var(--color-warn, #D97706)" }}>
            {up ? "▲" : flat ? "→" : "▼"} {up ? "+" : ""}{ex.deltaKg} kg
          </div>
        </div>
      </button>

      {open && (
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E5E7EB)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-muted, #6B7280)" }} tickLine={false} axisLine={false} />
              <YAxis width={40} tick={{ fontSize: 11, fill: "var(--color-text-muted, #6B7280)" }} tickLine={false} axisLine={false} unit="kg" />
              <Tooltip formatter={(value) => [`${value} kg`, "Carga"]} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="kg" stroke="var(--color-primary, #5E7412)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

export function WorkoutProgressSection({ stats, loading }: { stats: WorkoutStats | null; loading: boolean }) {
  if (loading) return null;
  // Só renderiza com carga real por exercício. Sem carga, o hero ("Informe a
  // carga →") e o indicador "Carga —" já nudgeiam — evita card vazio repetitivo.
  if (!stats || stats.exerciseProgression.length === 0) return null;

  const top = stats.exerciseProgression.slice(0, 8);

  return (
    <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        <div className="metabolic-eyebrow">Treino</div>
        <h2 className="metabolic-section-title">Sua evolução de carga</h2>
        <p className="metabolic-section-copy">
          {stats.totalSessions} treino{stats.totalSessions === 1 ? "" : "s"} registrado{stats.totalSessions === 1 ? "" : "s"}
          {" · "}{stats.thisWeek} essa semana
        </p>
      </div>

      <div className="metabolic-history-list">
        {top.map((ex) => <ExerciseRow key={ex.exerciseId} ex={ex} />)}
      </div>
    </section>
  );
}
