import type { MetabolicNarrative } from './deriveMetabolicNarrative';

export function MetabolicSummaryCard({ narrative, onAction, readOnly = false }: {
  narrative: MetabolicNarrative;
  onAction?: () => void;
  /** Visão do profissional — esconde o CTA de registro (read-only). */
  readOnly?: boolean;
}) {
  return (
    <section className={`metabolic-summary metabolic-summary--${narrative.tone}`} aria-label="Resumo inteligente">
      <div className="metabolic-eyebrow">Resumo inteligente</div>
      <h2 className="metabolic-section-title">{narrative.headline}</h2>
      <p className="metabolic-summary-body">{narrative.body}</p>
      {!readOnly && narrative.nextAction && (
        <button type="button" className="metabolic-summary-link" onClick={() => onAction?.()}>
          {narrative.nextAction} <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
