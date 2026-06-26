import type { ScreenInsight } from './deriveScreenInsights';

export function MetabolicInsightList({ insights }: { insights: ScreenInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <div className="metabolic-eyebrow">Sinais recentes</div>
        <h2 className="metabolic-section-title">O que está acontecendo</h2>
      </div>
      <ul className="metabolic-insight-list">
        {insights.map((insight) => (
          <li key={insight.id} className={`metabolic-insight metabolic-insight--${insight.tone}`}>
            <span className="metabolic-insight-dot" aria-hidden="true" />
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
