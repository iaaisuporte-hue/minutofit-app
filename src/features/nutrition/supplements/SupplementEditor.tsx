import { useState } from "react";
import { DrawerShell } from "../../../components/overlay/DrawerShell";
import {
  SupplementApiError,
  createPatientSupplement,
  updatePatientSupplement,
  type DoseUnit,
  type Supplement,
  type SupplementFields,
  type SupplementFrequency,
} from "../../../services/supplementsApi";
import { parseDecimalInput, toInputValue } from "../goals/formatGoals";
import { DOSE_UNITS, DOSE_UNIT_LABELS, FREQUENCIES, FREQUENCY_LABELS } from "./supplementLabels";

type TextKey = "name" | "frequencyDetail" | "timing" | "purpose" | "notes" | "startDate" | "endDate";

/**
 * Cadastro/edição de orientação de suplementação (Spec 040). Tudo que o
 * paciente vê sai daqui, digitado pelo nutri: não há dose sugerida nem
 * preenchimento automático. Limites e datas são validados no backend; o
 * cliente só converte a quantidade PT-BR e mostra o erro no campo nomeado.
 */
export function SupplementEditor({
  patientId,
  supplement,
  onClose,
  onSaved,
}: {
  patientId: number;
  /** Ausente = nova orientação. */
  supplement: Supplement | null;
  onClose: () => void;
  onSaved: (saved: Supplement) => void;
}) {
  const [text, setText] = useState<Record<TextKey, string>>({
    name: supplement?.name ?? "",
    frequencyDetail: supplement?.frequencyDetail ?? "",
    timing: supplement?.timing ?? "",
    purpose: supplement?.purpose ?? "",
    notes: supplement?.notes ?? "",
    startDate: supplement?.startDate ?? "",
    endDate: supplement?.endDate ?? "",
  });
  const [dose, setDose] = useState(toInputValue(supplement?.doseAmount ?? null));
  // Sem unidade/frequência pré-escolhidas: o nutri escolhe conscientemente.
  const [unit, setUnit] = useState<DoseUnit | "">(supplement?.doseUnit ?? "");
  const [frequency, setFrequency] = useState<SupplementFrequency | "">(supplement?.frequency ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const setField = (k: TextKey, v: string) => {
    setText((p) => ({ ...p, [k]: v }));
    if (fieldError?.field === k) setFieldError(null);
  };
  const errorFor = (field: string) => (fieldError?.field === field ? fieldError.message : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFieldError(null);
    setFormError(null);

    const doseAmount = parseDecimalInput(dose);
    if (doseAmount == null || Number.isNaN(doseAmount)) {
      setFieldError({ field: "doseAmount", message: "Informe a quantidade em números." });
      return;
    }
    if (!unit) return setFieldError({ field: "doseUnit", message: "Escolha a unidade." });
    if (!frequency) return setFieldError({ field: "frequency", message: "Escolha a frequência." });

    const opt = (k: TextKey) => text[k].trim() || null;
    const fields: SupplementFields = {
      name: text.name.trim(),
      doseAmount,
      doseUnit: unit,
      frequency,
      frequencyDetail: opt("frequencyDetail"),
      timing: opt("timing"),
      purpose: opt("purpose"),
      notes: opt("notes"),
      startDate: opt("startDate"),
      endDate: opt("endDate"),
    };

    setSaving(true);
    try {
      const saved = supplement
        ? await updatePatientSupplement(patientId, supplement.id, fields)
        : await createPatientSupplement(patientId, fields);
      onSaved(saved);
    } catch (err) {
      if (err instanceof SupplementApiError && err.status === 400 && err.field && err.field !== "body") {
        setFieldError({ field: err.field, message: err.code });
      } else if (err instanceof SupplementApiError && err.consentRevoked) {
        setFormError("O paciente revogou o acesso aos dados nutricionais.");
      } else if (err instanceof SupplementApiError && err.status === 409) {
        setFormError("Esta orientação foi encerrada e não pode mais ser alterada.");
      } else {
        setFormError("Não foi possível salvar. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputProps = (field: string) => {
    const msg = errorFor(field);
    return {
      id: `supp-${field}`,
      className: `input${msg ? " input-invalid" : ""}`,
      "aria-invalid": Boolean(msg),
      "aria-describedby": msg ? `supp-${field}-error` : undefined,
      disabled: saving,
    };
  };
  const errorLine = (field: string) => {
    const msg = errorFor(field);
    return msg ? <div id={`supp-${field}-error`} className="field-error" role="alert">{msg}</div> : null;
  };

  return (
    <DrawerShell open onClose={onClose} ariaLabel={supplement ? "Editar suplementação" : "Nova suplementação"}>
      <form className="nutritionGoalsEditor" onSubmit={handleSubmit} noValidate>
        <h2 className="nutritionGoalsEditor__title">{supplement ? "Editar suplementação" : "Nova suplementação"}</h2>

        <div className="field">
          <label className="label" htmlFor="supp-name">Suplemento</label>
          <input {...inputProps("name")} autoComplete="off" placeholder="Ex.: Creatina monohidratada" maxLength={120} value={text.name} onChange={(e) => setField("name", e.target.value)} />
          {errorLine("name")}
        </div>

        <div className="nutritionGoalsEditor__pair">
          <div className="field">
            <label className="label" htmlFor="supp-doseAmount">Quantidade</label>
            <input {...inputProps("doseAmount")} inputMode="decimal" autoComplete="off" value={dose} onChange={(e) => { setDose(e.target.value); if (fieldError?.field === "doseAmount") setFieldError(null); }} />
            {errorLine("doseAmount")}
          </div>
          <div className="field">
            <label className="label" htmlFor="supp-doseUnit">Unidade</label>
            <select {...inputProps("doseUnit")} value={unit} onChange={(e) => { setUnit(e.target.value as DoseUnit); if (fieldError?.field === "doseUnit") setFieldError(null); }}>
              <option value="" disabled>Escolha</option>
              {DOSE_UNITS.map((u) => <option key={u} value={u}>{DOSE_UNIT_LABELS[u][1]}</option>)}
            </select>
            {errorLine("doseUnit")}
          </div>
        </div>

        <div className="nutritionGoalsEditor__pair">
          <div className="field">
            <label className="label" htmlFor="supp-frequency">Frequência</label>
            <select {...inputProps("frequency")} value={frequency} onChange={(e) => { setFrequency(e.target.value as SupplementFrequency); if (fieldError?.field === "frequency") setFieldError(null); }}>
              <option value="" disabled>Escolha</option>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
            </select>
            {errorLine("frequency")}
          </div>
          <div className="field">
            <label className="label" htmlFor="supp-frequencyDetail">Detalhe (opcional)</label>
            <input {...inputProps("frequencyDetail")} autoComplete="off" placeholder="Ex.: seg, qua, sex" maxLength={80} value={text.frequencyDetail} onChange={(e) => setField("frequencyDetail", e.target.value)} />
            {errorLine("frequencyDetail")}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="supp-timing">Horário sugerido (opcional)</label>
          <input {...inputProps("timing")} autoComplete="off" placeholder="Ex.: junto com o almoço" maxLength={80} value={text.timing} onChange={(e) => setField("timing", e.target.value)} />
          {errorLine("timing")}
        </div>

        <div className="field">
          <label className="label" htmlFor="supp-purpose">Finalidade (opcional)</label>
          <input {...inputProps("purpose")} autoComplete="off" maxLength={200} value={text.purpose} onChange={(e) => setField("purpose", e.target.value)} />
          {errorLine("purpose")}
        </div>

        <div className="field">
          <label className="label" htmlFor="supp-notes">Observações e cuidados (opcional)</label>
          <textarea {...inputProps("notes")} rows={3} maxLength={1000} value={text.notes} onChange={(e) => setField("notes", e.target.value)} />
          {errorLine("notes")}
        </div>

        <div className="nutritionGoalsEditor__pair">
          <div className="field">
            <label className="label" htmlFor="supp-startDate">Início (opcional)</label>
            <input {...inputProps("startDate")} type="date" value={text.startDate} onChange={(e) => setField("startDate", e.target.value)} />
            {errorLine("startDate")}
          </div>
          <div className="field">
            <label className="label" htmlFor="supp-endDate">Término (opcional)</label>
            <input {...inputProps("endDate")} type="date" value={text.endDate} onChange={(e) => setField("endDate", e.target.value)} />
            {errorLine("endDate")}
          </div>
        </div>

        {formError && <div className="field-error" role="alert">{formError}</div>}

        <div className="nutritionGoalsEditor__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving} style={{ minHeight: 44 }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ minHeight: 44 }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
}
