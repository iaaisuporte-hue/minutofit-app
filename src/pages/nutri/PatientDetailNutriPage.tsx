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
  OBJECTIVE_LABELS,
  type NutriObjective,
  type NutritionPlan,
  type NutritionObservation,
  type Adherence,
  type MealCheckinStatus,
  type MealHeatmapData,
  type PatientMetabolism,
  type PatientDailyCheckin,
} from "../../services/nutriApi";

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
  meals: Array<{ name: string; orientation: string; order_index: number }>;
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
      meals: plan.meals?.map((m) => ({ name: m.name, orientation: m.orientation, order_index: m.order_index })) ?? [],
    });
    setEditing(true);
  }

  function updateMeal(idx: number, field: "name" | "orientation", value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m, i) => i === idx ? { ...m, [field]: value } : m);
      return { ...prev, meals };
    });
  }

  function addMeal() {
    setDraft((prev) => {
      if (!prev || prev.meals.length >= 6) return prev;
      return { ...prev, meals: [...prev.meals, { name: "", orientation: "", order_index: prev.meals.length }] };
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
      await updateNutritionPlan(patientId, data.active.id, draft);
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
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, marginBottom: 12 }}>Editar plano</div>

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

          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 10 }}>Refeições</div>
          {draft.meals.map((m, i) => (
            <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="Nome da refeição" value={m.name} onChange={(e) => updateMeal(i, "name", e.target.value)} style={{ flex: 1 }} />
                {draft.meals.length > 1 && (
                  <button type="button" onClick={() => removeMeal(i)} style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>×</button>
                )}
              </div>
              <textarea className="input" rows={2} placeholder="Orientações" value={m.orientation} onChange={(e) => updateMeal(i, "orientation", e.target.value)} style={{ resize: "vertical" }} />
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
// Tab: Adesão — meal × day heatmap
// ---------------------------------------------------------------------------

const HEATMAP_COLORS: Record<MealCheckinStatus | "none", string> = {
  done:        "var(--color-success, #22C55E)",
  partial:     "var(--color-warn, #F59E0B)",
  substituted: "var(--color-primary)",
  delayed:     "var(--color-warn, #F59E0B)",
  skipped:     "var(--color-danger, #EF4444)",
  none:        "var(--color-border)",
};

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
  const DAYS = 14;
  const [heatmap, setHeatmap] = useState<MealHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMealHeatmap(patientId, DAYS)
      .then(setHeatmap)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;

  // Fallback to legacy adherence if no meal checkins schema yet
  if (!heatmap?.plan || heatmap.meals.length === 0) {
    return <LegacyAdherenceTab patientId={patientId} />;
  }

  const dates = buildDateRange(DAYS);
  const checkinMap = new Map<string, MealCheckinStatus>();
  for (const c of heatmap.checkins) {
    checkinMap.set(`${c.meal_id}:${c.check_date}`, c.status);
  }

  // Summary stats
  const total = heatmap.meals.length * dates.length;
  const doneCount = heatmap.checkins.filter(
    (c) => c.status === "done" || c.status === "substituted"
  ).length;
  const partialCount = heatmap.checkins.filter((c) => c.status === "partial").length;
  const adherePct = Math.round(((doneCount + partialCount * 0.5) / total) * 100);

  return (
    <div>
      {/* Summary */}
      <div className="card cardPad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: COLORS.primary, lineHeight: 1 }}>
            {adherePct}%
          </span>
          <span style={{ fontSize: 13, color: COLORS.muted }}>
            adesão · últimos {DAYS} dias · {heatmap.meals.length} refeições
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 99,
            background: "var(--color-surface-raised)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${adherePct}%`,
              background:
                adherePct >= 70
                  ? "var(--color-success, #22C55E)"
                  : adherePct >= 40
                  ? "var(--color-warn, #F59E0B)"
                  : COLORS.danger,
              borderRadius: 99,
              transition: "width 0.4s",
            }}
          />
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="card cardPad" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 480 }}>
          {/* Date header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `120px repeat(${dates.length}, 1fr)`,
              gap: 2,
              marginBottom: 4,
            }}
          >
            <div />
            {dates.map((d) => (
              <div
                key={d}
                style={{
                  fontSize: 9,
                  color: COLORS.muted,
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                {new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </div>
            ))}
          </div>

          {/* Meal rows */}
          {heatmap.meals.map((meal) => (
            <div
              key={meal.id}
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${dates.length}, 1fr)`,
                gap: 2,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: COLORS.text,
                  alignSelf: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingRight: 8,
                }}
                title={meal.meal_time ? `${meal.name} · ${meal.meal_time.slice(0, 5)}` : meal.name}
              >
                {meal.name}
                {meal.meal_time && (
                  <span style={{ fontWeight: 400, color: COLORS.muted, marginLeft: 4 }}>
                    {meal.meal_time.slice(0, 5)}
                  </span>
                )}
              </div>
              {dates.map((d) => {
                const status = checkinMap.get(`${meal.id}:${d}`) ?? "none";
                const isToday = d === new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={d}
                    title={`${meal.name} · ${d} · ${status}`}
                    style={{
                      height: 24,
                      borderRadius: 4,
                      background: HEATMAP_COLORS[status],
                      opacity: status === "none" ? 0.3 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#fff",
                      fontWeight: 700,
                      outline: isToday ? `2px solid ${COLORS.primary}` : "none",
                    }}
                  >
                    {HEATMAP_ABBR[status]}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 12,
            fontSize: 11,
            color: COLORS.muted,
          }}
        >
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
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: HEATMAP_COLORS[s],
                  opacity: s === "none" ? 0.3 : 1,
                }}
              />
              {l}
            </span>
          ))}
        </div>
      </div>
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
              const dateLabel = new Date(c.check_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
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
// Main page
// ---------------------------------------------------------------------------

type TabName = "Plano" | "Adesão" | "Contexto" | "Observações";
const TABS: TabName[] = ["Plano", "Adesão", "Contexto", "Observações"];

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
      {tab === "Adesão" && <AdherenceTab patientId={id} />}
      {tab === "Contexto" && <ContextTab patientId={id} />}
      {tab === "Observações" && <ObservationsTab patientId={id} />}
    </div>
  );
}
