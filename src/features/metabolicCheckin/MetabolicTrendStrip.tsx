import { computeMetabolicTrends } from './computeMetabolicTrends';
import type { MetabolicCheckinRecord } from './types';
import './metabolicCheckin.css';

interface Props {
  records: MetabolicCheckinRecord[];
  loading?: boolean;
  compact?: boolean;
}

export function MetabolicTrendStrip({ records, loading = false, compact = false }: Props) {
  const trends = computeMetabolicTrends(records);

  if (loading) {
    return (
      <div className="metabolic-trend-strip" style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <div className="metabolic-eyebrow">Tendências em formação</div>
        <p className="metabolic-section-copy">Carregando suas atualizações recentes...</p>
      </div>
    );
  }

  if (trends.length === 0) {
    return compact ? null : (
      <div className="metabolic-trend-strip" style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <div className="metabolic-eyebrow">Tendências em formação</div>
        <p className="metabolic-section-copy">Depois de duas atualizações, o S2Core passa a mostrar mudanças de peso, cintura e outros sinais ao longo do tempo.</p>
      </div>
    );
  }

  return (
    <div className="metabolic-trend-strip" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <div className="metabolic-eyebrow">Tendências recentes</div>
        <h3 className="metabolic-section-title">Sua evolução além do score</h3>
      </div>
      <div className="metabolic-trend-grid">
        {trends.map((trend) => (
          <div className="metabolic-trend-item" key={trend.key}>
            <div className="metabolic-eyebrow">{trend.label}</div>
            <div className={`metabolic-trend-value ${trend.tone}`}>{trend.value}</div>
            <p className="metabolic-section-copy" style={{ fontSize: 'var(--text-sm)' }}>em {trend.sinceLabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
