/**
 * Aviso que substitui, no app empacotado, as telas onde a academia lida com
 * dinheiro (valores de mensalidade, cobrança, histórico de pagamento).
 *
 * Mesmo padrão e mesma copy do `AcademyUpgradeButton`/`MySubscriptionsSection`:
 * a regra 3.1.1 das lojas trata preço e caminho de pagamento fora da compra
 * in-app, e essas duas telas eram as únicas superfícies de valor da área de
 * academia que ainda não tinham o gate.
 */
export function AcademyWebOnlyPanel({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Academia</div>
          <h1 className="page-title">{titulo}</h1>
        </div>
      </div>
      <div className="section-card">
        <p style={{ color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {descricao} Gerencie o plano da academia na versão web do S2Core.
        </p>
      </div>
    </div>
  );
}
