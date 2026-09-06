import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import {
  fetchPatientPlans,
  endNutritionPlan,
  updateNutritionPlan,
  checkDietAgainstProfile,
  OBJECTIVE_LABELS,
  type NutriObjective,
  type NutritionPlan,
  type DietAlert,
  NutriApiError,
} from "../../../services/nutriApi";
import { ConsentRevokedNotice, formatDate, ALERT_KIND_LABEL, ALERT_LEVEL_CLASS, type EditDraft, type EditDraftMeal } from "./shared";

export function PlanTab({ patientId }: { patientId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ active: NutritionPlan | null; history: NutritionPlan[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [editAlerts, setEditAlerts] = useState<DietAlert[]>([]);
  const [editAck, setEditAck] = useState(false);
  const [consentRevoked, setConsentRevoked] = useState(false);

  useEffect(() => {
    setConsentRevoked(false);
    fetchPatientPlans(patientId)
      .then((d) => setData(d as { active: NutritionPlan | null; history: NutritionPlan[] }))
      .catch((err) => {
        if (err instanceof NutriApiError && err.consentRevoked) setConsentRevoked(true);
        setData({ active: null, history: [] });
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  function openEdit(plan: NutritionPlan) {
    setDraft({
      title: plan.title,
      objective: plan.objective,
      general_notes: plan.general_notes ?? "",
      meals: plan.meals?.map((m) => ({
        id: m.id,
        name: m.name,
        orientation: m.orientation,
        meal_time: m.meal_time ?? "",
        order_index: m.order_index,
        tolerance_minutes: m.tolerance_minutes,
        reminder_minutes: m.reminder_minutes,
        metabolic_goal: m.metabolic_goal,
        workout_relation: m.workout_relation,
        hydration_note: m.hydration_note,
        supplement_note: m.supplement_note,
        alternatives: m.alternatives?.map((a) => ({ id: a.id, description: a.description, order_index: a.order_index })) ?? [],
        // SPEC 038: ecoa os itens estruturados existentes — esta tela ainda
        // não permite adicionar/remover alimento (isso é o builder), mas
        // precisa preservar o que já existe a cada PATCH.
        items: (m.items ?? []).map((it) => ({
          id: it.id,
          foodId: it.foodId ?? undefined,
          customFoodId: it.customFoodId ?? undefined,
          quantity: it.quantity,
          unitType: it.unitType,
          measureId: it.measureId ?? undefined,
          customMeasureId: it.customMeasureId ?? undefined,
          orderIndex: it.orderIndex,
        })),
      })) ?? [],
    });
    setEditing(true);
  }

  function updateMeal(idx: number, field: "name" | "orientation" | "meal_time", value: string) {
    if (editAck) { setEditAck(false); setEditAlerts([]); } // editou → re-checa no próximo salvar
    setDraft((prev) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m, i) => (i === idx ? { ...m, [field]: value } : m));
      return { ...prev, meals };
    });
  }

  function addMeal() {
    if (editAck) { setEditAck(false); setEditAlerts([]); }
    setDraft((prev) => {
      if (!prev || prev.meals.length >= 6) return prev;
      const novaRefeicao: EditDraftMeal = {
        name: "", orientation: "", meal_time: "", order_index: prev.meals.length,
        tolerance_minutes: null, reminder_minutes: null, metabolic_goal: null,
        workout_relation: null, hydration_note: null, supplement_note: null, alternatives: [],
        items: [],
      };
      return { ...prev, meals: [...prev.meals, novaRefeicao] };
    });
  }

  function removeMeal(idx: number) {
    if (editAck) { setEditAck(false); setEditAlerts([]); }
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
      // Fecha o loop: checa a dieta editada contra o perfil clínico antes de salvar.
      // Item incompatível exige confirmação consciente; falha na checagem não bloqueia.
      if (!editAck) {
        try {
          const found = await checkDietAgainstProfile(
            patientId,
            draft.meals.map((m) => ({ name: m.name, orientation: m.orientation })),
          );
          if (found.length > 0) {
            setEditAlerts(found);
            setEditAck(true);
            setSaving(false);
            return;
          }
        } catch { /* checagem indisponível — segue salvamento */ }
      }
      await updateNutritionPlan(patientId, data.active.id, {
        ...draft,
        meals: draft.meals.map((m) => ({ ...m, meal_time: m.meal_time || null })),
      });
      const refreshed = await fetchPatientPlans(patientId);
      setData(refreshed as { active: NutritionPlan | null; history: NutritionPlan[] });
      setEditing(false);
      setEditAlerts([]);
      setEditAck(false);
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

  if (loading) return <SkeletonPanelCard />;
  if (consentRevoked) return <ConsentRevokedNotice />;

  const { active, history } = data ?? { active: null, history: [] };

  // ── Edit mode ──────────────────────────────────────────────────
  if (editing && draft && active) {
    const objectives: NutriObjective[] = ["weight_loss", "muscle_gain", "metabolic_health", "performance", "maintenance"];
    const canSave = draft.title.trim() && draft.meals.length > 0 && draft.meals.every((m) => m.name.trim() && m.orientation.trim());
    return (
      <div className="card cardPad">
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, margin: "0 0 var(--space-3)" }}>Editar plano</h2>

        <div className="field" style={{ marginBottom: "var(--space-3)" }}>
          <label className="label" htmlFor="edit-title">Título</label>
          <input id="edit-title" className="input" value={draft.title} onChange={(e) => setDraft((p) => (p ? { ...p, title: e.target.value } : p))} />
        </div>

        <div className="field" style={{ marginBottom: "var(--space-3)" }}>
          <label className="label" htmlFor="edit-objective">Objetivo</label>
          <select id="edit-objective" className="input" value={draft.objective} onChange={(e) => setDraft((p) => (p ? { ...p, objective: e.target.value as NutriObjective } : p))}>
            {objectives.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
          </select>
        </div>

        <div className="field" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label" htmlFor="edit-notes">Orientações gerais</label>
          <textarea id="edit-notes" className="input" rows={3} style={{ resize: "vertical" }} value={draft.general_notes} onChange={(e) => setDraft((p) => (p ? { ...p, general_notes: e.target.value } : p))} />
        </div>

        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Refeições
        </div>
        <div className="stack" style={{ gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {draft.meals.map((m, i) => (
            <div key={m.id ?? `new-${i}`} className="card cardPad" style={{ background: "var(--color-surface-raised)" }}>
              {/* Nome + horário + remover */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <input
                  className="input"
                  aria-label={`Nome da refeição ${i + 1}`}
                  placeholder={`Refeição ${i + 1} · nome`}
                  value={m.name}
                  onChange={(e) => updateMeal(i, "name", e.target.value)}
                />
                <div className="field" style={{ gap: 0 }}>
                  <label className="label" style={{ fontSize: "var(--text-xs)" }} htmlFor={`edit-meal-${i}-time`}>Horário</label>
                  <input
                    id={`edit-meal-${i}-time`}
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
                    className="btn btn-ghost"
                    style={{ color: COLORS.dangerText, alignSelf: "flex-end", minWidth: 44 }}
                    aria-label="Remover refeição"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <div style={{ width: 44 }} />
                )}
              </div>
              <textarea
                className="input"
                aria-label={`Orientação da refeição ${i + 1}`}
                rows={2}
                placeholder="Orientações para esta refeição..."
                value={m.orientation}
                onChange={(e) => updateMeal(i, "orientation", e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          ))}
        </div>
        {draft.meals.length < 6 && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-4)" }} onClick={addMeal}>
            <Plus size={14} aria-hidden="true" /> Refeição
          </button>
        )}

        {editAlerts.length > 0 && (
          <div className="stack" style={{ gap: "var(--space-2)", marginBottom: "var(--space-4)" }} role="alert">
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text }}>
              Itens podem conflitar com o perfil do paciente
            </div>
            {editAlerts.map((a, i) => (
              <div key={`${a.label}-${i}`} className={ALERT_LEVEL_CLASS[a.level]}>
                <strong>{ALERT_KIND_LABEL[a.kind]}</strong> em “{draft.meals[a.mealIndex]?.name || `Refeição ${a.mealIndex + 1}`}”:
                {" "}contém <strong>{a.matchedTerm}</strong> — paciente registrou <strong>{a.label}</strong>.
              </div>
            ))}
            <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
              Revise ou clique novamente em salvar para manter assim mesmo.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" disabled={!canSave || saving} onClick={() => void handleSaveEdit()}>
            {saving ? "Salvando..." : editAck && editAlerts.length > 0 ? "Salvar mesmo assim" : "Salvar alterações"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setEditAlerts([]); setEditAck(false); }}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
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
        <div className="stack">
          <div className="card cardPad">
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "var(--space-1)" }}>
              Plano ativo
            </div>
            <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-1)" }}>{active.title}</div>
            <div className="muted" style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
              {OBJECTIVE_LABELS[active.objective]} · Desde {formatDate(active.started_at)}
            </div>

            {active.general_notes && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "var(--space-1)" }}>Orientações gerais</div>
                <div style={{ fontSize: "var(--text-base)", color: COLORS.text, lineHeight: 1.55 }}>{active.general_notes}</div>
              </div>
            )}

            {active.meals?.map((m) => (
              <div key={m.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginTop: "var(--space-3)" }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-1)" }}>{m.name}</div>
                <div className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.55 }}>{m.orientation}</div>
                {/* SPEC 038 (P3A) — itens estruturados, quando existirem */}
                {m.items && m.items.length > 0 && (
                  <div className="stack" style={{ gap: 4, marginTop: "var(--space-2)" }}>
                    {m.items.map((item) => (
                      <div key={item.id} style={{ fontSize: "var(--text-xs)", color: COLORS.muted, display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
                        <span>{item.foodName} — {item.grams}g</span>
                        <span>{item.energyKcal} kcal</span>
                      </div>
                    ))}
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: COLORS.text, textAlign: "right" }}>
                      Subtotal: {m.totals.energyKcal} kcal · P {m.totals.proteinG}g · C {m.totals.carbohydrateG}g · G {m.totals.fatG}g
                    </div>
                  </div>
                )}
              </div>
            ))}

            {active.dayTotals && active.meals?.some((m) => m.items?.length > 0) && (
              <div className="card cardPad" style={{ marginTop: "var(--space-4)", background: "var(--color-primary-soft)" }}>
                <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-2)" }}>
                  Total diário
                </div>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: COLORS.text }}>{active.dayTotals.energyKcal} kcal</div>
                <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
                  Proteína {active.dayTotals.proteinG}g · Carboidrato {active.dayTotals.carbohydrateG}g · Gordura {active.dayTotals.fatG}g
                  {active.dayTotals.fiberG != null && ` · Fibra ${active.dayTotals.fiberG}g${active.dayTotals.fiberPartial ? " (parcial)" : ""}`}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(active)}>Editar plano</button>
              <button
                type="button"
                onClick={() => navigate(`/app/nutri/pacientes/${patientId}/plano/novo`, { state: { duplicateFrom: active } })}
                className="btn btn-ghost btn-sm"
              >
                Duplicar
              </button>
              <button
                type="button"
                onClick={() => navigate(`/app/nutri/pacientes/${patientId}/plano/novo`)}
                className="btn btn-sm"
                style={{ borderColor: "var(--color-primary)", color: COLORS.primary }}
              >
                Criar plano
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="btn btn-sm"
                style={{ borderColor: "var(--color-danger-border)", color: COLORS.dangerText }}
              >
                Encerrar plano
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div>
              <div className="muted" style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
                Planos anteriores ({history.length})
              </div>
              <div className="stack" style={{ gap: "var(--space-1)" }}>
                {history.map((h) => (
                  <div key={h.id} className="card cardPad" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)", color: COLORS.muted }}>
                    <span style={{ color: COLORS.text, fontWeight: 600 }}>{h.title}</span>{" "}
                    ({formatDate(h.started_at)} – {h.ended_at ? formatDate(h.ended_at) : "em andamento"})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card cardPad" style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
          <div className="muted" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>Nenhum plano alimentar ativo.</div>
          <button
            type="button"
            onClick={() => navigate(`/app/nutri/pacientes/${patientId}/plano/novo`)}
            className="btn btn-primary"
          >
            Criar plano alimentar
          </button>
        </div>
      )}
    </div>
  );
}
