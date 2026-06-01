import { useCallback, useEffect, useState } from "react";
import {
  fetchAdaptationPolicy,
  patchAdaptationPolicy,
  type AdaptationPolicy,
} from "../../../services/trainingAdaptiveApi";

const DEFAULT_POLICY: AdaptationPolicy = {
  personalId: 0, studentId: 0, academyId: null, version: 0,
  masterEnabled: false,
  allowVolumeReduction: false, allowRestIncrease: false,
  allowIntensityReduction: false, allowActiveRecoverySubstitution: false,
  allowMobilitySuggestion: false,
  maxSetReductionPct: 25, maxRestIncreasePct: 30, minIntensityPct: 70,
};

// Maps UI preset labels to clamp values
const INTENSITY_PRESETS = [
  { label: 'Conservador', maxSetReductionPct: 20, maxRestIncreasePct: 20, minIntensityPct: 80 },
  { label: 'Moderado',    maxSetReductionPct: 25, maxRestIncreasePct: 30, minIntensityPct: 70 },
  { label: 'Agressivo',   maxSetReductionPct: 40, maxRestIncreasePct: 50, minIntensityPct: 60 },
];

function detectPreset(policy: AdaptationPolicy): number {
  return INTENSITY_PRESETS.findIndex(
    p =>
      p.maxSetReductionPct === policy.maxSetReductionPct &&
      p.maxRestIncreasePct === policy.maxRestIncreasePct &&
      p.minIntensityPct === policy.minIntensityPct,
  );
}

interface Props {
  studentId: number;
}

export function AdaptationPolicyPanel({ studentId }: Props) {
  const [policy, setPolicy] = useState<AdaptationPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdaptationPolicy(studentId)
      .then(p => { setPolicy(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId]);

  const save = useCallback(
    async (patch: Partial<AdaptationPolicy>) => {
      setSaving(true);
      setError(null);
      try {
        const updated = await patchAdaptationPolicy(studentId, patch);
        setPolicy(updated);
      } catch {
        setError('Erro ao salvar configuração.');
      } finally {
        setSaving(false);
      }
    },
    [studentId],
  );

  const toggle = (field: keyof AdaptationPolicy) =>
    save({ [field]: !policy[field] });

  const presetIdx = detectPreset(policy);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Carregando...</p>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Master switch */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Adaptação automática</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 340, lineHeight: 1.5 }}>
            Quando ativo, a ficha deste aluno é ajustada automaticamente nos limites que você definir,
            com base no check-in diário. A responsabilidade técnica permanece integralmente sua.
          </div>
        </div>
        <ToggleSwitch
          checked={policy.masterEnabled}
          onChange={() => toggle('masterEnabled')}
          disabled={saving}
        />
      </div>

      {policy.masterEnabled && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 0 }} />

          {/* Permissions */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Permitir
            </div>
            {[
              { field: 'allowVolumeReduction' as const,             label: 'Reduzir volume (séries / reps)' },
              { field: 'allowRestIncrease' as const,                label: 'Aumentar descanso entre séries' },
              { field: 'allowIntensityReduction' as const,          label: 'Reduzir intensidade (RPE)' },
              { field: 'allowMobilitySuggestion' as const,          label: 'Sugerir mobilidade como complemento' },
              { field: 'allowActiveRecoverySubstitution' as const,  label: 'Sugerir recuperação ativa (para estado vermelho)' },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(policy[field])}
                  onChange={() => toggle(field)}
                  disabled={saving}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                />
                <span style={{ fontSize: 13 }}>{label}</span>
              </label>
            ))}
          </div>

          {/* Intensity preset */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Intensidade do ajuste
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {INTENSITY_PRESETS.map((p, i) => (
                <button
                  key={i}
                  disabled={saving}
                  onClick={() => save({ maxSetReductionPct: p.maxSetReductionPct, maxRestIncreasePct: p.maxRestIncreasePct, minIntensityPct: p.minIntensityPct })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: presetIdx === i ? 'var(--color-primary)' : 'var(--color-border)',
                    background: presetIdx === i ? 'var(--color-primary-soft)' : 'transparent',
                    color: presetIdx === i ? 'var(--color-primary)' : 'var(--color-text)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {saving && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Salvando...</p>}
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: checked ? 'var(--color-primary, #22c55e)' : 'var(--color-border, #ccc)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}
