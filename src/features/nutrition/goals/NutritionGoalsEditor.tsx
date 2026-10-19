import { useState } from "react";
import { Check } from "lucide-react";
import { DrawerShell } from "../../../components/overlay/DrawerShell";
import { OBJECTIVE_LABELS, type NutriObjective } from "../../../services/nutriApi";
import {
  NutritionGoalsApiError,
  savePatientNutritionGoals,
  type NutritionGoals,
  type NutritionGoalsInput,
} from "../../../services/nutritionGoalsApi";
import { litersToMl, mlToLiters, parseDecimalInput, toInputValue } from "./formatGoals";

const OBJECTIVES = Object.keys(OBJECTIVE_LABELS) as NutriObjective[];
const MAX_OBJECTIVES = 3;
const NOTE_MAX = 500;
const NOTE_SUGGESTION =
  "Essas são metas iniciais estimadas. Ajustaremos as porções conforme peso, fome, desempenho e evolução.";

type FieldKey =
  | "energyKcal"
  | "proteinMinG"
  | "proteinMaxG"
  | "fiberMinG"
  | "fiberMaxG"
  | "waterMinL"
  | "waterMaxL";

/** Campo do backend (água em ml) → campo do formulário (água em litros). */
const SERVER_FIELD_TO_FORM: Record<string, FieldKey | "objectives" | "patientNote" | "body"> = {
  energyKcal: "energyKcal",
  proteinMinG: "proteinMinG",
  proteinMaxG: "proteinMaxG",
  fiberMinG: "fiberMinG",
  fiberMaxG: "fiberMaxG",
  waterMinMl: "waterMinL",
  waterMaxMl: "waterMaxL",
  objectives: "objectives",
  patientNote: "patientNote",
  body: "body",
};

function initialValues(goals: NutritionGoals | null): Record<FieldKey, string> {
  return {
    energyKcal: toInputValue(goals?.energyKcal ?? null),
    proteinMinG: toInputValue(goals?.proteinMinG ?? null),
    proteinMaxG: toInputValue(goals?.proteinMaxG ?? null),
    fiberMinG: toInputValue(goals?.fiberMinG ?? null),
    fiberMaxG: toInputValue(goals?.fiberMaxG ?? null),
    waterMinL: toInputValue(mlToLiters(goals?.waterMinMl ?? null)),
    waterMaxL: toInputValue(mlToLiters(goals?.waterMaxMl ?? null)),
  };
}

/**
 * "Ajustar metas" (Spec 039). Limites, faixa invertida e "ao menos uma meta"
 * são do backend (`parseNutritionGoalsInput`) — o cliente só converte texto
 * PT-BR em número e mostra o erro no campo que o servidor nomear, para não
 * existir uma segunda cópia da regra que possa divergir.
 */
export function NutritionGoalsEditor({
  open,
  patientId,
  goals,
  onClose,
  onSaved,
}: {
  open: boolean;
  patientId: number;
  goals: NutritionGoals | null;
  onClose: () => void;
  onSaved: (goals: NutritionGoals) => void;
}) {
  const [values, setValues] = useState(() => initialValues(goals));
  const [objectives, setObjectives] = useState<NutriObjective[]>(goals?.objectives ?? []);
  const [note, setNote] = useState(goals?.patientNote ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function setValue(key: FieldKey, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (fieldError?.field === key) setFieldError(null);
  }

  function toggleObjective(o: NutriObjective) {
    setObjectives((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : prev.length >= MAX_OBJECTIVES ? prev : [...prev, o],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFieldError(null);
    setFormError(null);

    const parsed = {} as Record<FieldKey, number | null>;
    for (const key of Object.keys(values) as FieldKey[]) {
      const n = parseDecimalInput(values[key]);
      if (Number.isNaN(n)) {
        setFieldError({ field: key, message: "Digite apenas números." });
        return;
      }
      parsed[key] = n;
    }

    const input: NutritionGoalsInput = {
      energyKcal: parsed.energyKcal,
      proteinMinG: parsed.proteinMinG,
      proteinMaxG: parsed.proteinMaxG,
      fiberMinG: parsed.fiberMinG,
      fiberMaxG: parsed.fiberMaxG,
      waterMinMl: litersToMl(parsed.waterMinL),
      waterMaxMl: litersToMl(parsed.waterMaxL),
      objectives,
      patientNote: note.trim() || null,
    };

    setSaving(true);
    try {
      const saved = await savePatientNutritionGoals(patientId, input);
      onSaved(saved);
    } catch (err) {
      if (err instanceof NutritionGoalsApiError && err.status === 400) {
        const field = err.field ? SERVER_FIELD_TO_FORM[err.field] ?? "body" : "body";
        // Mensagens do backend falam em ml; o formulário fala em litros.
        const message = err.code.replace(/entre 500 e 8000 ml/, "entre 0,5 e 8 L");
        if (field === "body" || field === "objectives" || field === "patientNote") setFormError(message);
        else setFieldError({ field, message });
      } else if (err instanceof NutritionGoalsApiError && err.consentRevoked) {
        setFormError("O paciente revogou o acesso aos dados nutricionais.");
      } else {
        setFormError("Não foi possível salvar. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  function numberField(key: FieldKey, label: string, placeholder: string) {
    const id = `goal-${key}`;
    const invalid = fieldError?.field === key;
    return (
      <div className="field">
        <label className="label" htmlFor={id}>{label}</label>
        <input
          id={id}
          className={`input${invalid ? " input-invalid" : ""}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={values[key]}
          onChange={(e) => setValue(key, e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          disabled={saving}
        />
        {invalid && <div id={`${id}-error`} className="field-error" role="alert">{fieldError!.message}</div>}
      </div>
    );
  }

  function rangeRow(title: string, minKey: FieldKey, maxKey: FieldKey, unit: string, minPh: string, maxPh: string) {
    return (
      <fieldset className="nutritionGoalsEditor__range">
        <legend className="label">{title} <span className="muted">({unit})</span></legend>
        <div className="nutritionGoalsEditor__pair">
          {numberField(minKey, "Mínimo", minPh)}
          {numberField(maxKey, "Máximo (opcional)", maxPh)}
        </div>
      </fieldset>
    );
  }

  return (
    <DrawerShell open={open} onClose={onClose} ariaLabel="Ajustar metas diárias">
      <form className="nutritionGoalsEditor" onSubmit={handleSubmit} noValidate>
        <div>
          <h2 className="nutritionGoalsEditor__title">Ajustar metas diárias</h2>
          <p className="muted nutritionGoalsEditor__hint">
            Deixe em branco o que não quiser prescrever. Valor único: preencha só o mínimo.
          </p>
        </div>

        {numberField("energyKcal", "Calorias (kcal)", "Ex.: 2300")}
        {rangeRow("Proteínas", "proteinMinG", "proteinMaxG", "g", "Ex.: 150", "Ex.: 170")}
        {rangeRow("Fibras", "fiberMinG", "fiberMaxG", "g", "Ex.: 30", "Ex.: 40")}
        {rangeRow("Água", "waterMinL", "waterMaxL", "litros", "Ex.: 2,5", "Ex.: 3")}

        <fieldset className="nutritionGoalsEditor__range">
          <legend className="label">Objetivos <span className="muted">(até {MAX_OBJECTIVES})</span></legend>
          <div className="nutritionGoalsEditor__chips">
            {OBJECTIVES.map((o) => {
              const active = objectives.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-pressed={active}
                  disabled={saving || (!active && objectives.length >= MAX_OBJECTIVES)}
                  onClick={() => toggleObjective(o)}
                  // Mesmo chip ativo do NutritionTargetCard; o check garante que o
                  // estado não depende só de cor (regra do DS).
                  style={{
                    minHeight: 44,
                    ...(active
                      ? { background: "var(--color-primary-soft)", borderColor: "var(--color-primary)", color: "var(--color-text)" }
                      : {}),
                  }}
                >
                  {active && <Check size={14} aria-hidden="true" />}
                  {OBJECTIVE_LABELS[o]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="field">
          <label className="label" htmlFor="goal-note">Observação para o paciente</label>
          <textarea
            id="goal-note"
            className="input"
            rows={3}
            maxLength={NOTE_MAX}
            placeholder={NOTE_SUGGESTION}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
          />
          <div className="nutritionGoalsEditor__noteFooter">
            {!note.trim() && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNote(NOTE_SUGGESTION)} disabled={saving}>
                Usar texto sugerido
              </button>
            )}
            <span className="field-hint">{note.length}/{NOTE_MAX}</span>
          </div>
        </div>

        {formError && <div className="field-error" role="alert">{formError}</div>}

        <div className="nutritionGoalsEditor__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving} style={{ minHeight: 44 }}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ minHeight: 44 }}>
            {saving ? "Salvando..." : "Salvar metas"}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
}
