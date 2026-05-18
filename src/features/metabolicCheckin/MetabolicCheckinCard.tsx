import type { MetabolicNudgeState } from './types';
import './metabolicCheckin.css';

interface Props {
  nudge: MetabolicNudgeState;
  loading?: boolean;
  onOpen: () => void;
}

export function MetabolicCheckinCard({ nudge, loading = false, onOpen }: Props) {
  if (!nudge.shouldShow) return null;

  return (
    <div className="metabolic-checkin-card" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 'var(--space-1)', maxWidth: 560 }}>
          <div className="metabolic-eyebrow">Atualização leve</div>
          <h3 className="metabolic-section-title">{nudge.title}</h3>
          <p className="metabolic-section-copy">{nudge.description}</p>
        </div>
        <button type="button" className="btn btn-accent" onClick={onOpen} disabled={loading}>
          Fazer check-in
        </button>
      </div>
    </div>
  );
}
