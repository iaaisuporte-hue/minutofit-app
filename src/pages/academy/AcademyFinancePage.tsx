import { useState, useEffect, useCallback } from "react";
import { fetchAcademyPayments, type AcademyPaymentRow, type AcademyFinanceKPIs } from "../../services/academyApi";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { Banner } from "../../components/Banner";

const STATUS_LABEL: Record<string, string> = {
  paid:    "Pago",
  pending: "Pendente",
  failed:  "Falhou",
  refunded:"Estornado",
};
const STATUS_CLASS: Record<string, string> = {
  paid:    "badge badge-success",
  pending: "badge badge-warn",
  failed:  "badge badge-error",
  refunded:"badge",
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(amount / 100);
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

const THIS_MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function AcademyFinancePage() {
  const [rows,    setRows]    = useState<AcademyPaymentRow[]>([]);
  const [kpis,    setKpis]    = useState<AcademyFinanceKPIs | null>(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [from,   setFrom]   = useState(THIS_MONTH_START);
  const [to,     setTo]     = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAcademyPayments({ from: from || undefined, to: to || undefined, status: status || undefined });
      setRows(res.rows);
      setTotal(res.total);
      setKpis(res.kpis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, status]);

  useEffect(() => { void load(); }, [load]);

  const currency = rows[0]?.currency ?? "BRL";

  return (
    <div className="page-container">
      <div className="dash-hero" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <div className="dash-hero-eyebrow">Financeiro</div>
          <h1 className="dash-hero-title">Pagamentos da academia</h1>
          <p className="dash-hero-meta">Visibilidade honesta dos pagamentos — sem DRE, sem conciliação, sem comissões.</p>
        </div>
      </div>

      {/* KPI grid */}
      {kpis && (
        <div className="dash-kpi-grid" style={{ marginBottom: "var(--space-6)" }}>
          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Receita do mês</div>
            <div className="dash-kpi-item-value" style={{ color: "var(--color-success)" }}>
              {fmt(kpis.totalPaid, currency)}
            </div>
            <div className="dash-kpi-item-note">{kpis.countPaid} pagamento{kpis.countPaid !== 1 ? "s" : ""} confirmado{kpis.countPaid !== 1 ? "s" : ""}</div>
          </div>
          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Pendentes</div>
            <div className="dash-kpi-item-value" style={kpis.totalPending > 0 ? { color: "var(--color-warn)" } : undefined}>
              {fmt(kpis.totalPending, currency)}
            </div>
            <div className="dash-kpi-item-note">{kpis.countPending} aguardando</div>
          </div>
          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Falhas</div>
            <div className="dash-kpi-item-value" style={kpis.totalFailed > 0 ? { color: "var(--color-danger)" } : undefined}>
              {fmt(kpis.totalFailed, currency)}
            </div>
            <div className="dash-kpi-item-note">{kpis.countFailed} transação{kpis.countFailed !== 1 ? "ões" : ""}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)" }}>
          De
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: 160 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)" }}>
          Até
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: 160 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)" }}>
          Status
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="">Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="failed">Falhou</option>
          </select>
        </label>
        <button className="btn btn-sm" onClick={() => void load()} disabled={loading}>
          Filtrar
        </button>
      </div>

      {error && <Banner variant="error" title="Erro ao carregar pagamentos" description={error} />}
      {loading && <LoadingSkeleton variant="list" lines={5} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          eyebrow="Pagamentos"
          title="Nenhum pagamento encontrado"
          description="Pagamentos aparecerão aqui assim que os primeiros alunos da sua academia começarem a pagar pelos planos."
        />
      )}

      {!loading && rows.length > 0 && (
        <>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
            {total} resultado{total !== 1 ? "s" : ""}
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{row.student_name ?? "—"}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>{row.student_email}</div>
                    </td>
                    <td>{row.plan_name ?? "—"}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(row.amount, row.currency)}</td>
                    <td>
                      <span className={STATUS_CLASS[row.status] ?? "badge"}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(row.paid_at ?? row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
