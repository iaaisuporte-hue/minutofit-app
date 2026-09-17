import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardList, Calculator } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { SkeletonPanelCard } from "../../components/feedback/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { getDayIntake, type DayIntakeResponse } from "../../services/nutritionIntakeApi";

/**
 * "Seu dia nutricional" — PLAN_NUTRITION_QUICK_MACROS (P1B, adendo).
 *
 * Visão do ALUNO apenas — nada aqui alimenta o lado do nutri (isso é P1C,
 * fora de escopo deste adendo). Responde 3 perguntas em poucos segundos:
 * o que estava planejado, o que eu registrei, como estou hoje — sem virar
 * dashboard: uma barra de energia, 3-4 barras de macro, um gráfico
 * acumulado e uma frase factual. Nunca julga ("bom"/"ruim"), nunca inventa
 * meta, nunca trata "13h" como "dia falhou".
 */
export function NutritionDaySummary({ refreshToken = 0 }: { refreshToken?: number }) {
  const [data, setData] = useState<DayIntakeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    getDayIntake()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [refreshToken]);

  if (loading) return <SkeletonPanelCard />;
  if (error) {
    return (
      <div className="card cardPad" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>
          Não foi possível carregar seu dia nutricional agora.
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { totals, target, logs, coverage } = data;
  // `?? []`: backend mais antigo (deploy atrasado) pode não incluir este
  // campo ainda — nunca deixar a tela quebrar por descompasso de deploy.
  const plannedMeals = data.plannedMeals ?? [];
  const hasLogs = logs.length > 0;
  const isPlanTarget = target?.source === "plan_items";

  return (
    <div className="card cardPad" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        Seu dia nutricional
      </div>

      <div className="nutritionHeroGrid">
        <div>
          <EnergyProgress totals={totals} target={target} isPlanTarget={isPlanTarget} />
        </div>

        {target && (
          <div className="nutritionHeroGrid__macros" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MacroBar label="Proteína" value={totals.proteinG} target={target.proteinG ?? null} unit="g" />
            <MacroBar label="Carboidratos" value={totals.carbohydrateG} target={target.carbohydrateG ?? null} unit="g" />
            <MacroBar label="Gorduras" value={totals.fatG} target={target.fatG ?? null} unit="g" />
            <FiberRow fiberG={totals.fiberG ?? null} fiberPartial={Boolean(totals.fiberPartial)} />
          </div>
        )}
        {!target && (
          <div className="nutritionHeroGrid__macros" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AbsoluteRow label="Proteína" value={totals.proteinG} unit="g" />
            <AbsoluteRow label="Carboidratos" value={totals.carbohydrateG} unit="g" />
            <AbsoluteRow label="Gorduras" value={totals.fatG} unit="g" />
            <FiberRow fiberG={totals.fiberG ?? null} fiberPartial={Boolean(totals.fiberPartial)} />
          </div>
        )}
      </div>

      {target && (
        <div style={{ marginTop: 16 }}>
          {hasLogs ? (
            <DayEvolutionChart logs={logs} target={target} plannedMeals={plannedMeals} />
          ) : (
            <EmptyState title="Nenhuma refeição registrada ainda." />
          )}
        </div>
      )}

      <MicroInsight logs={logs} target={target} plannedMeals={plannedMeals} coverageLevel={coverage.level} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo principal — Consumido / Meta
// ---------------------------------------------------------------------------

function EnergyProgress({
  totals,
  target,
  isPlanTarget,
}: {
  totals: DayIntakeResponse["totals"];
  target: DayIntakeResponse["target"];
  isPlanTarget: boolean;
}) {
  if (!target) {
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>
          {Math.round(totals.energyKcal)} kcal
        </div>
        <div className="muted" style={{ fontSize: 12 }}>Registrado hoje</div>
      </div>
    );
  }

  const pct = target.energyKcal > 0 ? Math.round((totals.energyKcal / target.energyKcal) * 100) : 0;
  const barPct = Math.min(100, Math.max(0, pct));
  const prefix = isPlanTarget ? "" : "≈ ";

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ marginBottom: 6 }}>
        <span
          className={`badge ${isPlanTarget ? "badge-brand" : "badge-neutral"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {isPlanTarget ? <ClipboardList size={11} /> : <Calculator size={11} />}
          {isPlanTarget ? "Meta do seu plano" : "Estimativa diária"}
        </span>
      </div>
      <div style={{ fontSize: "var(--text-4xl)", fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>
        {prefix}{Math.round(totals.energyKcal)} / {Math.round(target.energyKcal)} kcal
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <div className="progressTrack" style={{ flex: 1 }}>
          <div className="progressFill" style={{ width: `${barPct}%` }} />
        </div>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

function MacroBar({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  if (target == null) return <AbsoluteRow label={label} value={value} unit={unit} />;
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  const barPct = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
        <span style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: COLORS.text, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${barPct}%`, background: "var(--color-border-strong)" }} />
      </div>
    </div>
  );
}

function AbsoluteRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: COLORS.text }}>{Math.round(value)} {unit}</span>
    </div>
  );
}

/**
 * Fibra nunca tem meta (nenhuma fórmula existe no P1A) — só quantidade
 * registrada, e só quando pelo menos um item tinha fibra conhecida
 * (PLAN §11). Nunca um percentual, nunca uma barra contra alvo inventado.
 */
function FiberRow({ fiberG, fiberPartial }: { fiberG: number | null; fiberPartial: boolean }) {
  if (fiberG == null) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span className="muted">Fibra</span>
      <span style={{ fontWeight: 600, color: COLORS.text }}>
        ≈ {Math.round(fiberG)} g
        {fiberPartial && <span className="muted" style={{ fontWeight: 400 }}> · dados parciais</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evolução do dia — planejado × registrado, acumulado
// ---------------------------------------------------------------------------

function buildEvolutionSeries(
  logs: DayIntakeResponse["logs"],
  target: NonNullable<DayIntakeResponse["target"]>,
  plannedMeals: DayIntakeResponse["plannedMeals"]
) {
  const usingPlan = plannedMeals.length > 0;
  const slotCount = usingPlan ? plannedMeals.length : Math.max(target.mealsPerDay, 1);

  const slotLabel = (i: number) => (usingPlan ? plannedMeals[i].name : `Refeição ${i + 1}`);
  const plannedKcalPerSlot = usingPlan ? plannedMeals.map((m) => m.energyKcal) : Array(slotCount).fill(target.energyKcal / slotCount);

  let plannedAcc = 0;
  const rows: Array<{ slot: string; planejado: number | null; registrado: number | null }> = [];
  for (let i = 0; i < slotCount; i++) {
    plannedAcc += plannedKcalPerSlot[i];
    rows.push({ slot: slotLabel(i), planejado: Math.round(plannedAcc), registrado: null });
  }

  // Registrado: acumulado dos logs realmente confirmados hoje, ordenados por
  // horário — NUNCA presumido a partir de uma refeição prevista (PLAN §7).
  const orderedLogs = [...logs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
  let registradoAcc = 0;
  orderedLogs.forEach((log, i) => {
    registradoAcc += log.energyKcal;
    if (i < rows.length) {
      rows[i].registrado = Math.round(registradoAcc);
    } else {
      rows.push({ slot: `Registro ${i + 1}`, planejado: null, registrado: Math.round(registradoAcc) });
    }
  });

  return { rows, usingPlan };
}

function DayEvolutionChart({
  logs,
  target,
  plannedMeals,
}: {
  logs: DayIntakeResponse["logs"];
  target: NonNullable<DayIntakeResponse["target"]>;
  plannedMeals: DayIntakeResponse["plannedMeals"];
}) {
  const { rows, usingPlan } = buildEvolutionSeries(logs, target, plannedMeals);

  return (
    <div>
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        Evolução do dia
      </div>
      {!usingPlan && (
        <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
          Distribuição orientativa — não é um plano alimentar.
        </div>
      )}
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="slot" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
            <YAxis width={36} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value, name) => [`${value} kcal`, name === "planejado" ? "Planejado" : "Registrado"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line type="monotone" dataKey="planejado" name="planejado" stroke="var(--color-text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="registrado" name="registrado" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro-insight
// ---------------------------------------------------------------------------

function MicroInsight({
  logs,
  target,
  plannedMeals,
  coverageLevel,
}: {
  logs: DayIntakeResponse["logs"];
  target: DayIntakeResponse["target"];
  plannedMeals: DayIntakeResponse["plannedMeals"];
  coverageLevel: DayIntakeResponse["coverage"]["level"];
}) {
  if (logs.length === 0) return null;

  const expected = plannedMeals.length > 0 ? plannedMeals.length : target?.mealsPerDay ?? null;
  let text: string;
  if (expected != null) {
    text = `Você registrou ${logs.length} de ${expected} refeições previstas hoje.`;
    if (coverageLevel === "high") {
      text += " Registros próximos do planejado até aqui.";
    }
  } else {
    text = `Você registrou ${logs.length} ${logs.length === 1 ? "refeição" : "refeições"} hoje.`;
  }

  return (
    <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
      {text}
    </div>
  );
}
