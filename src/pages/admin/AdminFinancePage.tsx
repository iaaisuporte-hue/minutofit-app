import { adminPayments } from "./adminData";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
};

function statusVisual(status: string) {
  if (status === "pago") return { bg: "rgba(29,185,84,.14)", border: "rgba(29,185,84,.28)", color: "#7CFF6B" };
  if (status === "falhou") return { bg: "rgba(255,110,110,.10)", border: "rgba(255,110,110,.28)", color: "#FF9C9C" };
  if (status === "pendente") return { bg: "rgba(255,200,80,.12)", border: "rgba(255,200,80,.28)", color: "#FFD36C" };
  return { bg: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.14)", color: "rgba(255,255,255,.78)" };
}

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
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Financeiro</div>
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
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 18,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 13 }}>{item.title}</div>
            <div style={{ fontSize: 34, fontWeight: 1000 }}>{item.value}</div>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>{item.note}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 1000 }}>Pagamentos recentes</div>
        <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
          Aqui é onde o admin começa a ler falhas de cobrança, status de recebimento e impacto em retenção.
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {adminPayments.map((payment) => {
            const visual = statusVisual(payment.status);
            return (
              <div
                key={payment.id}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>{payment.studentName}</div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    {payment.plan} • {payment.method} • vencimento {payment.dueDate}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 1000 }}>{payment.amount}</div>
                  <div
                    style={{
                      borderRadius: 999,
                      padding: "8px 12px",
                      border: `1px solid ${visual.border}`,
                      background: visual.bg,
                      color: visual.color,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {payment.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
