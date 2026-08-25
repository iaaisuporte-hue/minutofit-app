import { useEffect, useState } from "react";
import {
  fetchAdminDashboardMetrics,
  fetchAdminSubscriptionsReport,
  fetchAdminBillingFailures,
  type AdminDashboardMetrics,
  type AdminSubscriptionsReport,
  type PaymentFailureEntry,
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
  const [failures, setFailures] = useState<{
    paymentFailures: PaymentFailureEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [m, r, f] = await Promise.all([
          fetchAdminDashboardMetrics(),
          fetchAdminSubscriptionsReport(),
          fetchAdminBillingFailures(),
        ]);
        if (!cancelled) {
          setMetrics(m);
          setReport(r);
          setFailures(f);
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

          {/* P0-5: pagamentos B2C não aprovados (o billing MP do personal saiu na F4) */}
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Falhas de pagamento
              {failures && failures.paymentFailures.length > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 8,
                  background: COLORS.dangerSoft, color: COLORS.danger, fontWeight: 600,
                }}>
                  {failures.paymentFailures.length}
                </span>
              )}
            </div>
            {(!failures || failures.paymentFailures.length === 0) ? (
              <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                Nenhuma falha de pagamento registrada.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {failures.paymentFailures.map((p) => (
                  <div key={p.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: 12,
                    border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.user_name ?? p.user_email}</div>
                      <div style={{ color: COLORS.muted, fontSize: 12 }}>{p.user_email}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: COLORS.danger }}>
                        {formatCurrency(Number(p.amount_brl))}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>
                        {p.status} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
