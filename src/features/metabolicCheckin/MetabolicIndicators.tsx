import type { MetricCardData } from './deriveIndicators';

export function MetabolicIndicators({ cards, onRegister, readOnly = false, title = 'Onde você está agora' }: {
  cards: MetricCardData[];
  onRegister?: () => void;
  /** Visão do profissional — esconde o link "registrar" nos cards vazios. */
  readOnly?: boolean;
  title?: string;
}) {
  if (cards.length === 0) return null;
  return (
    <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <div className="metabolic-eyebrow">Indicadores</div>
        <h2 className="metabolic-section-title">{title}</h2>
      </div>
      <div className="metabolic-metric-grid">
        {cards.map((card) => (
          <div key={card.key} className={`metabolic-metric${card.empty ? ' is-empty' : ''}`}>
            <span className="metabolic-metric-label">{card.label}</span>
            <span className={`metabolic-metric-value${card.tone ? ` ${card.tone}` : ''}`}>{card.value}</span>
            {card.empty ? (
              !readOnly && onRegister && <button type="button" className="metabolic-summary-link" onClick={onRegister}>registrar</button>
            ) : (
              card.hint && <span className="metabolic-metric-hint">{card.hint}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
