import { AcademyUpgradeButton } from "./AcademyUpgradeButton";

/**
 * Card de upsell exibido no lugar do bloco de inteligência quando a academia
 * está no Free. Free=operação · Pro=inteligência (Spec 015).
 */
export function IntelligenceUpsellCard() {
  return (
    <div className="dash-section" style={{ marginTop: "var(--space-6)" }}>
      <div
        className="section-card"
        style={{ display: "grid", gap: "var(--space-3)", padding: "var(--space-5)" }}
      >
        <div className="dash-eyebrow">Inteligência de retenção</div>
        <h2 className="section-card__title" style={{ margin: 0 }}>
          Entenda, retenha e evolua seus alunos
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", maxWidth: 560 }}>
          Você usa o S2Core de graça para operar. O <strong>Pro</strong> destrava a inteligência
          MaaS: alunos em risco de churn, score metabólico da base, aderência, sinais por horário
          e profissional, e recomendações de reengajamento.
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", display: "grid", gap: 4 }}>
          <li>Alunos em risco e queda de frequência</li>
          <li>Score metabólico agregado e aderência</li>
          <li>Sinais comerciais e horário de pico</li>
        </ul>
        <div style={{ marginTop: "var(--space-2)" }}>
          <AcademyUpgradeButton label="Assinar o Pro" />
        </div>
      </div>
    </div>
  );
}
