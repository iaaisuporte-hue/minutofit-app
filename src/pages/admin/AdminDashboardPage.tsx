import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminDashboardMetrics,
  fetchAdminPlatformHealth,
  type AdminDashboardMetrics,
  type AdminPlatformHealth,
} from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <div style={{ color: COLORS.muted, fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700 }}>{value}</div>
      {note ? <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>{note}</div> : null}
    </Card>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function MetabolismBar({ low, moderate, high, unknown }: { low: number; moderate: number; high: number; unknown: number }) {
  const total = low + moderate + high + unknown;
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          gap: 2,
        }}
      >
        <div style={{ width: pct(low), background: "#EF4444", borderRadius: "999px 0 0 999px" }} />
        <div style={{ width: pct(moderate), background: "#F59E0B" }} />
        <div style={{ width: pct(high), background: "#22C55E", borderRadius: "0 999px 999px 0" }} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: "#EF4444" }} />
          <span style={{ color: COLORS.muted }}>Baixo</span>
          <span style={{ fontWeight: 700 }}>{low}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: "#F59E0B" }} />
          <span style={{ color: COLORS.muted }}>Moderado</span>
          <span style={{ fontWeight: 700 }}>{moderate}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: "#22C55E" }} />
          <span style={{ color: COLORS.muted }}>Alto</span>
          <span style={{ fontWeight: 700 }}>{high}</span>
        </div>
        {unknown > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS.muted }} />
            <span style={{ color: COLORS.muted }}>Sem dado</span>
            <span style={{ fontWeight: 700 }}>{unknown}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metricsData, setMetricsData] = useState<AdminDashboardMetrics | null>(null);
  const [healthData, setHealthData] = useState<AdminPlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "attention">("all");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [metrics, health] = await Promise.all([
        fetchAdminDashboardMetrics(),
        fetchAdminPlatformHealth().catch(() => null),
      ]);
      setMetricsData(metrics);
      setHealthData(health);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const userMetrics = useMemo(() => {
    const tierMap = new Map((metricsData?.tierBreakdown || []).map((item) => [item.name?.toLowerCase(), Number(item.count || 0)]));
    const freeCount = tierMap.get("free") || 0;
    const proCount = tierMap.get("pro") || 0;
    const premiumCount = tierMap.get("premium") || 0;

    if (!metricsData) {
      return [
        { title: "Usuários totais", value: "--", note: "aguardando dados" },
        { title: "Assinaturas ativas", value: "--", note: "aguardando dados" },
        { title: "Sem assinatura", value: "--", note: "potencial de conversão" },
        { title: "Mix de planos", value: "--", note: "Free / Pro / Premium" },
      ];
    }

    const withoutSub = Math.max(0, metricsData.totalUsers - metricsData.activeSubscriptions);
    return [
      { title: "Usuários totais", value: String(metricsData.totalUsers), note: "base cadastrada" },
      { title: "Assinaturas ativas", value: String(metricsData.activeSubscriptions), note: "recorrência ativa" },
      { title: "Sem assinatura", value: String(withoutSub), note: "potencial de conversão" },
      { title: "Mix de planos", value: `${freeCount}/${proCount}/${premiumCount}`, note: "Free / Pro / Premium" },
    ];
  }, [metricsData]);

  const alerts = useMemo(() => {
    const billingAttention =
      metricsData && metricsData.activeSubscriptions < metricsData.totalUsers
        ? [
            {
              severity: "attention" as const,
              text: `${metricsData.totalUsers - metricsData.activeSubscriptions} usuários sem assinatura ativa no momento.`,
            },
          ]
        : [];

    const healthAlerts: Array<{ severity: "attention" | "critical"; text: string }> = [];

    if (healthData) {
      if (healthData.usersWithoutCheckin7d > 0) {
        healthAlerts.push({
          severity: "attention",
          text: `${healthData.usersWithoutCheckin7d} aluno${healthData.usersWithoutCheckin7d > 1 ? "s" : ""} sem check-in nos últimos 7 dias.`,
        });
      }
      if (healthData.personalsWithFatigueClusters > 0) {
        healthAlerts.push({
          severity: "attention",
          text: `${healthData.personalsWithFatigueClusters} personal${healthData.personalsWithFatigueClusters > 1 ? "s" : ""} com cluster de fadiga na carteira.`,
        });
      }
      if (healthData.metabolismDistribution.low > 0) {
        healthAlerts.push({
          severity: "attention",
          text: `${healthData.metabolismDistribution.low} aluno${healthData.metabolismDistribution.low > 1 ? "s" : ""} com score metabólico baixo.`,
        });
      }
    }

    const allAlerts = [...healthAlerts, ...billingAttention];
    if (alertFilter === "critical") return allAlerts.filter((item) => item.severity === "critical");
    if (alertFilter === "attention") return allAlerts.filter((item) => item.severity === "attention");
    return allAlerts;
  }, [alertFilter, metricsData, healthData]);

  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <Card style={{ background: COLORS.panelDeep, border: `1px solid ${COLORS.borderStrong}` }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>Estado da plataforma</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 840, fontSize: 14 }}>
            {today} · leitura rápida da base de usuários, sinais de saúde metabólica e recorrência comercial.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Link to="/app/admin/users" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>
              Ver alunos
            </Link>
            <Link to="/app/admin/personals" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>
              Ver profissionais
            </Link>
            <Link to="/app/admin/finance" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>
              Sinais comerciais
            </Link>
          </div>
        </div>
      </Card>

      {loading && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Carregando estado da plataforma...</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>Buscando métricas e sinais de saúde.</div>
        </Card>
      )}

      {error && (
        <Card style={{ border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Não foi possível carregar o dashboard</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>{error}</div>
          <button
            type="button"
            onClick={() => void loadAll()}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${COLORS.redBorder}`,
              background: "#F9FAFB",
              color: COLORS.text,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Bloco 1: Saúde metabólica da base */}
          {healthData && (
            <Card style={{ background: COLORS.panelDeep, border: `1px solid ${COLORS.borderStrong}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Saúde metabólica da base</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Ativos nos últimos 7d</div>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{healthData.activeUsers7d}</div>
                </div>
                {healthData.adherenceAvg7d !== null && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ color: COLORS.muted, fontSize: 13 }}>Aderência média 7d</div>
                    <div style={{ fontSize: 26, fontWeight: 700 }}>{healthData.adherenceAvg7d}%</div>
                  </div>
                )}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Sem check-in 7d</div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: healthData.usersWithoutCheckin7d > 0 ? "#F59E0B" : COLORS.text,
                    }}
                  >
                    {healthData.usersWithoutCheckin7d}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Personals com fadiga na carteira</div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: healthData.personalsWithFatigueClusters > 0 ? "#F59E0B" : COLORS.text,
                    }}
                  >
                    {healthData.personalsWithFatigueClusters}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>Distribuição de score metabólico</div>
                <MetabolismBar
                  low={healthData.metabolismDistribution.low}
                  moderate={healthData.metabolismDistribution.moderate}
                  high={healthData.metabolismDistribution.high}
                  unknown={healthData.metabolismDistribution.unknown}
                />
                {healthData.metabolismDistribution.low + healthData.metabolismDistribution.moderate + healthData.metabolismDistribution.high + healthData.metabolismDistribution.unknown === 0 && (
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    Nenhum snapshot metabólico registrado ainda.
                  </div>
                )}
              </div>
            </Card>
          )}

          {!healthData && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Saúde metabólica</div>
              <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>
                Nenhum dado metabólico disponível ainda. Os sinais aparecerão quando usuários realizarem check-ins e sessões.
              </div>
            </Card>
          )}

          {/* Bloco 2: Sinais operacionais */}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {userMetrics.map((item) => (
              <KpiCard key={item.title} label={item.title} value={item.value} note={item.note} />
            ))}
          </div>

          {/* Bloco 3: Sinais que merecem atenção */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Sinais que merecem atenção</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "all", label: "Todos" },
                  { key: "critical", label: "Críticos" },
                  { key: "attention", label: "Atenção" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setAlertFilter(item.key as "all" | "critical" | "attention")}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      border: `1px solid ${alertFilter === item.key ? COLORS.borderStrong : COLORS.border}`,
                      background: alertFilter === item.key ? COLORS.primarySoft : COLORS.panelSoft,
                      color: COLORS.text,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>
              Sinais automáticos da base — aderência, fadiga, cobrança e anomalias operacionais.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {alerts.length === 0 && (
                <div style={{ padding: "14px 16px", borderRadius: 16, border: `1px solid ${COLORS.border}`, background: COLORS.panelSoft }}>
                  Nenhum sinal para o filtro selecionado.
                </div>
              )}
              {alerts.map((alert, index) => (
                <div
                  key={`${alert.text}-${index}`}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#FFD36C" }}>
                    ATENÇÃO
                  </div>
                  {alert.text}
                </div>
              ))}
            </div>
          </Card>

          {/* Bloco 4: Comercial — discreto, terceiro plano */}
          {metricsData && (metricsData.mrr > 0 || metricsData.totalRevenue > 0) && (
            <Card style={{ border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.muted, marginBottom: 12 }}>
                Sinais comerciais
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>MRR atual</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{formatCurrency(metricsData.mrr)}</div>
                </div>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Receita aprovada</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{formatCurrency(metricsData.totalRevenue)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <Link
                    to="/app/admin/finance"
                    style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none", fontSize: 14 }}
                  >
                    Ver sinais comerciais →
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
