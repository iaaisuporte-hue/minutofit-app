import { useStudentFightIntel } from '../hooks/useStudentFightIntel';
import { RecoveryGapBadge } from './RecoveryGapBadge';
import { SportFatigueIndicator } from './SportFatigueIndicator';

interface Props {
  studentId: number;
}

const RISK_COLORS: Record<string, string> = {
  low: 'var(--color-success)',
  moderate: 'var(--color-warn)',
  high: 'var(--color-danger)',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Baixo',
  moderate: 'Moderado',
  high: 'Alto',
};

export function StudentFightIntelCard({ studentId }: Props) {
  const { data, loading } = useStudentFightIntel(studentId);

  if (loading) {
    return (
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-4)', background: 'var(--color-surface)', opacity: 0.6 }}>
        <div style={{ height: 14, width: '40%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 10, width: '70%', background: 'var(--color-border)', borderRadius: 4 }} />
      </div>
    );
  }

  if (data === null || data.sport === null) return null;

  const { sport } = data;
  const { readiness_today, last_recovery_gap, fatigue_7d, fatigue_level, sessions_7d, active_camp } = sport;
  const daysRemaining = active_camp
    ? Math.max(0, Math.ceil((new Date(active_camp.event_date).getTime() - Date.now()) / 86_400_000))
    : null;
  const showCampBadge = daysRemaining !== null && daysRemaining <= 21;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-5)', background: 'var(--color-surface)', display: 'grid', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text)', margin: 0 }}>
          Fight Intelligence
        </h3>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {sport.profile.primary_sport}
        </span>
      </div>

      {showCampBadge && active_camp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--color-warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warn) 30%, transparent)', fontSize: 'var(--text-xs)', color: 'var(--color-text)' }}>
          <span style={{ fontWeight: 'var(--font-semibold)' }}>Atleta em Preparação:</span>
          <span>{active_camp.event_name} — {daysRemaining}d</span>
          {active_camp.current_weight_kg != null && active_camp.target_weight_kg != null && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {active_camp.current_weight_kg}kg → {active_camp.target_weight_kg}kg
            </span>
          )}
        </div>
      )}

      {readiness_today ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Prontidão hoje</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)' }}>
              {Math.round(readiness_today.final_score)}
            </div>
          </div>
          {readiness_today.risk_level && (
            <span style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-semibold)',
              color: RISK_COLORS[readiness_today.risk_level] ?? 'var(--color-text-muted)',
              background: `color-mix(in srgb, ${RISK_COLORS[readiness_today.risk_level] ?? 'var(--color-text-muted)'} 12%, transparent)`,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
            }}>
              Risco {RISK_LABELS[readiness_today.risk_level] ?? readiness_today.risk_level}
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Sem check-in pré-treino hoje.
        </div>
      )}

      <SportFatigueIndicator fatigue7d={fatigue_7d} level={fatigue_level} sessions7d={sessions_7d} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Último recovery gap:</span>
        <RecoveryGapBadge gap={last_recovery_gap} />
      </div>
    </div>
  );
}
