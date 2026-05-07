import { COLORS } from "../../styles/colors";

export default function AdminFinancePage() {
  const metrics = [
    { title: "Receita do mês", value: "R$ 48.320", note: "+12% vs mês anterior" },
    { title: "MRR atual", value: "R$ 41.700", note: "base recorrente estimada" },
    { title: "Inadimplência", value: "3,8%", note: "cartões e pix pendente" },
    { title: "Upgrades recentes", value: "14", note: "últimos 30 dias" },
  ];

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>Financeiro</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 820 }}>
          Painel de leitura financeira do produto: receita, recorrência, pagamentos falhos e sinais de retenção ligados a cobrança.
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {metrics.map((item) => (
          <div
            key={item.title}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              background: COLORS.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 18,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 13 }}>{item.title}</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{item.value}</div>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>{item.note}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>Pagamentos recentes</div>
        <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
          Integração com histórico de pagamentos via Mercado Pago em desenvolvimento.
        </div>
        <div style={{ padding: "20px 0", color: COLORS.muted, textAlign: "center" }}>
          Histórico de pagamentos em tempo real em breve.
        </div>
      </div>
    </div>
  );
}
