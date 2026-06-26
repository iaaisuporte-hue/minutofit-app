import { useMemo, useState } from 'react';
import type { MetabolicCheckinInput } from './types';
import './metabolicCheckin.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: MetabolicCheckinInput) => Promise<void>;
  /** Campo a focar ao abrir (vindo do seletor de tipo de registro). */
  initialField?: keyof MetabolicCheckinInput | null;
}

type FormState = Record<keyof MetabolicCheckinInput, string>;

const EMPTY_FORM: FormState = {
  weightKg: '',
  waistCm: '',
  bodyFatPct: '',
  systolicMmhg: '',
  diastolicMmhg: '',
  fastingGlucoseMgdl: '',
  notes: '',
};

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function MetabolicCheckinModal({ open, onClose, onSave, initialField }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMetric = useMemo(
    () => ['weightKg', 'waistCm', 'bodyFatPct', 'systolicMmhg', 'diastolicMmhg', 'fastingGlucoseMgdl'].some((key) => form[key as keyof FormState].trim()),
    [form]
  );

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasMetric) {
      setError('Preencha pelo menos uma atualização para salvar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        weightKg: numberOrNull(form.weightKg),
        waistCm: numberOrNull(form.waistCm),
        bodyFatPct: numberOrNull(form.bodyFatPct),
        systolicMmhg: numberOrNull(form.systolicMmhg),
        diastolicMmhg: numberOrNull(form.diastolicMmhg),
        fastingGlucoseMgdl: numberOrNull(form.fastingGlucoseMgdl),
        notes: form.notes.trim() || null,
      });
      setForm(EMPTY_FORM);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não conseguimos salvar sua atualização.');
    } finally {
      setSaving(false);
    }
  }

  const setField = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="metabolic-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="metabolic-checkin-title">
      <form className="metabolic-modal-panel" onSubmit={submit}>
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <div className="metabolic-eyebrow">Check-in metabólico</div>
          <h2 id="metabolic-checkin-title" className="metabolic-section-title">Atualize só o que você tem hoje</h2>
          <p className="metabolic-section-copy">Pode preencher um único campo. O S2Core usa esses sinais para enxergar tendência ao longo do tempo.</p>
        </div>

        {error && <div className="badge badge-warn" role="alert">{error}</div>}

        <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div className="metabolic-eyebrow">Composição</div>
          <div className="metabolic-form-grid">
            <label className="metabolic-field"><span>Peso (kg)</span><input type="number" step="0.1" inputMode="decimal" autoFocus={initialField === 'weightKg'} value={form.weightKg} onChange={(e) => setField('weightKg', e.target.value)} /></label>
            <label className="metabolic-field"><span>Cintura (cm)</span><input type="number" step="0.1" inputMode="decimal" autoFocus={initialField === 'waistCm'} value={form.waistCm} onChange={(e) => setField('waistCm', e.target.value)} /></label>
            <label className="metabolic-field"><span>% gordura</span><input type="number" step="0.1" inputMode="decimal" value={form.bodyFatPct} onChange={(e) => setField('bodyFatPct', e.target.value)} /></label>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div className="metabolic-eyebrow">Pressão</div>
          <div className="metabolic-form-grid">
            <label className="metabolic-field"><span>Sistólica</span><input type="number" inputMode="numeric" autoFocus={initialField === 'systolicMmhg'} value={form.systolicMmhg} onChange={(e) => setField('systolicMmhg', e.target.value)} /></label>
            <label className="metabolic-field"><span>Diastólica</span><input type="number" inputMode="numeric" value={form.diastolicMmhg} onChange={(e) => setField('diastolicMmhg', e.target.value)} /></label>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div className="metabolic-eyebrow">Glicemia</div>
          <div className="metabolic-form-grid">
            <label className="metabolic-field"><span>Jejum (mg/dL)</span><input type="number" inputMode="numeric" autoFocus={initialField === 'fastingGlucoseMgdl'} value={form.fastingGlucoseMgdl} onChange={(e) => setField('fastingGlucoseMgdl', e.target.value)} /></label>
          </div>
        </section>

        <label className="metabolic-field"><span>Nota opcional</span><textarea autoFocus={initialField === 'notes'} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Ex.: semana com sono melhor, rotina mais leve..." /></label>

        <div className="metabolic-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn-accent" disabled={saving}>{saving ? 'Salvando...' : 'Salvar atualização'}</button>
        </div>
      </form>
    </div>
  );
}
