/**
 * Os quatro números do mês. Todos vêm calculados do backend — a tela formata.
 *
 * "Previsto" e "Recebido" olham a competência do mês corrente; "Pendente" e
 * "Vencido" olham tudo que continua em aberto, inclusive de meses anteriores.
 * Por isso o vencido pode ser maior que o previsto sem que haja erro.
 */
import { formatCents, type FinanceKpis as Kpis } from "../../services/personalFinanceApi";

export function FinanceKpis({ kpis }: { kpis: Kpis }) {
  const cards = [
    { label: "Previsto no mês", value: formatCents(kpis.expectedCents), tone: "" },
    {
      label: "Recebido",
      value: formatCents(kpis.receivedCents),
      tone: kpis.receivedCents > 0 ? "positive" : "",
    },
    { label: "Pendente", value: formatCents(kpis.pendingCents), tone: "" },
    {
      label: "Vencido",
      value: formatCents(kpis.overdueCents),
      tone: kpis.overdueCents > 0 ? "negative" : "",
    },
  ];

  return (
    <div className="pp-finance-kpis">
      {cards.map((card) => (
        <div key={card.label} className="pp-finance-kpi">
          <p className="pp-finance-kpi-label">{card.label}</p>
          <p className={`pp-finance-kpi-value${card.tone ? ` ${card.tone}` : ""}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
