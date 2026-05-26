import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS } from "../../styles/colors";
import { createNutritionPlan, OBJECTIVE_LABELS, type NutriObjective } from "../../services/nutriApi";

const OBJECTIVES = Object.entries(OBJECTIVE_LABELS) as Array<[NutriObjective, string]>;

const MAX_MEALS = 6;

interface MealDraft {
  name: string;
  orientation: string;
}

function MealRow({
  meal,
  total,
  onChange,
  onRemove,
}: {
  meal: MealDraft;
  total: number;
  onChange: (field: "name" | "orientation", value: string) => void;
  onRemove: () => void;
}) {
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr auto",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <input
        type="text"
        placeholder="Nome da refeição"
        maxLength={80}
        value={meal.name}
        onChange={(e) => onChange("name", e.target.value)}
        style={inputBase}
      />
      <textarea
        placeholder="Orientações para esta refeição..."
        rows={2}
        value={meal.orientation}
        onChange={(e) => onChange("orientation", e.target.value)}
        style={{ ...inputBase, resize: "vertical" }}
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
            whiteSpace: "nowrap",
          }}
        >
          ×
        </button>
      ) : (
        <div style={{ width: 44 }} />
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
  const [meals, setMeals] = useState<MealDraft[]>([{ name: "", orientation: "" }]);
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
      await createNutritionPlan(id, {
        title: title.trim(),
        objective: objective as NutriObjective,
        general_notes: generalNotes.trim() || undefined,
        meals: filledMeals.map((m, i) => ({
          name: m.name.trim(),
          orientation: m.orientation.trim(),
          order_index: i,
        })),
      });
      navigate("..", { relative: "path" });
    } catch (err: unknown) {
      setError((err as Error).message || "Não foi possível salvar o plano.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateMeal(index: number, field: "name" | "orientation", value: string) {
    setMeals((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  function addMeal() {
    if (meals.length < MAX_MEALS) setMeals((prev) => [...prev, { name: "", orientation: "" }]);
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
    <div style={{ padding: "24px 0", maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
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
            <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>mín. 1, máx. 6</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {meals.map((m, i) => (
              <MealRow
                key={i}
                meal={m}
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
                marginTop: 10,
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
            onClick={() => navigate("..", { relative: "path" })}
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
