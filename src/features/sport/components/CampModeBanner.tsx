import { useNavigate } from 'react-router-dom';
import type { CampWithDerived, CampPhase } from '../engine/sportConfig.types';

const PHASE_LABELS: Record<CampPhase, string> = {
  base: 'Fase base',
  specific: 'Fase específica',
  peak: 'Peak week',
  taper: 'Taper',
};

interface Props {
  camp: CampWithDerived;
}

export function CampModeBanner({ camp }: Props) {
  const navigate = useNavigate();
  const urgency = camp.days_remaining <= 7 ? 'high' : camp.days_remaining <= 21 ? 'medium' : 'low';

  const borderColor =
    urgency === 'high' ? 'var(--color-danger)' :
    urgency === 'medium' ? 'var(--color-warn)' :
    'var(--color-primary)';

  const badgeColor =
    urgency === 'high' ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)' :
    urgency === 'medium' ? 'color-mix(in srgb, var(--color-warn) 12%, transparent)' :
    'color-mix(in srgb, var(--color-primary) 10%, transparent)';

  const textColor =
    urgency === 'high' ? 'var(--color-danger)' :
    urgency === 'medium' ? 'var(--color-warn)' :
    'var(--color-primary)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/app/user/sport/camps')}
      onKeyDown={(e) => e.key === 'Enter' && navigate('/app/user/sport/camps')}
      style={{
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4) var(--space-5)',
        cursor: 'pointer',
        display: 'grid',
        gap: 'var(--space-2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-semibold)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: badgeColor,
            color: textColor,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Camp Mode
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {PHASE_LABELS[camp.camp_phase]}
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: textColor }}>
          {camp.days_remaining}d
        </span>
      </div>

      <div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
          {camp.event_name}
        </div>
        {camp.target_weight_kg && camp.current_weight_kg && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Peso atual: <strong style={{ color: 'var(--color-text)' }}>{Number(camp.current_weight_kg).toFixed(1)} kg</strong>
            {' '}· Alvo: <strong style={{ color: textColor }}>{Number(camp.target_weight_kg).toFixed(1)} kg</strong>
            {' '}({(Number(camp.current_weight_kg) - Number(camp.target_weight_kg)).toFixed(1)} kg a perder)
          </div>
        )}
      </div>
    </div>
  );
}
