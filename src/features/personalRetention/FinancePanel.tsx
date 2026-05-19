import { useState, useEffect, useCallback } from "react";
import { Settings } from "lucide-react";
import {
  fetchFinanceSummary,
  fetchBillingPlans,
  type FinanceSummary,
  type BillingPlan,
} from "../../services/personalBillingApi";
import { BillingPlansModal } from "./BillingPlansModal";

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Sparkline({ data }: { data: Array<{ month: string; mrrCents: number }> }) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.mrrCents), 1);
  const W = 200;
  const H = 48;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.mrrCents / max) * H * 0.85 - 4;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FinancePanel() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [range, setRange] = useState<"30d" | "90d" | "12m">("30d");
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([fetchFinanceSummary(range), fetchBillingPlans()]);
      setSummary(s);
      setPlans(p);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
      Carregando...
    </div>
  );

  if (error) return (
    <div style={{ padding: "24px 0", color: "var(--color-danger)", fontSize: 13 }}>{error}</div>
  );

  const activePlans = plans.filter((p) => p.active);

  return (
    <div className="pp-finance-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["30d", "90d", "12m"] as const).map((r) => (
            <button
              key={r}
              className={`pp-template-chip${range === r ? " active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <button className="pp-btn pp-btn--ghost" onClick={() => setShowPlansModal(true)}>
          <Settings size={14} /> Planos
        </button>
      </div>

      {summary && (
        <>
          <div className="pp-finance-kpis">
            <div className="pp-finance-kpi">
              <p className="pp-finance-kpi-label">MRR</p>
              <p className={`pp-finance-kpi-value${summary.mrrCents > 0 ? " positive" : ""}`}>
                {formatBrl(summary.mrrCents)}
              </p>
            </div>
            <div className="pp-finance-kpi">
              <p className="pp-finance-kpi-label">Ticket médio</p>
              <p className="pp-finance-kpi-value">{formatBrl(summary.averageTicketCents)}</p>
            </div>
            <div className="pp-finance-kpi">
              <p className="pp-finance-kpi-label">Retenção 30d</p>
              <p className={`pp-finance-kpi-value${summary.retention30d >= 80 ? " positive" : ""}`}>
                {summary.retention30d}%
              </p>
            </div>
            <div className="pp-finance-kpi">
              <p className="pp-finance-kpi-label">Churn 30d</p>
              <p className={`pp-finance-kpi-value${summary.churnRate30d > 10 ? " negative" : ""}`}>
                {summary.churnRate30d}%
              </p>
            </div>
          </div>

          {summary.monthlyEvolution.length >= 2 && (
            <div className="pp-sparkline-wrap">
              <p className="pp-sparkline-title">Evolução MRR</p>
              <Sparkline data={summary.monthlyEvolution} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                  {summary.monthlyEvolution[0]?.month}
                </span>
                <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                  {summary.monthlyEvolution.at(-1)?.month}
                </span>
              </div>
            </div>
          )}

          {summary.activeCount === 0 && (
            <div
              style={{
                background: "var(--color-surface-subtle)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 10,
                padding: 16,
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              Nenhum aluno em assinatura ativa.{" "}
              <button
                className="pp-insight-chip-link"
                onClick={() => setShowPlansModal(true)}
              >
                Criar um plano
              </button>{" "}
              e atribua a um aluno para começar.
            </div>
          )}

          {activePlans.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
                Planos ativos ({activePlans.length})
              </p>
              {activePlans.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{p.title}</span>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    {formatBrl(p.priceCents)}/{p.period === "monthly" ? "mês" : p.period}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showPlansModal && (
        <BillingPlansModal onClose={() => { setShowPlansModal(false); void load(); }} />
      )}
    </div>
  );
}
