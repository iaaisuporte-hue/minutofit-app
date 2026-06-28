import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS } from "../../styles/colors";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  fetchPatientPlans,
  fetchAdherence,
  fetchPatientContext,
  fetchObservations,
  fetchMealHeatmap,
  createObservation,
  endNutritionPlan,
  updateNutritionPlan,
  publishVoiceNote,
  listVoiceNotes,
  fetchPatientInsights,
  fetchPatientEvolution,
  OBJECTIVE_LABELS,
  type NutriObjective,
  type NutritionPlan,
  type NutritionObservation,
  type Adherence,
  type MealCheckinStatus,
  type MealHeatmapData,
  type PatientMetabolism,
  type PatientDailyCheckin,
  type VoiceNote,
  type NutriInsight,
} from "../../services/nutriApi";
import { MetabolicEvolutionView, type MetabolicEvolutionPayload } from "../../features/metabolicCheckin";
import ClinicalProfileTab from "./ClinicalProfileTab";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("pt-BR");
}

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: string[];
  active: string;
  onSelect: (t: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1.5px solid var(--color-border)",
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          style={{
            background: "none",
            border: "none",
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: active === t ? 700 : 500,
            color: active === t ? COLORS.primary : COLORS.muted,
            cursor: "pointer",
            borderBottom: active === t ? `2px solid ${COLORS.primary}` : "2px solid transparent",
            marginBottom: -1.5,
            transition: "color 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Plano
// ---------------------------------------------------------------------------

type EditDraft = {
  title: string;
  objective: NutriObjective;
  general_notes: string;
  meals: Array<{ name: string; orientation: string; meal_time: string; order_index: number }>;
};

function PlanTab({ patientId }: { patientId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ active: NutritionPlan | null; history: NutritionPlan[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    fetchPatientPlans(patientId)
      .then((d) => setData(d as { active: NutritionPlan | null; history: NutritionPlan[] }))
      .finally(() => setLoading(false));
  }, [patientId]);

  function openEdit(plan: NutritionPlan) {
    setDraft({
      title: plan.title,
      objective: plan.objective,
      general_notes: plan.general_notes ?? "",
      meals: plan.meals?.map((m) => ({ name: m.name, orientation: m.orientation, meal_time: m.meal_time ?? '', order_index: m.order_index })) ?? [],
    });
    setEditing(true);
  }

  function updateMeal(idx: number, field: "name" | "orientation" | "meal_time", value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m, i) => i === idx ? { ...m, [field]: value } : m);
      return { ...prev, meals };
    });
  }

  function addMeal() {
    setDraft((prev) => {
      if (!prev || prev.meals.length >= 6) return prev;
      return { ...prev, meals: [...prev.meals, { name: "", orientation: "", meal_time: "", order_index: prev.meals.length }] };
    });
  }

  function removeMeal(idx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, meals: prev.meals.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order_index: i })) };
    });
  }

  async function handleSaveEdit() {
    if (!draft || !data?.active) return;
    if (!draft.title.trim()) return;
    if (draft.meals.length === 0 || draft.meals.some((m) => !m.name.trim() || !m.orientation.trim())) return;
    setSaving(true);
    try {
      await updateNutritionPlan(patientId, data.active.id, {
        ...draft,
        meals: draft.meals.map((m) => ({ ...m, meal_time: m.meal_time || null })),
      });
      const refreshed = await fetchPatientPlans(patientId);
      setData(refreshed as { active: NutritionPlan | null; history: NutritionPlan[] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleEndPlan() {
    if (!data?.active) return;
    setEnding(true);
    try {
      await endNutritionPlan(patientId, data.active.id);
      const refreshed = await fetchPatientPlans(patientId);
      setData(refreshed as { active: NutritionPlan | null; history: NutritionPlan[] });
    } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  }

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;

  const { active, history } = data ?? { active: null, history: [] };

  // ── Edit mode ──────────────────────────────────────────────────
  if (editing && draft && active) {
    const objectives: NutriObjective[] = ["weight_loss", "muscle_gain", "metabolic_health", "performance", "maintenance"];
    const canSave = draft.title.trim() && draft.meals.length > 0 && draft.meals.every((m) => m.name.trim() && m.orientation.trim());
    return (
      <div>
        <div className="card cardPad" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>Editar plano</div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="edit-title">Título</label>
            <input id="edit-title" className="input" value={draft.title} onChange={(e) => setDraft((p) => p ? { ...p, title: e.target.value } : p)} />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="edit-objective">Objetivo</label>
            <select id="edit-objective" className="input" value={draft.objective} onChange={(e) => setDraft((p) => p ? { ...p, objective: e.target.value as NutriObjective } : p)}>
              {objectives.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="edit-notes">Orientações gerais</label>
            <textarea id="edit-notes" className="input" rows={3} style={{ resize: "vertical" }} value={draft.general_notes} onChange={(e) => setDraft((p) => p ? { ...p, general_notes: e.target.value } : p)} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Refeições</div>
          {draft.meals.map((m, i) => (
            <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, background: "var(--color-surface)" }}>
              {/* Nome + horário + remover */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder={`Refeição ${i + 1} · nome`}
                  value={m.name}
                  onChange={(e) => updateMeal(i, "name", e.target.value)}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Horário
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={m.meal_time}
                    onChange={(e) => updateMeal(i, "meal_time", e.target.value)}
                    style={{ width: 110 }}
                    title="Horário ideal da refeição"
                  />
                </div>
                {draft.meals.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeMeal(i)}
                    style={{ background: "none", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", color: COLORS.danger, cursor: "pointer", fontSize: 16, lineHeight: 1, alignSelf: "flex-end" }}
                    aria-label="Remover refeição"
                  >
                    ×
                  </button>
                ) : (
                  <div style={{ width: 38 }} />
                )}
              </div>
              <textarea
                className="input"
                rows={2}
                placeholder="Orientações para esta refeição..."
                value={m.orientation}
                onChange={(e) => updateMeal(i, "orientation", e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          ))}
          {draft.meals.length < 6 && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={addMeal}>+ Refeição</button>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={!canSave || saving} onClick={() => void handleSaveEdit()}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ConfirmDialog
        open={confirmEnd}
        title="Encerrar plano alimentar?"
        message="O aluno perderá acesso ao plano ativo imediatamente. Esta ação não pode ser desfeita."
        confirmLabel={ending ? "Encerrando..." : "Encerrar plano"}
        danger
        onConfirm={() => void handleEndPlan()}
        onCancel={() => setConfirmEnd(false)}
      />
      {active ? (
        <div>
          <div className="card cardPad" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Plano ativo
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{active.title}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
              {OBJECTIVE_LABELS[active.objective]} · Desde {formatDate(active.started_at)}
            </div>

            {active.general_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>Orientações gerais</div>
                <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>{active.general_notes}</div>
              </div>
            )}

            {active.meals?.map((m) => (
              <div key={m.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>{m.orientation}</div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(active)}>Editar plano</button>
              <button
                type="button"
                onClick={() => navigate(
                  `/app/nutri/pacientes/${patientId}/plano/novo`,
                  { state: { duplicateFrom: active } }
                )}
                className="btn btn-ghost btn-sm"
              >
                Duplicar
              </button>
              <button
                type="button"
                onClick={() => navigate(`/app/nutri/pacientes/${patientId}/plano/novo`)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: `1.5px solid ${COLORS.primary}`,
                  background: "none",
                  color: COLORS.primary,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Criar plano
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: `1.5px solid ${COLORS.danger}`,
                  background: "none",
                  color: COLORS.danger,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Encerrar plano
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, marginBottom: 10 }}>
                Planos anteriores ({history.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="card cardPad"
                    style={{ padding: "10px 14px", fontSize: 13, color: COLORS.muted }}
                  >
                    <span style={{ color: COLORS.text, fontWeight: 600 }}>{h.title}</span>{" "}
                    ({formatDate(h.started_at)} – {h.ended_at ? formatDate(h.ended_at) : "em andamento"})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 15, color: COLORS.muted, marginBottom: 16 }}>Nenhum plano alimentar ativo.</div>
          <button
            type="button"
            onClick={() => navigate(`/app/nutri/pacientes/${patientId}/plano/novo`)}
            style={{
              padding: "11px 24px",
              borderRadius: 10,
              border: "none",
              background: COLORS.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Criar plano alimentar
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Adesão — meal × day heatmap + intelligence layer
// ---------------------------------------------------------------------------

const HEATMAP_COLORS: Record<MealCheckinStatus | "none", string> = {
  done:        "var(--color-success, #22C55E)",
  partial:     "var(--color-warn, #F59E0B)",
  substituted: "var(--color-primary)",
  delayed:     "var(--color-warn, #F59E0B)",
  skipped:     "var(--color-danger, #EF4444)",
  none:        "var(--color-border)",
};

// Computes intelligence metrics from local heatmap data (no extra API call)
function computeAdherenceIntel(
  checkins: MealHeatmapData["checkins"],
  meals: MealHeatmapData["meals"],
  dates: string[],
) {
  const map = new Map<string, MealCheckinStatus>();
  for (const c of checkins) map.set(`${c.meal_id}:${c.check_date}`, c.status);

  function mealPct(mealId: number, window: string[]): number {
    const done = window.filter((d) => {
      const s = map.get(`${mealId}:${d}`);
      return s === "done" || s === "substituted";
    }).length;
    const partial = window.filter((d) => map.get(`${mealId}:${d}`) === "partial").length;
    return window.length > 0 ? Math.round(((done + partial * 0.5) / window.length) * 100) : 0;
  }

  function dayHasCheckin(date: string): boolean {
    return meals.some((m) => {
      const s = map.get(`${m.id}:${date}`);
      return !!s && s !== "skipped";
    });
  }

  // Overall per-meal adherence
  const mealStats = meals.map((m) => ({ meal: m, pct: mealPct(m.id, dates) }));
  const weakest = [...mealStats].sort((a, b) => a.pct - b.pct)[0] ?? null;

  // Trend: last 7d vs first 7d (requires ≥7 days window)
  let trend: "up" | "down" | "stable" | null = null;
  if (dates.length >= 7) {
    const first7 = dates.slice(0, Math.floor(dates.length / 2));
    const last7  = dates.slice(Math.floor(dates.length / 2));
    const avgFirst = meals.length > 0
      ? Math.round(mealStats.reduce((s, ms) => s + mealPct(ms.meal.id, first7), 0) / meals.length)
      : 0;
    const avgLast = meals.length > 0
      ? Math.round(mealStats.reduce((s, ms) => s + mealPct(ms.meal.id, last7), 0) / meals.length)
      : 0;
    const delta = avgLast - avgFirst;
    trend = delta >= 15 ? "up" : delta <= -15 ? "down" : "stable";
  }

  // Current streak (consecutive days ending today with ≥1 non-skip check-in)
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dayHasCheckin(dates[i])) streak++;
    else break;
  }

  // Worst day of week (day with most skips/nulls, requires ≥2 occurrences)
  const skipsByDow: Record<number, number> = {};
  const countsByDow: Record<number, number> = {};
  for (const d of dates) {
    const dow = new Date(d + "T12:00").getDay();
    countsByDow[dow] = (countsByDow[dow] ?? 0) + 1;
    const skips = meals.filter((m) => {
      const s = map.get(`${m.id}:${d}`);
      return !s || s === "skipped";
    }).length;
    skipsByDow[dow] = (skipsByDow[dow] ?? 0) + skips;
  }
  const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  let worstDow: string | null = null;
  let worstRate = 0;
  for (const [dow, skips] of Object.entries(skipsByDow)) {
    const cnt = countsByDow[Number(dow)] ?? 0;
    const rate = cnt >= 2 ? skips / (cnt * meals.length) : 0;
    if (rate > worstRate && rate >= 0.6) { worstRate = rate; worstDow = DOW_LABELS[Number(dow)]; }
  }

  return { mealStats, weakest, trend, streak, worstDow };
}

function AdherenceNarrative({ pct }: { pct: number }) {
  const cfg =
    pct >= 80 ? { label: "Constância excelente", color: "var(--color-success,#22C55E)" }
    : pct >= 60 ? { label: "Boa constância",       color: "var(--color-success,#22C55E)" }
    : pct >= 40 ? { label: "Constância moderada",  color: "var(--color-warn,#F59E0B)" }
    : pct >= 20 ? { label: "Constância baixa",     color: "var(--color-warn,#F59E0B)" }
    :             { label: "Adesão muito baixa",    color: "var(--color-danger,#EF4444)" };
  return (
    <span style={{ fontSize: 14, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
  );
}

const HEATMAP_ABBR: Record<MealCheckinStatus | "none", string> = {
  done:        "✓",
  partial:     "~",
  substituted: "S",
  delayed:     "A",
  skipped:     "–",
  none:        "·",
};

function buildDateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function AdherenceTab({ patientId }: { patientId: number }) {
  const [heatmap, setHeatmap] = useState<MealHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Always fetch 14 days — display window narrows on mobile without extra requests
  useEffect(() => {
    fetchMealHeatmap(patientId, 14)
      .then(setHeatmap)
      .finally(() => setLoading(false));
  }, [patientId]);

  const DAYS = isMobile ? 7 : 14;

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;

  // Fallback to legacy adherence if no meal checkins schema yet
  if (!heatmap?.plan || heatmap.meals.length === 0) {
    return <LegacyAdherenceTab patientId={patientId} />;
  }

  const dates = buildDateRange(DAYS);
  const checkinMap = new Map<string, MealCheckinStatus>();
  for (const c of heatmap.checkins) {
    const dateKey = String(c.check_date).slice(0, 10);
    checkinMap.set(`${c.meal_id}:${dateKey}`, c.status);
  }

  // Summary stats
  const total = heatmap.meals.length * dates.length;
  const doneCount = heatmap.checkins.filter(
    (c) => c.status === "done" || c.status === "substituted"
  ).length;
  const partialCount = heatmap.checkins.filter((c) => c.status === "partial").length;
  const adherePct = Math.round(((doneCount + partialCount * 0.5) / total) * 100);

  const intel = computeAdherenceIntel(heatmap.checkins, heatmap.meals, dates);

  const TREND_LABEL: Record<"up" | "down" | "stable", { icon: string; text: string; color: string }> = {
    up:     { icon: "↑", text: "Melhorando",     color: "var(--color-success,#22C55E)" },
    down:   { icon: "↓", text: "Em queda",       color: "var(--color-danger,#EF4444)" },
    stable: { icon: "→", text: "Estável",         color: "var(--color-text-muted)" },
  };

  const barColor =
    adherePct >= 70 ? "var(--color-success,#22C55E)"
    : adherePct >= 40 ? "var(--color-warn,#F59E0B)"
    : "var(--color-danger,#EF4444)";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── Intelligence summary card ── */}
      <div className="card cardPad">
        {/* Header row: % + narrative + trend */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: barColor, lineHeight: 1 }}>
              {adherePct}%
            </span>
            <AdherenceNarrative pct={adherePct} />
          </div>
          {intel.trend && (
            <span style={{
              fontSize: 12, fontWeight: 700, color: TREND_LABEL[intel.trend].color,
              background: `color-mix(in srgb, ${TREND_LABEL[intel.trend].color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${TREND_LABEL[intel.trend].color} 30%, transparent)`,
              borderRadius: 20, padding: "3px 10px",
              display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
            }}>
              {TREND_LABEL[intel.trend].icon} {TREND_LABEL[intel.trend].text}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 7, borderRadius: 99, background: "var(--color-surface-raised)", overflow: "hidden", marginBottom: 14 }}>
          <div style={{ height: "100%", width: `${adherePct}%`, background: barColor, borderRadius: 99, transition: "width 0.5s" }} />
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sequência atual</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: intel.streak > 0 ? "var(--color-success,#22C55E)" : COLORS.muted }}>
              {intel.streak} {intel.streak === 1 ? "dia" : "dias"}
            </span>
          </div>
          <div style={{ width: 1, background: "var(--color-border)", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Janela</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{DAYS} dias · {heatmap.meals.length} refeições</span>
          </div>
          {intel.worstDow && (
            <>
              <div style={{ width: 1, background: "var(--color-border)", alignSelf: "stretch" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dia crítico</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-warn,#F59E0B)" }}>{intel.worstDow}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Heatmap grid ── */}
      <div className="card cardPad" style={{ overflowX: isMobile ? "hidden" : "auto" }}>
        {(() => {
          const today = new Date().toISOString().slice(0, 10);
          const COL_NAME = isMobile ? 96 : 128;
          const COL_CELL = isMobile ? 32 : 36;
          const CELL_H   = isMobile ? 26 : 28;
          const cols = `${COL_NAME}px repeat(${dates.length}, ${COL_CELL}px)`;
          const DOW = ["D","S","T","Q","Q","S","S"];

          return (
            <div style={{ minWidth: COL_NAME + dates.length * (COL_CELL + 3) }}>
              {/* Date header */}
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 3, marginBottom: 6 }}>
                <div />
                {dates.map((d) => {
                  const isT = d === today;
                  const dt = new Date(d + "T12:00");
                  return (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        padding: "3px 0 4px",
                        borderRadius: 6,
                        background: isT ? `${COLORS.primary}18` : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 600, color: isT ? COLORS.primary : COLORS.muted }}>
                        {DOW[dt.getDay()]}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: isT ? 800 : 500, color: isT ? COLORS.primary : COLORS.muted }}>
                        {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Meal rows */}
              {heatmap.meals.map((meal) => (
                <div
                  key={meal.id}
                  style={{ display: "grid", gridTemplateColumns: cols, gap: 3, marginBottom: 3, alignItems: "center" }}
                >
                  {/* Meal label — 2 lines */}
                  <div style={{ paddingRight: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, lineHeight: 1.3, wordBreak: "break-word" }}>
                      {meal.name}
                    </div>
                    {meal.meal_time && (
                      <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 1 }}>
                        {meal.meal_time.slice(0, 5)}
                      </div>
                    )}
                  </div>

                  {/* Cells */}
                  {dates.map((d) => {
                    const status = checkinMap.get(`${meal.id}:${d}`) ?? "none";
                    const isT = d === today;
                    const hasDatum = status !== "none";

                    return (
                      <div
                        key={d}
                        title={`${meal.name} · ${new Date(d + "T12:00").toLocaleDateString("pt-BR")} · ${status}`}
                        style={{
                          height: CELL_H,
                          borderRadius: 6,
                          background: hasDatum ? HEATMAP_COLORS[status] : isT ? `${COLORS.primary}14` : "var(--color-surface-raised)",
                          border: isT && !hasDatum ? `1.5px dashed ${COLORS.primary}` : hasDatum ? "none" : "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: hasDatum ? "#fff" : isT ? COLORS.primary : "transparent",
                          transition: "transform 0.1s",
                          cursor: "default",
                        }}
                      >
                        {hasDatum ? HEATMAP_ABBR[status] : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)", fontSize: 11, color: COLORS.muted }}>
          {(
            [
              ["done", "Seguiu"],
              ["partial", "Parcial"],
              ["substituted", "Substituiu"],
              ["skipped", "Pulou"],
              ["none", "Sem registro"],
            ] as Array<[MealCheckinStatus | "none", string]>
          ).map(([s, l]) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: HEATMAP_COLORS[s], opacity: s === "none" ? 0.35 : 1, border: s === "none" ? "1px solid var(--color-border)" : "none" }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Meal-level intelligence strip ── */}
      {intel.mealStats.length > 0 && (
        <div className="card cardPad">
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Adesão por refeição
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[...intel.mealStats]
              .sort((a, b) => a.pct - b.pct)
              .map(({ meal, pct }) => {
                const isWeakest = intel.weakest?.meal.id === meal.id;
                const barC = pct >= 70 ? "var(--color-success,#22C55E)" : pct >= 40 ? "var(--color-warn,#F59E0B)" : "var(--color-danger,#EF4444)";
                return (
                  <div key={meal.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: isWeakest ? 700 : 500, color: isWeakest ? COLORS.text : COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
                        {isWeakest && pct < 60 && (
                          <span style={{ fontSize: 10, background: "rgba(239,68,68,.12)", color: "var(--color-danger,#EF4444)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                            atenção
                          </span>
                        )}
                        {meal.name}
                        {meal.meal_time && <span style={{ fontWeight: 400, color: COLORS.muted }}>{meal.meal_time.slice(0, 5)}</span>}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: barC }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "var(--color-surface-raised)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: barC, borderRadius: 99, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
          </div>

          {intel.weakest && intel.weakest.pct < 40 && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)", fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>"{intel.weakest.meal.name}"</span> tem apenas {intel.weakest.pct}% de adesão nos últimos {DAYS} dias.
              {intel.weakest.pct === 0
                ? " Nenhum registro — considere ajustar horário ou orientação."
                : " Considere explorar barreiras ou simplificar esta refeição."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Fallback: legacy daily adherence bar (for patients without granular checkins yet)
function LegacyAdherenceTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{
    plan: { id: number; title: string } | null;
    checkins: Array<{ check_date: string; adherence: Adherence; note: string | null }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdherence(patientId, 7)
      .then(setData)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;
  if (!data?.plan) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Sem plano ativo — nenhum dado de adesão.</div>;

  const fullCount = data.checkins.filter((c) => c.adherence === "full").length;
  const partialCount = data.checkins.filter((c) => c.adherence === "partial").length;
  const adherePct = Math.round(((fullCount + partialCount * 0.5) / 7) * 100);
  const ICON: Record<string, string> = { full: "✓", partial: "─", skipped: "○" };
  const COLOR: Record<string, string> = {
    full: "var(--color-success, #22C55E)",
    partial: "var(--color-warn, #F59E0B)",
    skipped: COLORS.danger,
  };

  return (
    <div className="card cardPad">
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
        Esta semana: {adherePct}% de adesão ({data.checkins.length}/7 dias)
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--color-surface-raised)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${adherePct}%`, background: adherePct >= 70 ? COLORS.primary : adherePct >= 40 ? "var(--color-warn)" : COLORS.danger, borderRadius: 4 }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {data.checkins.map((c) => (
          <div key={c.check_date} style={{ textAlign: "center", minWidth: 44 }}>
            <div style={{ fontSize: 18, color: COLOR[c.adherence] ?? COLORS.muted, lineHeight: 1.3 }}>
              {ICON[c.adherence] ?? "○"}
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>
              {new Date(c.check_date).toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 12 }}>
        Legenda: ✓ Seguiu · ─ Parcial · ○ Não seguiu / sem registro
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Contexto
// ---------------------------------------------------------------------------

const METABOLIC_STATUS_LABEL: Record<PatientMetabolism['status'], string> = {
  high:     'Alto',
  moderate: 'Moderado',
  low:      'Baixo',
};

const METABOLIC_STATUS_COLOR: Record<PatientMetabolism['status'], string> = {
  high:     COLORS.primary,
  moderate: 'var(--color-warn)',
  low:      COLORS.danger,
};

const FEELING_LABEL: Record<NonNullable<PatientDailyCheckin['feeling']>, string> = {
  energized: 'Bem-disposto',
  neutral:   'Neutro',
  tired:     'Cansado',
};

const FEELING_COLOR: Record<NonNullable<PatientDailyCheckin['feeling']>, string> = {
  energized: COLORS.primary,
  neutral:   COLORS.muted,
  tired:     COLORS.danger,
};

function TrendArrow({ direction, delta }: { direction: 'up' | 'down' | 'stable'; delta: number }) {
  if (direction === 'stable') return <span style={{ color: COLORS.muted }}>Estável</span>;
  const up = direction === 'up';
  return (
    <span style={{ color: up ? COLORS.primary : COLORS.danger }}>
      {up ? '↑' : '↓'} {Math.abs(delta)} pts esta semana
    </span>
  );
}

function ContextTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{
    hasMetabolicConsent: boolean;
    hasDailyConsent: boolean;
    metabolism?: PatientMetabolism | null;
    dailyCheckins?: PatientDailyCheckin[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientContext(patientId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;

  const m = data?.metabolism;
  const checkins = data?.dailyCheckins ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Metabolismo ── */}
      <div className="card cardPad">
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>Metabolismo</div>

        {!data?.hasMetabolicConsent ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Paciente ainda não concedeu acesso ao estado metabólico.
          </div>
        ) : !m ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Snapshot metabólico ainda não disponível para este paciente.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Score + status */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: METABOLIC_STATUS_COLOR[m.status], lineHeight: 1 }}>
                {m.score}
              </span>
              <span style={{ fontSize: 13, color: METABOLIC_STATUS_COLOR[m.status], fontWeight: 600 }}>
                Metabólico: {METABOLIC_STATUS_LABEL[m.status]}
              </span>
            </div>

            {/* Tendência 7d */}
            {m.trend7d && (
              <div style={{ fontSize: 13 }}>
                <TrendArrow direction={m.trend7d.direction} delta={m.trend7d.delta} />
              </div>
            )}

            {/* Fatores top 3 */}
            {m.factors && m.factors.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {m.factors.slice(0, 3).map((f, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 20,
                      background: f.impact >= 0 ? COLORS.primarySoft : COLORS.dangerSoft,
                      color: f.impact >= 0 ? COLORS.primary : COLORS.danger,
                      border: `1px solid ${f.impact >= 0 ? COLORS.primaryBorder : COLORS.dangerBorder}`,
                    }}
                  >
                    {f.impact >= 0 ? '+' : '−'} {f.name}
                  </span>
                ))}
              </div>
            )}

            {/* Interpretação IA */}
            {m.interpretation?.hint && (
              <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", lineHeight: 1.5 }}>
                {m.interpretation.hint}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Check-ins de bem-estar ── */}
      <div className="card cardPad">
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
          Check-ins de bem-estar
        </div>

        {!data?.hasDailyConsent ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Paciente ainda não concedeu acesso aos check-ins diários.
          </div>
        ) : checkins.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>Nenhum check-in nos últimos 7 dias.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checkins.map((c) => {
              const dateLabel = new Date(c.check_date.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
              return (
                <div
                  key={c.check_date}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ minWidth: 72, color: COLORS.muted, fontWeight: 600 }}>{dateLabel}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
                    {c.feeling && (
                      <span style={{ color: FEELING_COLOR[c.feeling], fontWeight: 600 }}>
                        {FEELING_LABEL[c.feeling]}
                      </span>
                    )}
                    {c.slept_well === true && (
                      <span style={{ color: COLORS.primary }}>· Dormiu bem</span>
                    )}
                    {c.slept_well === false && (
                      <span style={{ color: 'var(--color-warn)' }}>· Sono ruim</span>
                    )}
                    {c.in_pain === true && (
                      <span style={{ color: COLORS.danger }}>· Com dor</span>
                    )}
                    {c.stressed === true && (
                      <span style={{ color: 'var(--color-warn)' }}>· Estressado</span>
                    )}
                    {!c.feeling && c.slept_well == null && c.in_pain == null && c.stressed == null && (
                      <span style={{ color: COLORS.muted }}>Sem detalhes</span>
                    )}
                    {c.notes && (
                      <span style={{ color: COLORS.muted, display: "block", width: "100%", marginTop: 2 }}>
                        {c.notes.length > 60 ? c.notes.slice(0, 60) + '…' : c.notes}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Observações
// ---------------------------------------------------------------------------

function ObservationsTab({ patientId }: { patientId: number }) {
  const [obs, setObs] = useState<NutritionObservation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const LIMIT = 5;

  useEffect(() => {
    fetchObservations(patientId, LIMIT, offset).then(({ rows, total: t }) => {
      setObs((prev) => offset === 0 ? rows : [...prev, ...rows]);
      setTotal(t);
    });
  }, [patientId, offset]);

  async function handleSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createObservation(patientId, draft.trim());
      setDraft("");
      setOffset(0);
      const refreshed = await fetchObservations(patientId, LIMIT, 0);
      setObs(refreshed.rows);
      setTotal(refreshed.total);
    } catch {
      setSaveError("Não foi possível salvar a observação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Input */}
      <div className="card cardPad" style={{ marginBottom: 20 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Adicionar observação clínica..."
          rows={3}
          style={{
            width: "100%",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            color: COLORS.text,
            background: "var(--color-surface)",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        {saveError && (
          <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{saveError}</div>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !draft.trim()}
          style={{
            marginTop: 10,
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            background: COLORS.primary,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: saving || !draft.trim() ? "not-allowed" : "pointer",
            opacity: saving || !draft.trim() ? 0.6 : 1,
          }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {obs.map((o) => (
          <div key={o.id} className="card cardPad" style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
              {new Date(o.created_at).toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {o.body}
            </div>
          </div>
        ))}
      </div>

      {obs.length < total && (
        <button
          type="button"
          onClick={() => setOffset((prev) => prev + LIMIT)}
          style={{
            marginTop: 14,
            background: "none",
            border: "none",
            color: COLORS.primary,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Ver mais {total - obs.length} observações
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Insights (Spec 005)
// ---------------------------------------------------------------------------

const INSIGHT_ICON: Record<NutriInsight['type'], string> = {
  adherence_drop: '↓',
  late_hunger: '~',
  ghost_meal: '○',
  silent_absence: '!',
};

const INSIGHT_COLOR: Record<NutriInsight['type'], string> = {
  adherence_drop: 'var(--color-danger,#EF4444)',
  late_hunger: 'var(--color-warn,#f59e0b)',
  ghost_meal: 'var(--color-warn,#f59e0b)',
  silent_absence: 'var(--color-danger,#EF4444)',
};

function InsightsTab({ patientId }: { patientId: number }) {
  const [insights, setInsights] = useState<NutriInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPatientInsights(patientId)
      .then(setInsights)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return <div style={{ fontSize: 14, color: COLORS.muted }}>Calculando insights...</div>;
  }

  if (insights.length === 0) {
    return (
      <div className="card cardPad" style={{ fontSize: 14, color: COLORS.muted }}>
        Nenhum sinal de alerta detectado nos últimos 7 dias. Paciente em rota estável.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {insights.map((ins, i) => (
        <div
          key={i}
          className="card cardPad"
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            borderLeft: `3px solid ${INSIGHT_COLOR[ins.type]}`,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: INSIGHT_COLOR[ins.type],
              lineHeight: 1,
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {INSIGHT_ICON[ins.type]}
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
              {ins.label}
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
              {ins.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Voz (Spec 005)
// ---------------------------------------------------------------------------

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function VozTab({ patientId }: { patientId: number }) {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const MAX = 240;

  const reload = () => {
    setLoading(true);
    listVoiceNotes(patientId)
      .then(setNotes)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [patientId]);

  async function handlePublish() {
    const text = draft.trim().slice(0, MAX);
    if (!text || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await publishVoiceNote(patientId, text);
      setDraft('');
      reload();
    } catch {
      setSaveError('Não foi possível publicar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Composer */}
      <div className="card cardPad" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Nova nota para o paciente
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          placeholder="Escreva uma orientação ou observação visível ao paciente... (máx. 240 caracteres)"
          rows={3}
          style={{
            width: '100%',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 14,
            color: COLORS.text,
            background: 'var(--color-surface)',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            {draft.length}/{MAX}
          </span>
          {saveError && (
            <span style={{ fontSize: 12, color: 'var(--color-danger,#EF4444)' }}>{saveError}</span>
          )}
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={saving || draft.trim().length === 0}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
              opacity: saving || draft.trim().length === 0 ? 0.6 : 1,
            }}
          >
            {saving ? 'Publicando...' : 'Publicar para paciente'}
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Notas publicadas
      </div>
      {loading ? (
        <div style={{ fontSize: 14, color: COLORS.muted }}>Carregando...</div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: 14, color: COLORS.muted }}>Nenhuma nota publicada ainda.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notes.map((n) => (
            <div
              key={n.id}
              className="card cardPad"
              style={{ display: 'grid', gap: 6 }}
            >
              <p style={{ margin: 0, fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>
                "{n.body}"
              </p>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: COLORS.muted }}>
                <span>{formatDateShort(n.publishedAt)}</span>
                {n.readAt ? (
                  <span style={{ color: 'var(--color-success,#22C55E)' }}>
                    Lida em {formatDateShort(n.readAt)}
                  </span>
                ) : (
                  <span>Não lida</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evolução tab (Spec 014) — read-only, consent-gated
// ---------------------------------------------------------------------------

function EvolucaoTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<MetabolicEvolutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPatientEvolution(patientId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message === "consent_required"
          ? "O paciente ainda não compartilhou os dados de evolução com você."
          : (e?.message || "Não foi possível carregar a evolução."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) return <p className="metabolic-section-copy" style={{ padding: "8px 0" }}>Carregando evolução...</p>;
  if (error) return <p className="metabolic-section-copy" style={{ padding: "8px 0" }}>{error}</p>;
  if (!data) return <p className="metabolic-section-copy" style={{ padding: "8px 0" }}>Sem dados de evolução.</p>;

  return (
    <div style={{ paddingTop: 8 }}>
      <MetabolicEvolutionView records={data.checkins} stats={data.workoutStats} workoutsShared={data.scopes.workouts} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type TabName = "Plano" | "Perfil" | "Adesão" | "Contexto" | "Evolução" | "Observações" | "Insights" | "Voz";
const TABS: TabName[] = ["Plano", "Perfil", "Adesão", "Contexto", "Evolução", "Observações", "Insights", "Voz"];

export default function PatientDetailNutriPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabName>("Plano");

  const id = Number(patientId);
  if (!Number.isFinite(id)) return null;

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navigate("..", { relative: "path" })}
          style={{
            background: "none",
            border: "none",
            color: COLORS.muted,
            cursor: "pointer",
            fontSize: 20,
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Voltar"
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>
          Paciente #{id}
        </h1>
      </div>

      <TabBar tabs={TABS} active={tab} onSelect={(t) => setTab(t as TabName)} />

      {tab === "Plano" && <PlanTab patientId={id} />}
      {tab === "Perfil" && <ClinicalProfileTab patientId={id} />}
      {tab === "Adesão" && <AdherenceTab patientId={id} />}
      {tab === "Contexto" && <ContextTab patientId={id} />}
      {tab === "Evolução" && <EvolucaoTab patientId={id} />}
      {tab === "Observações" && <ObservationsTab patientId={id} />}
      {tab === "Insights" && <InsightsTab patientId={id} />}
      {tab === "Voz" && <VozTab patientId={id} />}
    </div>
  );
}
