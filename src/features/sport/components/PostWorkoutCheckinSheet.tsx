import { useState } from 'react';
import type { WorkoutType } from '../engine/sportConfig.types';
import { usePostWorkoutCheckin } from '../hooks/usePostWorkoutCheckin';
import { RecoveryGapBadge } from './RecoveryGapBadge';

interface Props {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const WORKOUT_TYPE_OPTIONS: { value: WorkoutType; label: string }[] = [
  { value: 'sparring', label: 'Sparring' },
  { value: 'technical', label: 'Técnico' },
  { value: 'physical', label: 'Físico' },
  { value: 'competition', label: 'Competição' },
  { value: 'other', label: 'Outro' },
];

function ScaleInput({
  label,
  hint,
  value,
  onChange,
  max = 5,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>{label}</label>
        {hint && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((v) => (
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
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PostWorkoutCheckinSheet({ onClose, onSuccess }: Props) {
  const { submit, loading, error } = usePostWorkoutCheckin();
  const [workoutType, setWorkoutType] = useState<WorkoutType>('technical');
  const [durationMin, setDurationMin] = useState('');
  const [rpe, setRpe] = useState(5);
  const [muscleSorenessPost, setMuscleSorenessPost] = useState(1);
  const [jointSorenessPost, setJointSorenessPost] = useState(1);
  const [recoveryGap, setRecoveryGap] = useState<number | null | undefined>(undefined);

  async function handleSubmit() {
    const duration = parseInt(durationMin, 10);
    if (!durationMin || isNaN(duration) || duration < 1 || duration > 480) return;

    const result = await submit({
      workout_type: workoutType,
      duration_min: duration,
      rpe,
      muscle_soreness_post: muscleSorenessPost,
      joint_soreness_post: jointSorenessPost,
    }).catch(() => null);

    if (result) {
      setRecoveryGap(result.recovery_gap);
      setTimeout(async () => {
        await onSuccess();
      }, 1500);
    }
  }

  const showResult = recoveryGap !== undefined;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>
          Check-in pós-treino
        </h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 'var(--text-sm)' }}>
          ✕
        </button>
      </div>

      {showResult ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)', margin: 0 }}>
            Treino registrado!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RecoveryGapBadge gap={recoveryGap ?? null} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
              Tipo de treino
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {WORKOUT_TYPE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWorkoutType(value)}
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${value === workoutType ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: value === workoutType ? 'var(--color-primary)' : 'transparent',
                    color: value === workoutType ? 'var(--color-cta-text, #fff)' : 'var(--color-text)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
              Duração (minutos)
            </label>
            <input
              type="number"
              className="input"
              min={1}
              max={480}
              placeholder="Ex: 90"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>

          <ScaleInput label="RPE — esforço percebido" hint="1 = leve · 10 = máximo" value={rpe} onChange={setRpe} max={10} />
          <ScaleInput label="Dor muscular pós-treino" hint="1 = nenhuma · 5 = intensa" value={muscleSorenessPost} onChange={setMuscleSorenessPost} />
          <ScaleInput label="Dor articular pós-treino" hint="1 = nenhuma · 5 = intensa" value={jointSorenessPost} onChange={setJointSorenessPost} />

          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !durationMin}
            onClick={handleSubmit}
          >
            {loading ? 'Salvando…' : 'Registrar pós-treino'}
          </button>
        </>
      )}
    </div>
  );
}
