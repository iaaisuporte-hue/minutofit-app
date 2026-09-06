import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronUp, ChevronDown, Plus, X } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { useIsMobile } from "../../hooks/useIsMobile";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { AddFoodItemControl, MealItemRow, previewMealTotal, type MealItemDraft } from "./MealItemsEditor";
import {
  createNutritionPlan,
  checkDietAgainstProfile,
  suggestSubstitution,
  OBJECTIVE_LABELS,
  METABOLIC_GOAL_LABELS,
  WORKOUT_RELATION_LABELS,
  type NutriObjective,
  type MetabolicGoal,
  type WorkoutRelation,
  type MealPayload,
  type MealItemPayload,
  type NutritionPlan,
  type NutritionMeal,
  type DietAlert,
  type AlertLevel,
  type SubstitutionSuggestion,
} from "../../services/nutriApi";

const ALERT_CLASS: Record<AlertLevel, string> = {
  strong: "alert alert-danger",
  moderate: "alert alert-warn",
  info: "alert alert-info",
  suggestion: "alert",
};

const ALERT_KIND_LABEL: Record<DietAlert["kind"], string> = {
  allergy: "Alergia",
  intolerance: "Intolerância",
  restriction: "Restrição",
  preference: "Preferência",
  clinical_condition: "Condição clínica",
  medication: "Medicamento",
};

function planToDrafts(plan: NutritionPlan): MealDraft[] {
  return plan.meals.map((m) => ({
    name: m.name,
    orientation: m.orientation,
    meal_time: m.meal_time ?? "",
    tolerance_minutes: m.tolerance_minutes != null ? String(m.tolerance_minutes) : "",
    metabolic_goal: (m.metabolic_goal ?? "") as MetabolicGoal | "",
    workout_relation: (m.workout_relation ?? "") as WorkoutRelation | "",
    hydration_note: m.hydration_note ?? "",
    supplement_note: m.supplement_note ?? "",
    alternatives: m.alternatives.map((a) => a.description),
    items: (m.items ?? []).map(mealItemToDraft),
  }));
}

const OBJECTIVES = Object.entries(OBJECTIVE_LABELS) as Array<[NutriObjective, string]>;
const MAX_MEALS = 6;

interface MealDraft {
  name: string;
  orientation: string;
  meal_time: string;
  tolerance_minutes: string;
  metabolic_goal: MetabolicGoal | "";
  workout_relation: WorkoutRelation | "";
  hydration_note: string;
  supplement_note: string;
  alternatives: string[];
  /** SPEC 038 (P3A) — itens estruturados, aditivos à orientação. */
  items: MealItemDraft[];
}

function emptyMeal(): MealDraft {
  return {
    name: "",
    orientation: "",
    meal_time: "",
    tolerance_minutes: "",
    metabolic_goal: "",
    workout_relation: "",
    hydration_note: "",
    supplement_note: "",
    alternatives: [],
    items: [],
  };
}

/** Reconstrói o item de um plano existente (duplicar/editar) a partir do snapshot já calculado. */
function mealItemToDraft(item: NutritionMeal["items"][number]): MealItemDraft {
  const factor = item.grams > 0 ? 100 / item.grams : 0;
  return {
    id: item.id,
    foodId: item.foodId ?? undefined,
    customFoodId: item.customFoodId ?? undefined,
    foodName: item.foodName,
    per100g: {
      energyKcal: Math.round(item.energyKcal * factor * 100) / 100,
      proteinG: Math.round(item.proteinG * factor * 100) / 100,
      carbohydrateG: Math.round(item.carbohydrateG * factor * 100) / 100,
      fatG: Math.round(item.fatG * factor * 100) / 100,
      fiberG: item.fiberG == null ? null : Math.round(item.fiberG * factor * 100) / 100,
      sodiumMg: item.sodiumMg == null ? null : Math.round(item.sodiumMg * factor * 100) / 100,
    },
    quantity: item.unitType === "measure" ? item.quantity : item.grams,
    unitType: item.unitType,
    measureId: item.measureId ?? undefined,
    customMeasureId: item.customMeasureId ?? undefined,
    measureGrams: item.unitType === "measure" ? item.grams / item.quantity : undefined,
    orderIndex: item.orderIndex,
  };
}

// SPEC 037 / P2.8: convenção de chave emprestada de
// `pages/user/workoutSession/sessionDraft.ts` (`s2core:{módulo}:draft:
// {escopo}`) — não existe rascunho de AUTORIA em nenhum builder do produto
// hoje (o do Personal fecha sem confirmar; o da sessão do aluno é rascunho
// de execução, não de criação), então este desenho é novo.
function draftKey(patientId: number): string {
  return `s2core:nutri:plan-draft:${patientId}`;
}

// SPEC 038 (P3A) / §55: itens estruturados mudaram a FORMA do rascunho
// (cada refeição ganhou `items` obrigatório). v1 (sem `version` — só
// existiu antes da P3A) não pode ser hidratado: `meal.items.length` num
// rascunho v1 quebraria em runtime. `readDraft` já filtra por versão —
// quem chama só recebe um bundle hidratável de verdade.
const DRAFT_VERSION = 2;

interface PlanDraftBundle {
  version: number;
  title: string;
  objective: NutriObjective | "";
  generalNotes: string;
  meals: MealDraft[];
  savedAt: string;
}

/** Presença de QUALQUER rascunho salvo, mesmo incompatível — só para decidir a UI do prompt. */
function hasAnyDraft(patientId: number): boolean {
  try {
    return localStorage.getItem(draftKey(patientId)) != null;
  } catch {
    return false;
  }
}

function readDraft(patientId: number): PlanDraftBundle | null {
  try {
    const raw = localStorage.getItem(draftKey(patientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlanDraftBundle>;
    if (parsed.version !== DRAFT_VERSION) return null; // incompatível — nunca hidrata parcialmente
    return parsed as PlanDraftBundle;
  } catch {
    return null;
  }
}

function writeDraft(patientId: number, bundle: Omit<PlanDraftBundle, "version">): void {
  try {
    localStorage.setItem(draftKey(patientId), JSON.stringify({ ...bundle, version: DRAFT_VERSION }));
  } catch { /* localStorage indisponível (modo privado etc.) — sem rascunho, sem crash */ }
}

function clearDraft(patientId: number): void {
  try {
    localStorage.removeItem(draftKey(patientId));
  } catch { /* ver readDraft */ }
}

function MealRow({
  meal,
  index,
  total,
  onChange,
  onRemove,
}: {
  meal: MealDraft;
  index: number;
  total: number;
  onChange: (field: keyof MealDraft, value: string | string[] | MealItemDraft[]) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // SPEC 036 / builder do plano: abaixo de 480px o grid "nome + horário +
  // remover" comprimia o nome da refeição até ~90px de largura útil. Empilha
  // em vez de espremer.
  const stackTopRow = useIsMobile(480);

  function updateAlt(i: number, val: string) {
    const next = [...meal.alternatives];
    next[i] = val;
    onChange("alternatives", next);
  }

  function addAlt() {
    onChange("alternatives", [...meal.alternatives, ""]);
  }

  function removeAlt(i: number) {
    onChange("alternatives", meal.alternatives.filter((_, idx) => idx !== i));
  }

  function addItem(item: MealItemDraft) {
    onChange("items", [...meal.items, { ...item, orderIndex: meal.items.length }]);
  }

  function removeItem(i: number) {
    onChange("items", meal.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, orderIndex: idx })));
  }

  const mealTotal = previewMealTotal(meal.items);

  const nameFieldId = `meal-${index}-name`;
  const timeFieldId = `meal-${index}-time`;
  const orientationFieldId = `meal-${index}-orientation`;

  return (
    <div className="card cardPad" style={{ background: "var(--color-surface-raised)" }}>
      {/* Top row: name + time + remove */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: stackTopRow ? "1fr" : "1fr auto auto",
          gap: "var(--space-2)",
          alignItems: stackTopRow ? undefined : "flex-start",
          marginBottom: "var(--space-3)",
        }}
      >
        <div className="field" style={{ gap: 0 }}>
          <label className="label" htmlFor={nameFieldId} style={{ fontSize: "var(--text-xs)" }}>
            Refeição {index + 1} · nome *
          </label>
          <input
            id={nameFieldId}
            type="text"
            className="input"
            maxLength={80}
            value={meal.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </div>
        <div className="field" style={{ gap: 0, width: stackTopRow ? "100%" : 110 }}>
          <label className="label" htmlFor={timeFieldId} style={{ fontSize: "var(--text-xs)" }}>
            Horário ideal
          </label>
          <input
            id={timeFieldId}
            type="time"
            className="input"
            value={meal.meal_time}
            onChange={(e) => onChange("meal_time", e.target.value)}
          />
        </div>
        {total > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover refeição"
            className="btn btn-ghost"
            style={{ alignSelf: stackTopRow ? "stretch" : "flex-end", color: COLORS.dangerText, minHeight: 44 }}
          >
            <X size={16} aria-hidden="true" />
            {stackTopRow && "Remover refeição"}
          </button>
        ) : (
          !stackTopRow && <div style={{ width: 44 }} />
        )}
      </div>

      {/* Orientation */}
      <div className="field">
        <label className="label" htmlFor={orientationFieldId} style={{ fontSize: "var(--text-xs)" }}>
          Orientações para esta refeição
        </label>
        <textarea
          id={orientationFieldId}
          className="input"
          placeholder="Ex: 2 ovos mexidos, 1 fatia de pão integral..."
          rows={2}
          value={meal.orientation}
          onChange={(e) => onChange("orientation", e.target.value)}
          style={{ resize: "vertical" }}
        />
      </div>

      {/* SPEC 038 (P3A) — itens estruturados: aditivo à orientação acima, nunca obrigatório */}
      <div className="stack" style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        {meal.items.length > 0 && (
          <div className="stack" style={{ gap: "var(--space-1)" }}>
            {meal.items.map((item, i) => (
              <MealItemRow key={item.id ?? `new-${i}`} item={item} onRemove={() => removeItem(i)} />
            ))}
          </div>
        )}
        <AddFoodItemControl onAdd={addItem} />
        {meal.items.length > 0 && (
          <div className="muted" style={{ fontSize: "var(--text-xs)", textAlign: "right" }}>
            Subtotal: {mealTotal.energyKcal} kcal · P {mealTotal.proteinG}g · C {mealTotal.carbohydrateG}g · G {mealTotal.fatG}g
          </div>
        )}
      </div>

      {/* Toggle advanced */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="btn btn-ghost btn-sm"
        style={{ marginTop: "var(--space-2)", color: COLORS.primary, background: "none", border: "none", padding: "var(--space-1) 0" }}
      >
        {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        {expanded ? "Ocultar detalhes" : "Opções avançadas (janela, objetivo, substituições)"}
      </button>

      {expanded && (
        <div className="stack" style={{ marginTop: "var(--space-3)" }}>
          {/* Tolerance + metabolic goal */}
          <div style={{ display: "grid", gridTemplateColumns: stackTopRow ? "1fr" : "1fr 1fr", gap: "var(--space-2)" }}>
            <div className="field">
              <label className="label" htmlFor={`meal-${index}-tolerance`}>Janela de tolerância (min)</label>
              <input
                id={`meal-${index}-tolerance`}
                type="number"
                className="input"
                min={0}
                max={180}
                placeholder="60"
                value={meal.tolerance_minutes}
                onChange={(e) => onChange("tolerance_minutes", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor={`meal-${index}-goal`}>Objetivo metabólico</label>
              <select
                id={`meal-${index}-goal`}
                className="input"
                value={meal.metabolic_goal}
                onChange={(e) => onChange("metabolic_goal", e.target.value)}
              >
                <option value="">Nenhum</option>
                {(Object.entries(METABOLIC_GOAL_LABELS) as Array<[MetabolicGoal, string]>).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Workout relation */}
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="label" style={{ padding: 0, marginBottom: "var(--space-1)" }}>Relação com treino</legend>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {(Object.entries(WORKOUT_RELATION_LABELS) as Array<[WorkoutRelation, string]>).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={meal.workout_relation === v}
                  onClick={() => onChange("workout_relation", meal.workout_relation === v ? "" : v)}
                  className={meal.workout_relation === v ? "badge badge-accent" : "badge"}
                  style={{ flex: 1, justifyContent: "center", cursor: "pointer", padding: "var(--space-2)" }}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Hydration + supplement */}
          <div style={{ display: "grid", gridTemplateColumns: stackTopRow ? "1fr" : "1fr 1fr", gap: "var(--space-2)" }}>
            <div className="field">
              <label className="label" htmlFor={`meal-${index}-hydration`}>Hidratação</label>
              <input
                id={`meal-${index}-hydration`}
                type="text"
                className="input"
                maxLength={200}
                placeholder="Ex: 1 copo de água"
                value={meal.hydration_note}
                onChange={(e) => onChange("hydration_note", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor={`meal-${index}-supplement`}>Suplementação</label>
              <input
                id={`meal-${index}-supplement`}
                type="text"
                className="input"
                maxLength={200}
                placeholder="Ex: Creatina 3g"
                value={meal.supplement_note}
                onChange={(e) => onChange("supplement_note", e.target.value)}
              />
            </div>
          </div>

          {/* Alternatives */}
          <div className="field">
            <label className="label" htmlFor={`meal-${index}-alt-0`}>Substituições (pode trocar por...)</label>
            <div className="stack" style={{ gap: "var(--space-1)" }}>
              {meal.alternatives.map((alt, i) => (
                <div key={i} style={{ display: "flex", gap: "var(--space-1)" }}>
                  <input
                    id={i === 0 ? `meal-${index}-alt-0` : undefined}
                    aria-label={i > 0 ? `Substituição ${i + 1}` : undefined}
                    type="text"
                    className="input"
                    maxLength={300}
                    placeholder={`Substituição ${i + 1}`}
                    value={alt}
                    onChange={(e) => updateAlt(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeAlt(i)}
                    className="btn btn-ghost"
                    style={{ minWidth: 44 }}
                    aria-label="Remover substituição"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {meal.alternatives.length < 5 && (
              <button type="button" onClick={addAlt} className="btn btn-ghost btn-sm" style={{ marginTop: "var(--space-2)", width: "100%", border: "1px dashed var(--color-border)" }}>
                <Plus size={14} aria-hidden="true" /> Adicionar substituição
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePlanPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const duplicate = (location.state as { duplicateFrom?: NutritionPlan } | null)?.duplicateFrom;
  const id = Number(patientId);

  // SPEC 037 / P2.8: rascunho de uma sessão anterior NUNCA é restaurado em
  // silêncio — só depois de o nutri escolher "Continuar rascunho". Vindo de
  // "Duplicar" (ação explícita sobre um plano específico), o rascunho antigo
  // é ignorado: a intenção explícita do clique vence um estado esquecido.
  const [pendingDraft] = useState<PlanDraftBundle | null>(() => (duplicate ? null : readDraft(id)));
  // SPEC 038 §55: rascunho de formato antigo (v1) existe mas não é
  // hidratável — prompt oferece só Descartar, nunca finge que consegue
  // continuar de onde parou.
  const [hasIncompatibleDraft] = useState<boolean>(() => !duplicate && !pendingDraft && hasAnyDraft(id));
  const [draftResolved, setDraftResolved] = useState(!pendingDraft && !hasIncompatibleDraft);

  const [title, setTitle] = useState(duplicate ? `Cópia — ${duplicate.title}` : "");
  const [objective, setObjective] = useState<NutriObjective | "">(duplicate?.objective ?? "");
  const [generalNotes, setGeneralNotes] = useState(duplicate?.general_notes ?? "");
  const [meals, setMeals] = useState<MealDraft[]>(
    duplicate?.meals.length ? planToDrafts(duplicate) : [emptyMeal()]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<DietAlert[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<number, SubstitutionSuggestion>>({});

  const [isDirty, setIsDirty] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const pendingExitRef = useRef<(() => void) | null>(null);

  function continueDraft() {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setObjective(pendingDraft.objective);
    setGeneralNotes(pendingDraft.generalNotes);
    setMeals(pendingDraft.meals);
    setIsDirty(true);
    setDraftResolved(true);
  }

  function discardDraft() {
    clearDraft(id);
    setDraftResolved(true);
  }

  // Autosave do rascunho (debounced) — só enquanto sujo e só depois de
  // resolvido o prompt de restauração (não sobrescreve o rascunho salvo
  // enquanto o nutri ainda não decidiu o que fazer com ele).
  useEffect(() => {
    if (!isDirty || !draftResolved) return;
    const t = setTimeout(() => {
      writeDraft(id, { title, objective, generalNotes, meals, savedAt: new Date().toISOString() });
    }, 400);
    return () => clearTimeout(t);
  }, [id, isDirty, draftResolved, title, objective, generalNotes, meals]);

  // Grava o rascunho JÁ, fora do debounce — usado nos dois pontos de saída
  // (confirmExit/beforeunload). Sem isso, sair rápido demais depois de digitar
  // corria com o `clearTimeout` do cleanup do efeito de autosave: o
  // componente desmontava antes dos 400ms, e o rascunho nunca era escrito.
  function flushDraft() {
    if (isDirty) writeDraft(id, { title, objective, generalNotes, meals, savedAt: new Date().toISOString() });
  }

  // Fechar/atualizar a aba com alterações não salvas — aviso nativo do browser.
  useEffect(() => {
    if (!isDirty) return;
    function handler(e: BeforeUnloadEvent) {
      writeDraft(id, { title, objective, generalNotes, meals, savedAt: new Date().toISOString() });
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [id, isDirty, title, objective, generalNotes, meals]);

  function requestExit(after: () => void) {
    if (!isDirty) {
      after();
      return;
    }
    pendingExitRef.current = after;
    setExitConfirmOpen(true);
  }

  function confirmExit() {
    flushDraft();
    setExitConfirmOpen(false);
    const after = pendingExitRef.current;
    pendingExitRef.current = null;
    after?.();
  }

  const filledMeals = meals.filter((m) => m.name.trim() && m.orientation.trim());
  const canSubmit =
    title.trim().length > 0 &&
    objective !== "" &&
    filledMeals.length >= 1 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const mealPayloads: MealPayload[] = filledMeals.map((m, i) => ({
        name: m.name.trim(),
        orientation: m.orientation.trim(),
        order_index: i,
        meal_time: m.meal_time || null,
        tolerance_minutes: m.tolerance_minutes ? Number(m.tolerance_minutes) : null,
        metabolic_goal: (m.metabolic_goal || null) as MetabolicGoal | null,
        workout_relation: (m.workout_relation || null) as WorkoutRelation | null,
        hydration_note: m.hydration_note.trim() || null,
        supplement_note: m.supplement_note.trim() || null,
        alternatives: m.alternatives
          .map((d, idx) => ({ description: d.trim(), order_index: idx }))
          .filter((a) => a.description.length > 0),
        items: m.items.map((it, idx): MealItemPayload => ({
          id: it.id,
          foodId: it.foodId,
          customFoodId: it.customFoodId,
          quantity: it.quantity,
          unitType: it.unitType,
          measureId: it.measureId,
          customMeasureId: it.customMeasureId,
          orderIndex: idx,
        })),
      }));

      // Checagem contra o perfil clínico-nutricional antes de salvar.
      // Alimento incompatível nunca é salvo silenciosamente — exige confirmação.
      // Falha na checagem (ex: sem consent) não bloqueia o salvamento.
      if (!acknowledged) {
        try {
          const found = await checkDietAgainstProfile(
            id,
            filledMeals.map((m) => ({
              name: m.name,
              orientation: m.orientation,
              alternatives: m.alternatives,
            })),
          );
          if (found.length > 0) {
            setAlerts(found);
            setAcknowledged(true);
            // Fase 2: busca sugestões de troca para as refeições em conflito.
            const conflictIdx = Array.from(new Set(found.map((a) => a.mealIndex)));
            try {
              const pairs = await Promise.all(
                conflictIdx.map(async (idx) => {
                  const m = filledMeals[idx];
                  const s = await suggestSubstitution(id, {
                    name: m.name, orientation: m.orientation, alternatives: m.alternatives,
                  });
                  return [idx, s] as const;
                }),
              );
              setSuggestions(Object.fromEntries(pairs));
            } catch { /* sugestões são best-effort */ }
            setSubmitting(false);
            return; // aguarda confirmação explícita do nutri
          }
        } catch {
          /* checagem indisponível — segue o fluxo normal de salvamento */
        }
      }

      await createNutritionPlan(id, {
        title: title.trim(),
        objective: objective as NutriObjective,
        general_notes: generalNotes.trim() || undefined,
        meals: mealPayloads,
      });
      clearDraft(id);
      setIsDirty(false);
      navigate(`/app/nutri/pacientes/${id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Não foi possível salvar o plano.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTitleChange(value: string) {
    setIsDirty(true);
    setTitle(value);
  }

  function handleObjectiveChange(value: NutriObjective) {
    setIsDirty(true);
    setObjective(value);
  }

  function handleNotesChange(value: string) {
    setIsDirty(true);
    setGeneralNotes(value);
  }

  function updateMeal(index: number, field: keyof MealDraft, value: string | string[] | MealItemDraft[]) {
    // Editar a dieta invalida a confirmação anterior — re-checa no próximo salvar.
    resetAck();
    setIsDirty(true);
    setMeals((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function resetAck() {
    if (acknowledged) {
      setAcknowledged(false);
      setAlerts([]);
      setSuggestions({});
    }
  }

  function addMeal() {
    if (meals.length < MAX_MEALS) {
      resetAck();
      setIsDirty(true);
      setMeals((prev) => [...prev, emptyMeal()]);
    }
  }

  function removeMeal(index: number) {
    if (meals.length <= 1) return;
    resetAck();
    setIsDirty(true);
    setMeals((prev) => prev.filter((_, i) => i !== index));
  }

  if (!draftResolved && hasIncompatibleDraft) {
    return (
      <div style={{ padding: "var(--space-6) 0", maxWidth: 680 }}>
        <div className="card cardPad">
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-2)" }}>
            Encontramos um rascunho de uma versão antiga
          </div>
          <p className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, margin: "0 0 var(--space-4)" }}>
            O builder mudou desde então e não é possível continuar esse rascunho com segurança. Descarte para começar do zero.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>Descartar</button>
        </div>
      </div>
    );
  }

  if (!draftResolved) {
    return (
      <div style={{ padding: "var(--space-6) 0", maxWidth: 680 }}>
        <div className="card cardPad">
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-2)" }}>
            Encontramos um rascunho não salvo
          </div>
          <p className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, margin: "0 0 var(--space-4)" }}>
            Você começou a editar um plano para este paciente e saiu sem salvar. Quer continuar de onde parou?
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={continueDraft}>Continuar rascunho</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>Descartar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6) 0" }}>
      <ConfirmDialog
        open={exitConfirmOpen}
        title="Sair sem salvar?"
        message="Você tem alterações não salvas. Sair agora descartará o que foi alterado nesta sessão — mas seu rascunho continua guardado para a próxima vez que abrir este plano."
        confirmLabel="Sair sem salvar"
        danger
        onConfirm={confirmExit}
        onCancel={() => setExitConfirmOpen(false)}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <button
          type="button"
          onClick={() => requestExit(() => navigate(`/app/nutri/pacientes/${id}`))}
          className="btn btn-ghost"
          style={{ padding: "var(--space-2)", minWidth: 44, minHeight: 44 }}
          aria-label="Voltar sem salvar"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>Criar plano alimentar</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="stack" style={{ gap: "var(--space-5)", maxWidth: 680 }}>
        {/* Título */}
        <div className="field">
          <label className="label" htmlFor="plan-title">
            Título do plano <span style={{ color: COLORS.dangerText }}>*</span>
          </label>
          <input
            id="plan-title"
            type="text"
            className="input"
            placeholder="Ex: Protocolo Emagrecimento Junho"
            maxLength={200}
            required
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
        </div>

        {/* Objetivo */}
        <div className="field">
          <label className="label" htmlFor="plan-objective">
            Objetivo <span style={{ color: COLORS.dangerText }}>*</span>
          </label>
          <select
            id="plan-objective"
            className="input"
            required
            value={objective}
            onChange={(e) => handleObjectiveChange(e.target.value as NutriObjective)}
          >
            <option value="">Selecionar objetivo...</option>
            {OBJECTIVES.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Orientações gerais */}
        <div className="field">
          <label className="label" htmlFor="plan-notes">Orientações gerais</label>
          <textarea
            id="plan-notes"
            className="input"
            placeholder="Orientações livres para o paciente..."
            rows={3}
            value={generalNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        {/* Refeições */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: COLORS.text, marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            Refeições ({meals.length}/{MAX_MEALS})
            <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 400 }}>mín. 1, máx. 6</span>
          </div>
          <div className="stack" style={{ gap: "var(--space-3)" }}>
            {meals.map((m, i) => (
              <MealRow
                key={i}
                meal={m}
                index={i}
                total={meals.length}
                onChange={(f, v) => updateMeal(i, f, v)}
                onRemove={() => removeMeal(i)}
              />
            ))}
          </div>
          {meals.length < MAX_MEALS && (
            <button type="button" onClick={addMeal} className="btn btn-ghost btn-sm" style={{ marginTop: "var(--space-3)", width: "100%", border: "1px dashed var(--color-border)" }}>
              <Plus size={14} aria-hidden="true" /> Adicionar refeição
            </button>
          )}
        </div>

        {/* SPEC 038 (P3A) §31 — total diário, derivado dos itens de todas as refeições */}
        {meals.some((m) => m.items.length > 0) && (() => {
          const dayTotal = previewMealTotal(meals.flatMap((m) => m.items));
          return (
            <div className="card cardPad" style={{ background: "var(--color-primary-soft)" }}>
              <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-2)" }}>
                Total diário
              </div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: COLORS.text }}>{dayTotal.energyKcal} kcal</div>
              <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
                Proteína {dayTotal.proteinG}g · Carboidrato {dayTotal.carbohydrateG}g · Gordura {dayTotal.fatG}g
                {dayTotal.fiberG != null && ` · Fibra ${dayTotal.fiberG}g${dayTotal.fiberPartial ? " (parcial)" : ""}`}
              </div>
            </div>
          );
        })()}

        {alerts.length > 0 && (
          <div className="stack" style={{ gap: "var(--space-2)" }} role="alert">
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text }}>
              Atenção: itens podem conflitar com o perfil do paciente
            </div>
            {alerts.map((a, i) => {
              const mealName = filledMeals[a.mealIndex]?.name || `Refeição ${a.mealIndex + 1}`;
              return (
                <div key={`${a.mealIndex}-${a.label}-${i}`} className={ALERT_CLASS[a.level]}>
                  <strong>{ALERT_KIND_LABEL[a.kind]}</strong> em “{mealName}”: contém <strong>{a.matchedTerm}</strong>
                  {" "}— paciente registrou <strong>{a.label}</strong>.
                </div>
              );
            })}
            {/* Fase 2 — substituição assistida: dicas de troca + alternativas seguras */}
            {Object.entries(suggestions).map(([idxStr, s]) => {
              const idx = Number(idxStr);
              const safe = s.alternatives.filter((a) => a.safe).map((a) => a.description);
              if (s.swapHints.length === 0 && safe.length === 0) return null;
              return (
                <div key={`sug-${idx}`} className="alert" style={{ background: "var(--color-primary-soft)" }}>
                  <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-1)" }}>
                    Sugestões para “{filledMeals[idx]?.name || `Refeição ${idx + 1}`}”
                  </div>
                  {s.swapHints.map((h, k) => (
                    <div key={k} style={{ color: COLORS.text }}>• {h}</div>
                  ))}
                  {safe.length > 0 && (
                    <div className="muted" style={{ marginTop: "var(--space-1)" }}>
                      Alternativas já cadastradas compatíveis: {safe.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
              Revise os itens acima. Para manter assim mesmo, clique novamente em salvar.
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={() => requestExit(() => navigate(`/app/nutri/pacientes/${id}`))} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={!canSubmit} className="btn btn-primary">
            {submitting
              ? "Salvando..."
              : acknowledged && alerts.length > 0
                ? "Salvar mesmo assim"
                : "Salvar plano"}
          </button>
        </div>
      </form>
    </div>
  );
}
