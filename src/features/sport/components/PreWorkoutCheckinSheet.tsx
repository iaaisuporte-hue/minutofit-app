import { useState } from 'react';
import { submitPreWorkoutCheckin } from '../services/sportApi';

interface Props {
  onSuccess?: () => void;
  onClose?: () => void;
}

const SCALE_LABELS: Record<number, string> = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

function ScaleInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>{label}</label>
        {hint && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              padding: 'var(--space-2) 0',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${v === value ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: v === value ? 'var(--color-primary)' : 'transparent',
              color: v === value ? 'var(--color-cta-text, #fff)' : 'var(--color-text)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              cursor: 'pointer',
            }}
          >
            {SCALE_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PreWorkoutCheckinSheet({ onSuccess, onClose }: Props) {
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [muscleSoreness, setMuscleSoreness] = useState(1);
  const [jointSoreness, setJointSoreness] = useState(1);
  const [stressLevel, setStressLevel] = useState(2);
  const [hydrationOk, setHydrationOk] = useState(true);
  const [motivation, setMotivation] = useState(3);
  const [perceivedReadiness, setPerceivedReadiness] = useState(3);
  const [weightKg, setWeightKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitPreWorkoutCheckin({
        sleep_quality: sleepQuality,
        energy_level: energyLevel,
        muscle_soreness: muscleSoreness,
        joint_soreness: jointSoreness,
        stress_level: stressLevel,
        hydration_ok: hydrationOk,
        weight_kg: weightKg ? parseFloat(weightKg) : undefined,
        motivation,
        perceived_readiness: perceivedReadiness,
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar check-in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>
          Check-in pré-treino
        </h2>
        {onClose && (
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 'var(--text-sm)' }}>
            ✕
          </button>
        )}
      </div>

      <ScaleInput label="Qualidade do sono" hint="1 = péssimo · 5 = excelente" value={sleepQuality} onChange={setSleepQuality} />
      <ScaleInput label="Nível de energia" hint="1 = exausto · 5 = cheio de energia" value={energyLevel} onChange={setEnergyLevel} />
      <ScaleInput label="Dor muscular" hint="1 = nenhuma · 5 = intensa" value={muscleSoreness} onChange={setMuscleSoreness} />
      <ScaleInput label="Dor articular" hint="1 = nenhuma · 5 = intensa" value={jointSoreness} onChange={setJointSoreness} />
      <ScaleInput label="Estresse" hint="1 = relaxado · 5 = muito estressado" value={stressLevel} onChange={setStressLevel} />
      <ScaleInput label="Motivação" hint="1 = sem vontade · 5 = muito motivado" value={motivation} onChange={setMotivation} />
      <ScaleInput label="Prontidão percebida" hint="1 = não estou pronto · 5 = pronto para dar tudo" value={perceivedReadiness} onChange={setPerceivedReadiness} />

      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
          Hidratação ok?
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={hydrationOk} onChange={(e) => setHydrationOk(e.target.checked)} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Sim, estou bem hidratado</span>
        </label>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
          Peso atual (kg) <span style={{ color: 'var(--color-text-muted)' }}>— opcional</span>
        </label>
        <input
          type="number"
          className="input"
          step="0.1"
          min="30"
          max="200"
          placeholder="Ex: 78.5"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
      )}

      <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Salvando…' : 'Registrar pré-treino'}
      </button>
    </div>
  );
}
