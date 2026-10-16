/**
 * Aviso que substitui, no app empacotado, as telas onde a academia lida com
 * dinheiro (valores de mensalidade, cobrança, histórico de pagamento).
 *
 * A regra 3.1.1 das lojas trata preço e caminho de pagamento fora da compra
 * in-app — e, fora da storefront dos EUA, também a indicação de onde pagar
 * ("vá para a versão web"). Por isso o aviso diz só que a área não está no app.
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
          {descricao} Esta área não está disponível no app.
        </p>
      </div>
    </div>
  );
}
