import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS } from "../../styles/colors";
import {
  createNutritionPlan,
  OBJECTIVE_LABELS,
  METABOLIC_GOAL_LABELS,
  WORKOUT_RELATION_LABELS,
  type NutriObjective,
  type MetabolicGoal,
  type WorkoutRelation,
  type MealPayload,
} from "../../services/nutriApi";

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
  };
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
  onChange: (field: keyof MealDraft, value: string | string[]) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const inputBase: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 14,
    color: COLORS.text,
    background: "var(--color-surface)",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const selectBase: React.CSSProperties = {
    ...inputBase,
    appearance: "none",
    WebkitAppearance: "none",
  };

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

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "14px",
        background: "var(--color-surface-raised)",
      }}
    >
      {/* Top row: name + time + remove */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
        <input
          type="text"
          placeholder={`Refeição ${index + 1} · nome *`}
          maxLength={80}
          value={meal.name}
          onChange={(e) => onChange("name", e.target.value)}
          style={inputBase}
        />
        <input
          type="time"
          value={meal.meal_time}
          onChange={(e) => onChange("meal_time", e.target.value)}
          title="Horário ideal"
          style={{ ...inputBase, width: 110 }}
        />
        {total > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover refeição"
            style={{
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "9px 12px",
              color: COLORS.danger,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        ) : (
          <div style={{ width: 44 }} />
        )}
      </div>

      {/* Orientation */}
      <textarea
        placeholder="Orientações para esta refeição..."
        rows={2}
        value={meal.orientation}
        onChange={(e) => onChange("orientation", e.target.value)}
        style={{ ...inputBase, resize: "vertical", marginBottom: 8 }}
      />

      {/* Toggle advanced */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: COLORS.primary,
          fontWeight: 600,
          padding: "2px 0",
        }}
      >
        {expanded ? "▲ Ocultar detalhes" : "▼ Opções avançadas (janela, objetivo, substituições)"}
      </button>

      {expanded && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Tolerance + metabolic goal */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>
                Janela de tolerância (min)
              </label>
              <input
                type="number"
                min={0}
                max={180}
                placeholder="60"
                value={meal.tolerance_minutes}
                onChange={(e) => onChange("tolerance_minutes", e.target.value)}
                style={inputBase}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>
                Objetivo metabólico
              </label>
              <select
                value={meal.metabolic_goal}
                onChange={(e) => onChange("metabolic_goal", e.target.value)}
                style={selectBase}
              >
                <option value="">Nenhum</option>
                {(Object.entries(METABOLIC_GOAL_LABELS) as Array<[MetabolicGoal, string]>).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Workout relation */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>
              Relação com treino
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(Object.entries(WORKOUT_RELATION_LABELS) as Array<[WorkoutRelation, string]>).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange("workout_relation", meal.workout_relation === v ? "" : v)}
                  style={{
                    flex: 1,
                    padding: "7px 8px",
                    borderRadius: 8,
                    border: meal.workout_relation === v
                      ? `2px solid ${COLORS.primary}`
                      : "1.5px solid var(--color-border)",
                    background: meal.workout_relation === v ? "var(--color-primary-soft)" : "var(--color-surface)",
                    color: meal.workout_relation === v ? COLORS.primary : COLORS.text,
                    fontWeight: meal.workout_relation === v ? 700 : 500,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Hydration + supplement */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>
                Hidratação
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="Ex: 1 copo de água"
                value={meal.hydration_note}
                onChange={(e) => onChange("hydration_note", e.target.value)}
                style={inputBase}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>
                Suplementação
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="Ex: Creatina 3g"
                value={meal.supplement_note}
                onChange={(e) => onChange("supplement_note", e.target.value)}
                style={inputBase}
              />
            </div>
          </div>

          {/* Alternatives */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
              Substituições (pode trocar por...)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {meal.alternatives.map((alt, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    maxLength={300}
                    placeholder={`Substituição ${i + 1}`}
                    value={alt}
                    onChange={(e) => updateAlt(i, e.target.value)}
                    style={{ ...inputBase, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeAlt(i)}
                    style={{
                      background: "none",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: "9px 10px",
                      color: COLORS.muted,
                      cursor: "pointer",
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                    aria-label="Remover substituição"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {meal.alternatives.length < 5 && (
              <button
                type="button"
                onClick={addAlt}
                style={{
                  marginTop: 6,
                  background: "none",
                  border: "1px dashed var(--color-border)",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  color: COLORS.primary,
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                + Adicionar substituição
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

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState<NutriObjective | "">("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [meals, setMeals] = useState<MealDraft[]>([emptyMeal()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = Number(patientId);

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
      }));

      await createNutritionPlan(id, {
        title: title.trim(),
        objective: objective as NutriObjective,
        general_notes: generalNotes.trim() || undefined,
        meals: mealPayloads,
      });
      navigate(`/app/nutri/pacientes/${id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Não foi possível salvar o plano.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateMeal(index: number, field: keyof MealDraft, value: string | string[]) {
    setMeals((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function addMeal() {
    if (meals.length < MAX_MEALS) setMeals((prev) => [...prev, emptyMeal()]);
  }

  function removeMeal(index: number) {
    if (meals.length <= 1) return;
    setMeals((prev) => prev.filter((_, i) => i !== index));
  }

  const inputBase: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLORS.text,
    background: "var(--color-surface)",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => navigate(`/app/nutri/pacientes/${id}`)}
          style={{
            background: "none",
            border: "none",
            color: COLORS.muted,
            cursor: "pointer",
            fontSize: 20,
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Cancelar"
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>
          Criar plano alimentar
        </h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Título */}
        <div>
          <label
            htmlFor="plan-title"
            style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}
          >
            Título do plano <span style={{ color: COLORS.danger }}>*</span>
          </label>
          <input
            id="plan-title"
            type="text"
            placeholder="Ex: Protocolo Emagrecimento Junho"
            maxLength={200}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputBase}
          />
        </div>

        {/* Objetivo */}
        <div>
          <label
            htmlFor="plan-objective"
            style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}
          >
            Objetivo <span style={{ color: COLORS.danger }}>*</span>
          </label>
          <select
            id="plan-objective"
            required
            value={objective}
            onChange={(e) => setObjective(e.target.value as NutriObjective)}
            style={{ ...inputBase, appearance: "none", WebkitAppearance: "none" }}
          >
            <option value="">Selecionar objetivo...</option>
            {OBJECTIVES.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Orientações gerais */}
        <div>
          <label
            htmlFor="plan-notes"
            style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}
          >
            Orientações gerais
          </label>
          <textarea
            id="plan-notes"
            placeholder="Orientações livres para o paciente..."
            rows={3}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            style={{ ...inputBase, resize: "vertical" }}
          />
        </div>

        {/* Refeições */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.text,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Refeições ({meals.length}/{MAX_MEALS})
            <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>
              mín. 1, máx. 6
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            <button
              type="button"
              onClick={addMeal}
              style={{
                marginTop: 12,
                background: "none",
                border: "1px dashed var(--color-border)",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13,
                color: COLORS.primary,
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
              }}
            >
              + Adicionar refeição
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--color-danger-soft)",
              color: COLORS.danger,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(`/app/nutri/pacientes/${id}`)}
            style={{
              padding: "11px 22px",
              borderRadius: 10,
              border: "1.5px solid var(--color-border)",
              background: "none",
              color: COLORS.text,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "11px 28px",
              borderRadius: 10,
              border: "none",
              background: canSubmit ? COLORS.primary : "var(--color-surface-raised)",
              color: canSubmit ? "#fff" : COLORS.muted,
              fontWeight: 700,
              fontSize: 14,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            {submitting ? "Salvando..." : "Salvar plano"}
          </button>
        </div>
      </form>
    </div>
  );
}
