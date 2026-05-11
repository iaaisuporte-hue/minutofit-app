import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminDashboardMetrics,
  fetchAdminPlatformHealth,
  type AdminDashboardMetrics,
  type AdminPlatformHealth,
} from "../../services/adminApi";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function MetabolismBar({
  low,
  moderate,
  high,
  unknown,
}: {
  low: number;
  moderate: number;
  high: number;
  unknown: number;
}) {
  const total = low + moderate + high + unknown;
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          gap: 2,
          background: "var(--color-border)",
        }}
      >
        {low > 0    && <div style={{ width: pct(low),      background: "var(--color-danger)",  borderRadius: "999px 0 0 999px" }} />}
        {moderate > 0 && <div style={{ width: pct(moderate), background: "var(--color-warn)" }} />}
        {high > 0   && <div style={{ width: pct(high),     background: "var(--color-primary)", borderRadius: "0 999px 999px 0" }} />}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {[
          { label: "Baixo",    count: low,      color: "var(--color-danger)"  },
          { label: "Moderado", count: moderate, color: "var(--color-warn)"    },
          { label: "Alto",     count: high,     color: "var(--color-primary)" },
          ...(unknown > 0 ? [{ label: "Sem dado", count: unknown, color: "var(--color-text-subtle)" }] : []),
        ].map(({ label, count, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metricsData, setMetricsData] = useState<AdminDashboardMetrics | null>(null);
  const [healthData, setHealthData]   = useState<AdminPlatformHealth | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
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

  useEffect(() => { void loadAll(); }, []);

  const userMetrics = useMemo(() => {
    const tierMap = new Map(
      (metricsData?.tierBreakdown || []).map((item) => [item.name?.toLowerCase(), Number(item.count || 0)])
    );
    const freeCount    = tierMap.get("free")    || 0;
    const proCount     = tierMap.get("pro")     || 0;
    const premiumCount = tierMap.get("premium") || 0;

    if (!metricsData) {
      return [
        { label: "Usuários totais",   value: "--", note: "aguardando dados",       mod: "" },
        { label: "Assinaturas ativas", value: "--", note: "recorrência ativa",     mod: "" },
        { label: "Sem assinatura",    value: "--", note: "potencial de conversão", mod: "" },
        { label: "Mix de planos",     value: "--", note: "Free / Pro / Premium",   mod: "" },
      ];
    }
    const withoutSub = Math.max(0, metricsData.totalUsers - metricsData.activeSubscriptions);
    return [
      { label: "Usuários totais",   value: String(metricsData.totalUsers),        note: "base cadastrada",           mod: "" },
      { label: "Assinaturas ativas", value: String(metricsData.activeSubscriptions), note: "recorrência ativa",     mod: "ok" },
      { label: "Sem assinatura",    value: String(withoutSub),                    note: "potencial de conversão",   mod: withoutSub > 0 ? "warn" : "" },
      { label: "Mix de planos",     value: `${freeCount} / ${proCount} / ${premiumCount}`, note: "Free · Pro · Premium", mod: "" },
    ];
  }, [metricsData]);

  const alerts = useMemo(() => {
    const billingAlerts =
      metricsData && metricsData.totalUsers - metricsData.activeSubscriptions > 0
        ? [{
            severity: "attention" as const,
            text: `${metricsData.totalUsers - metricsData.activeSubscriptions} usuários sem assinatura ativa.`,
          }]
        : [];

    const healthAlerts: Array<{ severity: "attention" | "critical"; text: string }> = [];
    if (healthData) {
      if (healthData.usersWithoutCheckin7d > 0)
        healthAlerts.push({ severity: "attention", text: `${healthData.usersWithoutCheckin7d} aluno${healthData.usersWithoutCheckin7d > 1 ? "s" : ""} sem check-in nos últimos 7 dias.` });
      if (healthData.personalsWithFatigueClusters > 0)
        healthAlerts.push({ severity: "attention", text: `${healthData.personalsWithFatigueClusters} personal${healthData.personalsWithFatigueClusters > 1 ? "is" : ""} com cluster de fadiga na carteira.` });
      if (healthData.metabolismDistribution.low > 0)
        healthAlerts.push({ severity: "attention", text: `${healthData.metabolismDistribution.low} aluno${healthData.metabolismDistribution.low > 1 ? "s" : ""} com score metabólico baixo.` });
    }

    const all = [...healthAlerts, ...billingAlerts];
    if (alertFilter === "critical")  return all.filter((a) => a.severity === "critical");
    if (alertFilter === "attention") return all.filter((a) => a.severity === "attention");
    return all;
  }, [alertFilter, metricsData, healthData]);

  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "grid", gap: 16, color: "var(--color-text)" }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="dash-hero">
        <div>
          <div className="dash-hero-eyebrow">Plataforma</div>
          <div className="dash-hero-title">Estado da plataforma</div>
          <div className="dash-hero-meta">
            {today} · leitura rápida da base de usuários, sinais de saúde metabólica e recorrência.
          </div>
          <div className="dash-hero-links">
            <Link to="/app/admin/users"     className="dash-hero-link">Alunos</Link>
            <Link to="/app/admin/personals" className="dash-hero-link">Profissionais</Link>
            <Link to="/app/admin/finance"   className="dash-hero-link">Sinais comerciais</Link>
          </div>
        </div>

        {healthData && (
          <div className="dash-pulse">
            <div>
              <div className="dash-pulse-label">Ativos 7d</div>
              <div className={`dash-pulse-value${healthData.activeUsers7d > 0 ? "--ok" : ""}`}
                style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: healthData.activeUsers7d > 0 ? "var(--color-primary)" : "var(--color-text)" }}>
                {healthData.activeUsers7d}
              </div>
            </div>
            <div>
              <div className="dash-pulse-label">Sem check-in</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em",
                color: healthData.usersWithoutCheckin7d > 0 ? "var(--color-warn)" : "var(--color-text)" }}>
                {healthData.usersWithoutCheckin7d}
              </div>
            </div>
            {healthData.adherenceAvg7d !== null && (
              <div>
                <div className="dash-pulse-label">Aderência 7d</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text)" }}>
                  {healthData.adherenceAvg7d}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="dash-section">
          <div className="dash-section-title">Carregando estado da plataforma…</div>
          <div className="dash-section-sub">Buscando métricas e sinais de saúde.</div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="dash-section" style={{ borderColor: "var(--color-danger-border)", background: "var(--color-danger-soft)" }}>
          <div className="dash-section-title">Não foi possível carregar o dashboard</div>
          <div className="dash-section-sub">{error}</div>
          <button
            type="button"
            onClick={() => void loadAll()}
            style={{
              marginTop: 12,
              padding: "9px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-danger-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Bloco 1: Saúde metabólica ─────────────────────── */}
          {healthData ? (
            <div className="dash-section dash-section--accent">
              <div className="dash-section-title">Saúde metabólica da base</div>
              <div className="dash-section-sub">Sinais de atividade, aderência e distribuição de score metabólico.</div>

              <div className="dash-kpi-grid" style={{ marginTop: 16 }}>
                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Ativos 7d</div>
                  <div className={`dash-kpi-item-value${healthData.activeUsers7d > 0 ? "--ok" : ""}`}
                    style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4,
                      color: healthData.activeUsers7d > 0 ? "var(--color-primary)" : "var(--color-text)" }}>
                    {healthData.activeUsers7d}
                  </div>
                  <div className="dash-kpi-item-note">com atividade recente</div>
                </div>

                {healthData.adherenceAvg7d !== null && (
                  <div className="dash-kpi-item">
                    <div className="dash-kpi-item-label">Aderência média 7d</div>
                    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4, color: "var(--color-text)" }}>
                      {healthData.adherenceAvg7d}%
                    </div>
                    <div className="dash-kpi-item-note">frequência de check-in</div>
                  </div>
                )}

                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Sem check-in 7d</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4,
                    color: healthData.usersWithoutCheckin7d > 0 ? "var(--color-warn)" : "var(--color-text)" }}>
                    {healthData.usersWithoutCheckin7d}
                  </div>
                  <div className="dash-kpi-item-note">risco de abandono</div>
                </div>

                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Cluster de fadiga</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4,
                    color: healthData.personalsWithFatigueClusters > 0 ? "var(--color-warn)" : "var(--color-text)" }}>
                    {healthData.personalsWithFatigueClusters}
                  </div>
                  <div className="dash-kpi-item-note">personais com alunos em fadiga</div>
                </div>
              </div>

              <hr className="dash-divider" />

              <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginBottom: 12,
                textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                Distribuição de score metabólico
              </div>
              <MetabolismBar
                low={healthData.metabolismDistribution.low}
                moderate={healthData.metabolismDistribution.moderate}
                high={healthData.metabolismDistribution.high}
                unknown={healthData.metabolismDistribution.unknown}
              />
              {healthData.metabolismDistribution.low + healthData.metabolismDistribution.moderate +
               healthData.metabolismDistribution.high + healthData.metabolismDistribution.unknown === 0 && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 8 }}>
                  Nenhum snapshot metabólico registrado ainda.
                </div>
              )}
            </div>
          ) : (
            <div className="dash-section">
              <div className="dash-section-title">Saúde metabólica</div>
              <div className="dash-section-sub">
                Nenhum dado disponível ainda. Os sinais aparecerão quando usuários realizarem check-ins e sessões.
              </div>
            </div>
          )}

          {/* ── Bloco 2: Sinais operacionais ──────────────────── */}
          <div className="dash-kpi-grid">
            {userMetrics.map((item) => (
              <div className="dash-kpi-item" key={item.label}>
                <div className="dash-kpi-item-label">{item.label}</div>
                <div
                  className={item.mod === "warn" ? "dash-kpi-item-value--warn" : item.mod === "ok" ? "dash-kpi-item-value--ok" : ""}
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    marginTop: 4,
                    color: item.mod === "warn"
                      ? "var(--color-warn)"
                      : item.mod === "ok"
                      ? "var(--color-primary)"
                      : "var(--color-text)",
                  }}
                >
                  {item.value}
                </div>
                <div className="dash-kpi-item-note">{item.note}</div>
              </div>
            ))}
          </div>

          {/* ── Bloco 3: Sinais que merecem atenção ───────────── */}
          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Sinais que merecem atenção</div>
                <div className="dash-section-sub">Aderência, fadiga, cobrança e anomalias operacionais.</div>
              </div>
              <div className="dash-filter-tabs">
                {(["all", "critical", "attention"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAlertFilter(key)}
                    className={`dash-filter-tab${alertFilter === key ? " dash-filter-tab--active" : ""}`}
                  >
                    {key === "all" ? "Todos" : key === "critical" ? "Críticos" : "Atenção"}
                  </button>
                ))}
              </div>
            </div>

            <div className="dash-alert-list">
              {alerts.length === 0 ? (
                <div className="dash-alert-empty">Nenhum sinal para o filtro selecionado.</div>
              ) : (
                alerts.map((alert, i) => (
                  <div
                    key={`${alert.text}-${i}`}
                    className={`dash-alert-row${alert.severity === "critical" ? " dash-alert-row--critical" : ""}`}
                  >
                    {alert.text}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Bloco 4: Comercial — discreto ─────────────────── */}
          {metricsData && (metricsData.mrr > 0 || metricsData.totalRevenue > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em",
                color: "var(--color-text-subtle)", marginBottom: 8 }}>
                Sinais comerciais
              </div>
              <div className="dash-commercial">
                <div>
                  <div className="dash-commercial-label">MRR atual</div>
                  <div className="dash-commercial-value">{formatCurrency(metricsData.mrr)}</div>
                </div>
                <div>
                  <div className="dash-commercial-label">Receita aprovada</div>
                  <div className="dash-commercial-value">{formatCurrency(metricsData.totalRevenue)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Link
                    to="/app/admin/finance"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}
                  >
                    Ver sinais comerciais →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
