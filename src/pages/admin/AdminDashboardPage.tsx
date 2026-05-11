import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminDashboardMetrics,
  fetchAdminPlatformHealth,
  type AdminDashboardMetrics,
  type AdminPlatformHealth,
} from "../../services/adminApi";

// ── Helpers ───────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function scoreBand(score: number): "low" | "moderate" | "high" {
  if (score < 40) return "low";
  if (score < 70) return "moderate";
  return "high";
}

const BAND_LABEL: Record<"low" | "moderate" | "high", string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
};

// ── Sub-components ────────────────────────────────────────────────

function SkeletonLoading() {
  return (
    <div className="dash-section">
      <div className="dash-skeleton">
        <div className="dash-skeleton-bar" style={{ height: 20, width: "40%" }} />
        <div className="dash-skeleton-bar" style={{ height: 14, width: "70%" }} />
        <div className="dash-skeleton-bar" style={{ height: 14, width: "55%" }} />
      </div>
    </div>
  );
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

  const segments = [
    { key: "low",      count: low,      color: "var(--color-danger)",        label: "Baixo" },
    { key: "moderate", count: moderate, color: "var(--color-warn)",          label: "Moderado" },
    { key: "high",     count: high,     color: "var(--color-primary)",       label: "Alto" },
    ...(unknown > 0 ? [{ key: "unknown", count: unknown, color: "var(--color-text-subtle)", label: "Sem dado" }] : []),
  ];

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div
        style={{
          display: "flex",
          height: 6,
          borderRadius: 999,
          overflow: "hidden",
          gap: 2,
          background: "var(--color-border)",
        }}
      >
        {low      > 0 && <div style={{ width: pct(low),      background: "var(--color-danger)",        borderRadius: "999px 0 0 999px" }} />}
        {moderate > 0 && <div style={{ width: pct(moderate), background: "var(--color-warn)" }} />}
        {high     > 0 && <div style={{ width: pct(high),     background: "var(--color-primary)",       borderRadius: "0 999px 999px 0" }} />}
      </div>
      <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
        {segments.map(({ key, count, color, label }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>{label}</span>
            <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: "var(--text-xs)" }}>
              {count}
              <span style={{ color: "var(--color-text-subtle)", fontWeight: 400, marginLeft: 3 }}>
                ({pct(count)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

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
    if (!metricsData) return null;
    const tierMap = new Map(
      (metricsData.tierBreakdown || []).map((item) => [item.name?.toLowerCase(), Number(item.count || 0)])
    );
    const withoutSub = Math.max(0, metricsData.totalUsers - metricsData.activeSubscriptions);
    return [
      { label: "Usuários cadastrados", value: String(metricsData.totalUsers),            note: "base total",              mod: "" },
      { label: "Assinaturas ativas",   value: String(metricsData.activeSubscriptions),   note: "recorrência ativa",       mod: "ok" },
      { label: "Sem assinatura",       value: String(withoutSub),                        note: "potencial de conversão",  mod: withoutSub > 0 ? "warn" : "" },
      {
        label: "Mix de planos",
        value: `${tierMap.get("free") ?? 0} · ${tierMap.get("pro") ?? 0} · ${tierMap.get("premium") ?? 0}`,
        note: "Free · Pro · Premium",
        mod: "",
      },
    ];
  }, [metricsData]);

  // Alerts — enriched with navigation target
  const alertItems = useMemo(() => {
    const items: Array<{ severity: "attention" | "critical"; text: string; to: string }> = [];

    if (healthData) {
      if (healthData.usersWithoutCheckin7d > 0)
        items.push({
          severity: "attention",
          text: `${healthData.usersWithoutCheckin7d} aluno${healthData.usersWithoutCheckin7d > 1 ? "s" : ""} sem check-in nos últimos 7 dias.`,
          to: "/app/admin/users",
        });
      if (healthData.personalsWithFatigueClusters > 0)
        items.push({
          severity: "attention",
          text: `${healthData.personalsWithFatigueClusters} personal${healthData.personalsWithFatigueClusters > 1 ? "is" : ""} com cluster de fadiga na carteira.`,
          to: "/app/admin/personals",
        });
      if (healthData.metabolismDistribution.low > 0)
        items.push({
          severity: "attention",
          text: `${healthData.metabolismDistribution.low} aluno${healthData.metabolismDistribution.low > 1 ? "s" : ""} com score metabólico baixo.`,
          to: "/app/admin/users",
        });
    }

    if (metricsData && metricsData.totalUsers - metricsData.activeSubscriptions > 0)
      items.push({
        severity: "attention",
        text: `${metricsData.totalUsers - metricsData.activeSubscriptions} usuários sem assinatura ativa.`,
        to: "/app/admin/finance",
      });

    if (alertFilter === "critical")  return items.filter((a) => a.severity === "critical");
    if (alertFilter === "attention") return items.filter((a) => a.severity === "attention");
    return items;
  }, [alertFilter, metricsData, healthData]);

  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  const avgScore    = healthData?.averageScore ?? null;
  const avgBand     = avgScore !== null ? scoreBand(avgScore) : null;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)", color: "var(--color-text)" }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="dash-hero">
        {/* Left: context */}
        <div>
          <div className="dash-hero-eyebrow">Plataforma</div>
          <div className="dash-hero-title">Estado da plataforma</div>
          <div className="dash-hero-meta">
            {today} · resumo de saúde metabólica, aderência e recorrência da base.
          </div>
          <div className="dash-hero-links">
            <Link to="/app/admin/users"     className="dash-hero-link">Alunos</Link>
            <Link to="/app/admin/personals" className="dash-hero-link">Personais</Link>
            <Link to="/app/admin/finance"   className="dash-hero-link">Financeiro</Link>
          </div>
        </div>

        {/* Right: single anchor metric */}
        {!loading && (
          <div style={{ textAlign: "right" }}>
            <div className="dash-eyebrow" style={{ marginBottom: "var(--space-2)" }}>
              Score metabólico médio
            </div>

            {avgScore !== null ? (
              <>
                <div className="dash-hero-metric">{avgScore.toFixed(1)}</div>
                {avgBand && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
                    <span className={`dash-hero-metric-band dash-hero-metric-band--${avgBand}`}>
                      {BAND_LABEL[avgBand]}
                    </span>
                  </div>
                )}
                <div className="dash-section-sub" style={{ marginTop: "var(--space-2)", textAlign: "right" }}>
                  média dos últimos 30 dias
                </div>
              </>
            ) : (
              <div style={{ maxWidth: 180 }}>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "var(--color-text-muted)", lineHeight: 1.3 }}>
                  Em formação
                </div>
                <div className="dash-section-sub" style={{ marginTop: 4 }}>
                  aguardando primeiros snapshots metabólicos
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────────── */}
      {loading && <SkeletonLoading />}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="dash-section"
          style={{ borderColor: "var(--color-danger-border)", background: "var(--color-danger-soft)" }}
        >
          <div className="dash-section-title">Não foi possível carregar o dashboard</div>
          <div className="dash-section-sub">{error}</div>
          <button type="button" onClick={() => void loadAll()} className="dash-btn-ghost" style={{ marginTop: "var(--space-3)" }}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Bloco 1: Saúde metabólica ─────────────────────────── */}
          {healthData ? (
            <div className="dash-section dash-section--accent">
              <div className="dash-section-header">
                <div>
                  <div className="dash-section-title">Saúde metabólica da base</div>
                  <div className="dash-section-sub">
                    Sinais de atividade, aderência e score da base nos últimos 7 dias.
                  </div>
                </div>
              </div>

              <div className="dash-kpi-grid" style={{ marginTop: "var(--space-4)" }}>
                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Ativos 7d</div>
                  <div
                    className="dash-kpi-item-value"
                    style={{ color: healthData.activeUsers7d > 0 ? "var(--color-primary)" : "var(--color-text)" }}
                  >
                    {healthData.activeUsers7d}
                  </div>
                  <div className="dash-kpi-item-note">check-in ou treino recente</div>
                </div>

                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Aderência média 7d</div>
                  <div className="dash-kpi-item-value">
                    {healthData.adherenceAvg7d !== null ? `${healthData.adherenceAvg7d}%` : "—"}
                  </div>
                  <div className="dash-kpi-item-note">frequência de check-in</div>
                </div>

                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Sem check-in 7d</div>
                  <div
                    className="dash-kpi-item-value"
                    style={{ color: healthData.usersWithoutCheckin7d > 0 ? "var(--color-warn)" : "var(--color-text)" }}
                  >
                    {healthData.usersWithoutCheckin7d}
                  </div>
                  <div className="dash-kpi-item-note">risco de abandono</div>
                </div>

                <div className="dash-kpi-item">
                  <div className="dash-kpi-item-label">Cluster de fadiga</div>
                  <div
                    className="dash-kpi-item-value"
                    style={{ color: healthData.personalsWithFatigueClusters > 0 ? "var(--color-warn)" : "var(--color-text)" }}
                  >
                    {healthData.personalsWithFatigueClusters}
                  </div>
                  <div className="dash-kpi-item-note">personais com carteira em fadiga</div>
                </div>
              </div>

              <hr className="dash-divider" />

              <div className="dash-eyebrow" style={{ marginBottom: "var(--space-3)" }}>
                Distribuição de score metabólico
              </div>
              {healthData.metabolismDistribution.low + healthData.metabolismDistribution.moderate +
               healthData.metabolismDistribution.high + healthData.metabolismDistribution.unknown === 0 ? (
                <div className="dash-alert-empty" style={{ marginTop: 0, textAlign: "left" }}>
                  Sinais metabólicos em formação. Os indicadores aparecerão após os primeiros check-ins e sessões dos alunos.
                </div>
              ) : (
                <MetabolismBar
                  low={healthData.metabolismDistribution.low}
                  moderate={healthData.metabolismDistribution.moderate}
                  high={healthData.metabolismDistribution.high}
                  unknown={healthData.metabolismDistribution.unknown}
                />
              )}
            </div>
          ) : (
            <div className="dash-section">
              <div className="dash-section-title">Saúde metabólica</div>
              <div className="dash-section-sub" style={{ marginTop: "var(--space-2)" }}>
                Sinais metabólicos em formação. Os indicadores aparecerão após os primeiros check-ins e sessões dos alunos.
              </div>
            </div>
          )}

          {/* ── Bloco 2: Sinais operacionais ──────────────────────── */}
          {userMetrics && (
            <div className="dash-kpi-grid">
              {userMetrics.map((item) => (
                <div className="dash-kpi-item" key={item.label}>
                  <div className="dash-kpi-item-label">{item.label}</div>
                  <div
                    className="dash-kpi-item-value"
                    style={{
                      color:
                        item.mod === "warn" ? "var(--color-warn)"
                        : item.mod === "ok"  ? "var(--color-primary)"
                        : "var(--color-text)",
                    }}
                  >
                    {item.value}
                  </div>
                  <div className="dash-kpi-item-note">{item.note}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Bloco 3: Sinais que merecem atenção ───────────────── */}
          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Sinais que merecem atenção</div>
                <div className="dash-section-sub">
                  Aderência, fadiga, cobrança e anomalias operacionais — clique para ver detalhes.
                </div>
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
              {alertItems.length === 0 ? (
                <div className="dash-alert-empty">
                  Nenhum alerta ativo no momento. A plataforma não identificou queda de aderência, fadiga elevada ou anomalias operacionais nas últimas 24h.
                </div>
              ) : (
                alertItems.map((alert, i) => (
                  <Link
                    key={`${alert.text}-${i}`}
                    to={alert.to}
                    className={`dash-alert-row-link${alert.severity === "critical" ? " dash-alert-row-link--critical" : ""}`}
                  >
                    {alert.text}
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* ── Bloco 4: Comercial — discreto ─────────────────────── */}
          {metricsData && (metricsData.mrr > 0 || metricsData.totalRevenue > 0) && (
            <div>
              <div className="dash-eyebrow" style={{ marginBottom: "var(--space-2)" }}>
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
                  <Link to="/app/admin/finance" className="dash-hero-link">
                    Ver detalhes →
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
