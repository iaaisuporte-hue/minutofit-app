import type { MetabolicNarrative } from './deriveMetabolicNarrative';

export function MetabolicSummaryCard({ narrative, onAction }: { narrative: MetabolicNarrative; onAction: () => void }) {
  return (
    <section className={`metabolic-summary metabolic-summary--${narrative.tone}`} aria-label="Resumo inteligente">
      <div className="metabolic-eyebrow">Resumo inteligente</div>
      <h2 className="metabolic-section-title">{narrative.headline}</h2>
      <p className="metabolic-summary-body">{narrative.body}</p>
      {narrative.nextAction && (
        <div className="metabolic-summary-action">
          <span>{narrative.nextAction}</span>
          <button type="button" className="btn btn-accent" onClick={onAction}>Adicionar</button>
        </div>
      )}
    </section>
  );
}
