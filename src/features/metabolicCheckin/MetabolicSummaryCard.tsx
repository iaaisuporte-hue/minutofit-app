import type { MetabolicNarrative } from './deriveMetabolicNarrative';

export function MetabolicSummaryCard({ narrative, onAction }: { narrative: MetabolicNarrative; onAction: () => void }) {
  return (
    <section className={`metabolic-summary metabolic-summary--${narrative.tone}`} aria-label="Resumo inteligente">
      <div className="metabolic-eyebrow">Resumo inteligente</div>
      <h2 className="metabolic-section-title">{narrative.headline}</h2>
      <p className="metabolic-summary-body">{narrative.body}</p>
      {narrative.nextAction && (
        <button type="button" className="metabolic-summary-link" onClick={onAction}>
          {narrative.nextAction} <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
