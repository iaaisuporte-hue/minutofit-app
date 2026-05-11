import { useEffect, useState } from "react";
import {
  fetchAdminDashboardMetrics,
  fetchAdminSubscriptionsReport,
  type AdminDashboardMetrics,
  type AdminSubscriptionsReport,
} from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div
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
      <div style={{ color: COLORS.muted, fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700 }}>{value}</div>
      {note ? <div style={{ color: COLORS.muted, fontSize: 13 }}>{note}</div> : null}
    </div>
  );
}

export default function AdminFinancePage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [report, setReport] = useState<AdminSubscriptionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [m, r] = await Promise.all([
          fetchAdminDashboardMetrics(),
          fetchAdminSubscriptionsReport(),
        ]);
        if (!cancelled) {
          setMetrics(m);
          setReport(r);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar sinais comerciais.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const newPaid30d = report
    ? report.recentSubscriptions.filter((s) => s.status === "active").length
    : null;

  const churn = report ? Number(report.churnLastMonth) : null;

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
        <div style={{ fontSize: 28, fontWeight: 700 }}>Sinais comerciais</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 820 }}>
          Recorrência, retenção e cobrança — leitura enxuta da saúde comercial da plataforma.
        </div>
      </div>

      {loading && (
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            padding: 18,
            color: COLORS.muted,
          }}
        >
          Carregando sinais comerciais…
        </div>
      )}

      {error && (
        <div
          style={{
            border: `1px solid ${COLORS.redBorder}`,
            borderRadius: 20,
            background: COLORS.redSoft,
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 700 }}>Não foi possível carregar os sinais</div>
          <div style={{ color: COLORS.muted, marginTop: 6, fontSize: 13 }}>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <KpiCard
              label="MRR atual"
              value={metrics ? formatCurrency(metrics.mrr) : "—"}
              note="receita recorrente mensal"
            />
            <KpiCard
              label="Receita aprovada total"
              value={metrics ? formatCurrency(metrics.totalRevenue) : "—"}
              note="pagamentos aprovados"
            />
            <KpiCard
              label="Novos planos ativos (30d)"
              value={newPaid30d !== null ? String(newPaid30d) : "—"}
              note="assinaturas ativas criadas no período"
            />
            <KpiCard
              label="Cancelamentos (30d)"
              value={churn !== null ? String(churn) : "—"}
              note="assinaturas canceladas no período"
            />
          </div>

          {report && report.activeByTier.length > 0 && (
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
              <div style={{ fontSize: 18, fontWeight: 700 }}>Mix de planos ativos</div>
              <div style={{ display: "grid", gap: 8 }}>
                {report.activeByTier.map((tier) => (
                  <div
                    key={tier.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.panelSoft,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{tier.name}</div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ color: COLORS.muted, fontSize: 13 }}>
                        {tier.count} assinaturas
                      </span>
                      <span style={{ color: COLORS.muted, fontSize: 13 }}>
                        {formatCurrency(Number(tier.monthly_revenue))} /mês
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <div style={{ fontSize: 18, fontWeight: 700 }}>Transações</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
              Listagem de transações individuais estará disponível quando o endpoint de pagamentos for liberado.
            </div>
            <div
              style={{
                padding: "24px 0",
                color: COLORS.muted,
                textAlign: "center",
                fontSize: 13,
              }}
            >
              Nenhum histórico para exibir agora.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
